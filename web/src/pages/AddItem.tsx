import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EMPTY_DRAFT, ItemForm, type ItemDraft } from '../components/ItemForm';
import { PhotoButtons, Spinner } from '../components/ui';
import { describeClothing } from '../lib/ai';
import { useUserId } from '../lib/auth';
import { compressImage, uploadImage } from '../lib/images';
import { friendlyError, supabase } from '../lib/supabase';
import { colorByName } from '../shared/colors';

export default function AddItem() {
  const userId = useUserId();
  const navigate = useNavigate();
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [draft, setDraft] = useState<ItemDraft>(EMPTY_DRAFT);
  const [tagging, setTagging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  async function choose(file: File) {
    setError(undefined);
    try {
      const small = await compressImage(file, 900);
      setPhoto(small);
      setPreview(URL.createObjectURL(small));
      setTagging(true);
      const guess = await describeClothing(small);
      const color = guess.color ? colorByName(guess.color)?.name : undefined;
      setDraft((d) => ({
        ...d,
        ...(guess.category ? { category: guess.category } : {}),
        ...(guess.name ? { name: guess.name } : {}),
        ...(color ? { color } : {}),
        ...(guess.pattern ? { pattern: guess.pattern } : {}),
        ...(guess.formality ? { formality: guess.formality } : {}),
        ...(guess.warmth ? { warmth: guess.warmth } : {}),
      }));
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setTagging(false);
    }
  }

  async function save() {
    if (!userId) return;
    setSaving(true);
    setError(undefined);
    try {
      const image_path = photo ? await uploadImage('closet', userId, photo) : null;
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
        <img src={preview} alt="Clothing item" className="thumb" style={{ borderRadius: 16 }} />
      ) : (
        <div className="card center muted" style={{ padding: 32 }}>
          Lay the item flat or hang it up against a plain background for the best results.
        </div>
      )}
      <PhotoButtons onPick={choose} />
      {tagging ? (
        <div className="row muted">
          <Spinner inline /> Filling in the details for you…
        </div>
      ) : null}
      <ItemForm draft={draft} onChange={setDraft} />
      {error ? <p className="error">{error}</p> : null}
      <button type="button" className="btn primary block" onClick={save} disabled={saving || tagging}>
        {saving ? 'Saving…' : 'Add to closet'}
      </button>
    </>
  );
}
