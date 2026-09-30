import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ItemForm, type ItemDraft } from '../components/ItemForm';
import { Spinner, StorageImg } from '../components/ui';
import { removeImage } from '../lib/images';
import { friendlyError, supabase } from '../lib/supabase';
import type { ClosetItem } from '../shared/types';

export default function ClosetItemPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<ClosetItem | null>(null);
  const [draft, setDraft] = useState<ItemDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    supabase
      .from('closet_items')
      .select('*')
      .eq('id', id!)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return navigate('/closet', { replace: true });
        const it = data as ClosetItem;
        setItem(it);
        setDraft({
          name: it.name ?? '',
          category: it.category,
          color: it.color,
          secondary_color: it.secondary_color,
          pattern: it.pattern,
          formality: it.formality,
          warmth: it.warmth,
          notes: it.notes ?? '',
        });
      });
  }, [id, navigate]);

  if (!item || !draft) return <Spinner />;

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from('closet_items')
      .update({
        name: draft!.name.trim() || null,
        category: draft!.category,
        color: draft!.color,
        secondary_color: draft!.secondary_color,
        pattern: draft!.pattern,
        formality: draft!.formality,
        warmth: draft!.warmth,
        notes: draft!.notes.trim() || null,
      })
      .eq('id', id!);
    setSaving(false);
    if (error) setError(friendlyError(error));
    else navigate('/closet');
  }

  async function remove() {
    if (!confirm('Remove this item from your closet? This deletes its photo too.')) return;
    const { error } = await supabase.from('closet_items').delete().eq('id', id!);
    if (error) return setError(friendlyError(error));
    await removeImage('closet', item!.image_path);
    navigate('/closet');
  }

  return (
    <>
      <StorageImg bucket="closet" path={item.image_path} alt={item.name ?? 'Clothing item'} />
      <ItemForm draft={draft} onChange={setDraft} />
      {error ? <p className="error">{error}</p> : null}
      <button type="button" className="btn primary block" onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save changes'}
      </button>
      <button type="button" className="btn danger block" onClick={remove}>
        Remove from closet
      </button>
    </>
  );
}
