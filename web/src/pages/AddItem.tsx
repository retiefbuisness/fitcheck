import { Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EMPTY_DRAFT, ItemForm, type ItemDraft } from '../components/ItemForm';
import { PhotoButtons, Spinner } from '../components/ui';
import { describeClothing } from '../lib/ai';
import { useUserId } from '../lib/auth';
import { compressImage, uploadImage } from '../lib/images';
import {
  getSmartSetting,
  recogniseClothing,
  scanPhoto,
  setSmartSetting,
  smartPhotosReady,
  SMART_DOWNLOAD_MB,
  type CleanPiece,
  type SmartGuess,
  type SmartSetting,
  warmUpSmartPhotos,
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
  const [pieces, setPieces] = useState<CleanPiece[]>([]);
  const [pieceIdx, setPieceIdx] = useState(0);
  const [which, setWhich] = useState<Which>('clean');
  const [draft, setDraft] = useState<ItemDraft>(EMPTY_DRAFT);
  const [smart, setSmart] = useState<SmartSetting>(getSmartSetting);
  const [step, setStep] = useState<'cleaning' | 'tagging' | null>(null);
  const [firstRun, setFirstRun] = useState(false);
  const [alreadyWhite, setAlreadyWhite] = useState(false);
  const [aiFilled, setAiFilled] = useState(false);
  const [cleanFailed, setCleanFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const touched = useRef(new Set<keyof ItemDraft>());
  const run = useRef(0);

  const clean = pieces[pieceIdx]?.clean ?? null;
  const shown = which === 'clean' && clean ? clean : original;
  const preview = usePreview(shown);
  const smartOn = smart !== 'off'; // on unless the user turned it off

  // Start the one-off AI download as soon as the screen opens.
  useEffect(() => {
    if (smartOn) warmUpSmartPhotos();
  }, [smartOn]);

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
    setAlreadyWhite(false);
    if (useSmart) {
      setFirstRun(!smartPhotosReady());
      setStep('cleaning');
      try {
        const scan = await scanPhoto(photo);
        if (id !== run.current) return;
        setPieces(scan.pieces);
        setPieceIdx(0);
        setWhich('clean');
        setAlreadyWhite(scan.alreadyWhite);
        if (scan.guess) {
          applyGuess(scan.guess);
          setStep(null);
          return;
        }
        await tag(id, scan.pieces[0]);
        return;
      } catch {
        if (id !== run.current) return;
        setCleanFailed(true);
      }
    }
    await tag(id, null, photo);
  }

  // Works out the type, colour and pattern of a piece (or a plain photo) and fills them in.
  async function tag(id: number, piece: CleanPiece | null, photo?: Blob) {
    setStep('tagging');
    try {
      let guess: SmartGuess;
      try {
        guess = piece ? await recogniseClothing(piece) : await describeClothing(photo!);
      } catch {
        // The photo AI couldn't run (e.g. no connection the first time): at least guess the colour.
        guess = await describeClothing(piece?.clean ?? photo!);
      }
      if (id === run.current) applyGuess(guess);
    } catch {
      // The user can fill in the details themselves.
    } finally {
      if (id === run.current) setStep(null);
    }
  }

  // The photo had more than one piece of clothing: use a different one.
  function choosePiece(i: number) {
    const piece = pieces[i];
    if (!piece || i === pieceIdx) return;
    setPieceIdx(i);
    setWhich('clean');
    tag(++run.current, piece);
  }

  async function choose(file: File) {
    setError(undefined);
    setPieces([]);
    setPieceIdx(0);
    setCleanFailed(false);
    setAiFilled(false);
    touched.current.clear();
    try {
      const small = await compressImage(file, 900);
      setOriginal(small);
      setWhich('clean');
      await process(small, smartOn);
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

      {preview ? (
        <img src={preview} alt="Clothing item" className="thumb" style={{ borderRadius: 16, objectFit: 'contain', background: '#fff' }} />
      ) : (
        <div className="card center muted" style={{ padding: 32 }}>
          Take a photo of the item: laid flat, on a hanger or being worn.{' '}
          {smartOn ? "We'll cut it out onto a white background and fill in the details for you." : 'A plain background works best.'}
        </div>
      )}

      {pieces.length > 1 ? (
        <div className="stack" style={{ gap: 6 }}>
          <p className="muted small center" style={{ margin: 0 }}>
            We found more than one item. Which one are you adding?
          </p>
          <div className="photo-toggle" role="group" aria-label="Which item" style={{ flexWrap: 'wrap' }}>
            {pieces.map((p, i) => (
              <button key={i} type="button" aria-pressed={i === pieceIdx} onClick={() => choosePiece(i)}>
                {p.label || `Item ${i + 1}`}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {alreadyWhite && !step ? (
        <p className="muted small center" style={{ margin: 0 }}>
          This photo already has a white background, so we kept it as it is.
        </p>
      ) : null}
      {clean && original && !alreadyWhite ? (
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
          <Spinner inline /> {step === 'cleaning' ? 'Finding the clothing and cutting it out…' : 'Working out what it is…'}
        </div>
      ) : null}
      {step && firstRun ? (
        <p className="muted small" style={{ margin: 0 }}>
          First time only: downloading the photo AI (about {SMART_DOWNLOAD_MB} MB). After this it's much quicker.
        </p>
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
      {smartOn ? (
        <button type="button" className="btn ghost small" onClick={turnOffSmart} style={{ alignSelf: 'center' }}>
          Turn off smart photos
        </button>
      ) : (
        <button type="button" className="btn ghost small" onClick={turnOnSmart} style={{ alignSelf: 'center' }}>
          Turn on smart photos
        </button>
      )}
    </>
  );
}
