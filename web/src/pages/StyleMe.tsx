import { Shirt, Shuffle, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AiBanner, useAiStatus } from '../components/AiBanner';
import { OutfitCard } from '../components/OutfitCard';
import { Chip } from '../components/ui';
import { suggestOutfits } from '../lib/ai';
import { useUserId } from '../lib/auth';
import { friendlyError, supabase } from '../lib/supabase';
import { OCCASIONS, WEATHER, closetGaps, occasionById, weatherById } from '../shared/styleRules';
import type { ClosetItem, OutfitIdea } from '../shared/types';

export default function StyleMe() {
  const userId = useUserId();
  const { status, refresh } = useAiStatus();
  const [closet, setCloset] = useState<ClosetItem[]>([]);
  const [occasion, setOccasion] = useState('casual');
  const [weather, setWeather] = useState('mild');
  const [rain, setRain] = useState(false);
  const [ideas, setIdeas] = useState<OutfitIdea[]>([]);
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [seed, setSeed] = useState(1);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('closet_items')
      .select('*')
      .eq('user_id', userId)
      .then(({ data }) => setCloset((data ?? []) as ClosetItem[]));
  }, [userId]);

  const gaps = closetGaps(closet);
  const ctx = { occasion: occasionById(occasion), weather: weatherById(weather), rain };

  async function generate() {
    const next = ideas.length ? seed + 1 : seed;
    setSeed(next);
    setBusy(true);
    setSaved(new Set());
    setError(undefined);
    try {
      const { ideas: result } = await suggestOutfits(closet, ctx, next);
      setIdeas(result);
      if (result.length === 0) setError('No outfits found. Add a few more items to your closet and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function save(i: number) {
    const idea = ideas[i];
    const { error } = await supabase.from('saved_outfits').insert({
      user_id: userId,
      item_ids: idea.itemIds,
      occasion: ctx.occasion.label,
      explanation: idea.explanation,
      source: idea.source,
    });
    if (error) return setError(friendlyError(error));
    setSaved((s) => new Set(s).add(i));
  }

  return (
    <>
      <h1>Style me</h1>
      <AiBanner status={status} onChange={refresh} />
      <h2>What’s the occasion?</h2>
      <div className="chips">
        {OCCASIONS.map((o) => (
          <Chip key={o.id} label={o.label} selected={occasion === o.id} onClick={() => setOccasion(o.id)} />
        ))}
      </div>
      <h2>What’s the weather like?</h2>
      <div className="chips">
        {WEATHER.map((w) => (
          <Chip key={w.id} label={w.label} selected={weather === w.id} onClick={() => setWeather(w.id)} />
        ))}
      </div>
      <label className="switch">
        <span>Rain expected</span>
        <input type="checkbox" checked={rain} onChange={(e) => setRain(e.target.checked)} />
      </label>

      {gaps.length > 0 ? (
        <div className="card">
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <Shirt size={20} color="var(--accent)" style={{ flex: 'none' }} />
            <p>To get outfit ideas, add {gaps.join(' and ')} to your closet.</p>
          </div>
          <Link to="/closet/new" className="btn">
            Add clothes
          </Link>
        </div>
      ) : (
        <button type="button" className="btn primary block" onClick={generate} disabled={busy}>
          {ideas.length ? <Shuffle size={18} /> : <Sparkles size={18} />}
          {busy ? 'Thinking…' : ideas.length ? 'Shuffle ideas' : 'Get outfit ideas'}
        </button>
      )}
      {error ? <p className="error">{error}</p> : null}
      {ideas.map((idea, i) => (
        <OutfitCard key={`${seed}-${i}`} idea={idea} items={closet} index={i} onSave={() => save(i)} saved={saved.has(i)} />
      ))}
    </>
  );
}
