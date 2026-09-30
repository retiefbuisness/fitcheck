import { Bookmark } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { OutfitCard } from '../components/OutfitCard';
import { Empty, Spinner } from '../components/ui';
import { useUserId } from '../lib/auth';
import { supabase } from '../lib/supabase';
import type { ClosetItem } from '../shared/types';

interface SavedRow {
  id: string;
  item_ids: string[];
  occasion: string | null;
  explanation: string | null;
  source: 'ai' | 'rules';
}

export default function SavedOutfits() {
  const me = useUserId();
  const [rows, setRows] = useState<SavedRow[] | null>(null);
  const [closet, setCloset] = useState<ClosetItem[]>([]);

  const fetchAll = useCallback(async () => {
    const [s, c] = await Promise.all([
      supabase.from('saved_outfits').select('*').eq('user_id', me!).order('created_at', { ascending: false }),
      supabase.from('closet_items').select('*').eq('user_id', me!),
    ]);
    return { saved: (s.data ?? []) as SavedRow[], items: (c.data ?? []) as ClosetItem[] };
  }, [me]);
  const apply = ({ saved, items }: { saved: SavedRow[]; items: ClosetItem[] }) => {
    setRows(saved);
    setCloset(items);
  };
  const load = () => fetchAll().then(apply);

  useEffect(() => {
    if (me) fetchAll().then(apply);
  }, [me, fetchAll]);

  async function remove(id: string) {
    if (!confirm('Remove this saved outfit?')) return;
    await supabase.from('saved_outfits').delete().eq('id', id);
    load();
  }

  if (!rows) return <Spinner />;
  return (
    <>
      <h1>Saved outfits</h1>
      {rows.length === 0 ? (
        <Empty icon={<Bookmark size={44} />} title="No saved outfits" body="Save ideas from Style me to find them here." />
      ) : null}
      {rows.map((r, i) => (
        <div key={r.id} className="stack" style={{ gap: 6 }}>
          <div className="row spread">
            <span className="muted small">{r.occasion}</span>
            <button type="button" className="btn ghost small" style={{ padding: 0, color: 'var(--muted)' }} onClick={() => remove(r.id)}>
              Remove
            </button>
          </div>
          <OutfitCard idea={{ itemIds: r.item_ids, explanation: r.explanation ?? '', source: r.source }} items={closet} index={i} />
        </div>
      ))}
    </>
  );
}
