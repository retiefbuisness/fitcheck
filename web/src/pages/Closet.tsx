import { Plus, Shirt } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Chip, Empty, Spinner, StorageImg } from '../components/ui';
import { useUserId } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { label } from '../shared/styleRules';
import { CATEGORIES, type Category, type ClosetItem } from '../shared/types';

export default function Closet() {
  const userId = useUserId();
  const navigate = useNavigate();
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Category | 'all'>('all');

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('closet_items')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setItems((data ?? []) as ClosetItem[]);
        setLoading(false);
      });
  }, [userId]);

  const shown = useMemo(() => (filter === 'all' ? items : items.filter((i) => i.category === filter)), [items, filter]);
  const usedCats = CATEGORIES.filter((c) => items.some((i) => i.category === c.id));

  return (
    <>
      <div className="row spread">
        <h1>Closet</h1>
        <Link to="/closet/new" className="btn primary small">
          <Plus size={18} /> Add
        </Link>
      </div>
      <div className="chips scroll">
        <Chip label={`All (${items.length})`} selected={filter === 'all'} onClick={() => setFilter('all')} />
        {usedCats.map((c) => (
          <Chip key={c.id} label={c.label} selected={filter === c.id} onClick={() => setFilter(c.id)} />
        ))}
        <Chip label="Saved outfits" onClick={() => navigate('/saved')} />
      </div>
      {loading ? (
        <Spinner />
      ) : shown.length === 0 ? (
        <Empty
          icon={<Shirt size={44} />}
          title="Your closet is empty"
          body="Snap the clothes you own to get outfit ideas. Start with a few tops, bottoms and shoes."
        />
      ) : (
        <div className="grid3">
          {shown.map((it) => (
            <Link key={it.id} to={`/closet/${it.id}`} className="tile">
              <StorageImg bucket="closet" path={it.image_path} alt={label(it)} />
              <span className="caption">{label(it)}</span>
            </Link>
          ))}
        </div>
      )}
      <button type="button" className="fab" onClick={() => navigate('/closet/new')} aria-label="Add clothing item">
        <Plus size={30} />
      </button>
    </>
  );
}
