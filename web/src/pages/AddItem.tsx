import { Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EMPTY_DRAFT, ItemForm, type ItemDraft } from '../components/ItemForm';
import { PhotoButtons, Spinner } from '../components/ui';
import { describeClothing, getAiStatus } from '../lib/ai';
import { useUserId } from '../lib/auth';
import { compressImage, uploadImage } from '../lib/images';
import {
  cleanBackground,
  getSmartSetting,
  recogniseClothing,
  setSmartSetting,
  SMART_DOWNLOAD_MB,
  type SmartGuess,
  type SmartSetting,
} from '../lib/smartPhoto';
import { friendlyError, supabase } from '../lib/supabase';
import { colorByName } from '../shared/colors';

type Which = 'clean' | 'original';

function usePreview(blob: Blob | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) return setUrl(null);
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

export default function AddItem() {
  const userId = useUserId();
  const navigate = useNavigate();
  const [original, setOriginal] = useState<Blob | null>(null);
  const [clean, setClean] = useState<Blob | null>(null);
  const [which, setWhich] = useState<Which>('clean');
  const [draft, setDraft] = useState<ItemDraft>(EMPTY_DRAFT);
  const [smart, setSmart] = useState<SmartSetting>(getSmartSetting);
  const [step, setStep] = useState<'cleaning' | 'tagging' | null>(null);
  const [aiFilled, setAiFilled] = useState(false);
  const [cleanFailed, setCleanFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const touched = useRef(new Set<keyof ItemDraft>());
  const run = useRef(0);

  const shown = which === 'clean' && clean ? clean : original;
  const preview = usePreview(shown);

  // Only fill in fields the user hasn't changed themselves.
  function applyGuess(guess: SmartGuess) {
    const color = guess.color ? colorByName(guess.color)?.name : undefined;
    const second = guess.secondary_color ? colorByName(guess.secondary_color)?.name : undefined;
    const next: Partial<ItemDraft> = {
      ...(guess.category ? { category: guess.category } : {}),
      ...(guess.name ? { name: guess.name } : {}),
      ...(color ? { color } : {}),
      ...(second ? { secondary_color: second } : {}),
      ...(guess.pattern ? { pattern: guess.pattern } : {}),
      ...(guess.formality ? { formality: guess.formality } : {}),
      ...(guess.warmth ? { warmth: guess.warmth } : {}),
    };
    for (const k of touched.current) delete next[k];
    if (Object.keys(next).length === 0) return;
    setDraft((d) => ({ ...d, ...next }));
    setAiFilled(true);
  }

  async function process(photo: Blob, useSmart: boolean) {
    const id = ++run.current;
    let forAi = photo;
    let colors: string[] = [];
    if (useSmart) {
      setStep('cleaning');
      try {
        const result = await cleanBackground(photo);
        if (id !== run.current) return;
        setClean(result.clean);
        setWhich('clean');
        forAi = result.clean;
        colors = result.colors;
      } catch {
        if (id !== run.current) return;
        setCleanFailed(true);
      }
    }
    setStep('tagging');
    try {
      // Chrome's built-in AI is best when it's there; otherwise use the downloaded model.
      const guess =
        (await getAiStatus()) === 'available' || !useSmart
          ? await describeClothing(forAi)
          : await recogniseClothing(forAi, colors);
      if (id === run.current) applyGuess(guess);
    } catch {
      // The user can fill in the details themselves.
    } finally {
      if (id === run.current) setStep(null);
    }
  }

  async function choose(file: File) {
    setError(undefined);
    setClean(null);
    setCleanFailed(false);
    setAiFilled(false);
    touched.current.clear();
    try {
      const small = await compressImage(file, 900);
      setOriginal(small);
      setWhich('clean');
      await process(small, smart === 'on');
    } catch (e) {
      setError(friendlyError(e));
      setStep(null);
    }
  }

  function turnOnSmart() {
    setSmartSetting('on');
    setSmart('on');
    if (original && !clean) process(original, true);
  }

  function turnOffSmart() {
    setSmartSetting('off');
    setSmart('off');
  }

  function edit(next: ItemDraft) {
    for (const k of Object.keys(next) as (keyof ItemDraft)[]) {
      if (next[k] !== draft[k]) touched.current.add(k);
    }
    setDraft(next);
  }

  async function save() {
    if (!userId) return;
    setSaving(true);
    setError(undefined);
    try {
      const image_path = shown ? await uploadImage('closet', userId, shown) : null;
      const { error } = await supabase.from('closet_items').insert({
        user_id: userId,
        image_path,
        name: draft.name.trim() || null,
        category: draft.category,
        color: draft.color,
        secondary_color: draft.secondary_color,
        pattern: draft.pattern,
        formality: draft.formality,
        warmth: draft.warmth,
        notes: draft.notes.trim() || null,
      });
      if (error) throw error;
      navigate('/closet');
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <h1>Add to closet</h1>

      {smart === null ? (
        <div className="card">
          <strong className="row">
            <Sparkles size={18} /> Smart photos
          </strong>
          <p className="muted small" style={{ margin: 0 }}>
            Puts each item on a clean white background and fills in the type, colour and pattern for you. It all happens
            on your device. The first time needs a one-off download of about {SMART_DOWNLOAD_MB} MB, so Wi-Fi is best.
          </p>
          <div className="row">
            <button type="button" className="btn primary small" onClick={turnOnSmart}>
              Turn on
            </button>
            <button type="button" className="btn ghost small" onClick={turnOffSmart}>
              Not now
            </button>
          </div>
        </div>
      ) : null}

      {preview ? (
        <img src={preview} alt="Clothing item" className="thumb" style={{ borderRadius: 16, objectFit: 'contain', background: '#fff' }} />
      ) : (
        <div className="card center muted" style={{ padding: 32 }}>
          Lay the item flat or hang it up. {smart === 'on' ? "We'll clean up the background for you." : 'A plain background works best.'}
        </div>
      )}

      {clean && original ? (
        <div className="photo-toggle" role="group" aria-label="Which photo to use">
          <button type="button" aria-pressed={which === 'clean'} onClick={() => setWhich('clean')}>
            White background
          </button>
          <button type="button" aria-pressed={which === 'original'} onClick={() => setWhich('original')}>
            Use original photo
          </button>
        </div>
      ) : null}
      {cleanFailed ? (
        <p className="muted small center" style={{ margin: 0 }}>
          We couldn't clean up this photo's background, so we'll use the original.
        </p>
      ) : null}

      <PhotoButtons onPick={choose} />

      {step ? (
        <div className="row muted">
          <Spinner inline /> {step === 'cleaning' ? 'Cleaning up the background…' : 'Scanning your photo and filling in the details…'}
        </div>
      ) : null}
      {aiFilled && !step ? (
        <p className="muted ai-note" style={{ margin: 0 }}>
          <Sparkles size={14} style={{ verticalAlign: '-2px' }} /> The AI filled these in from your photo. Check them and change
          anything that's wrong.
        </p>
      ) : null}

      <ItemForm draft={draft} onChange={edit} />
      {error ? <p className="error">{error}</p> : null}
      <button type="button" className="btn primary block" onClick={save} disabled={saving || step === 'cleaning'}>
        {saving ? 'Saving…' : 'Add to closet'}
      </button>
      {smart === 'on' ? (
        <button type="button" className="btn ghost small" onClick={turnOffSmart} style={{ alignSelf: 'center' }}>
          Turn off smart photos
        </button>
      ) : smart === 'off' ? (
        <button type="button" className="btn ghost small" onClick={turnOnSmart} style={{ alignSelf: 'center' }}>
          Turn on smart photos
        </button>
      ) : null}
    </>
  );
}
