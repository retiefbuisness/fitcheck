import { Camera, Send, Star, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AiBanner, useAiStatus } from '../components/AiBanner';
import { RatingCard, ratingToText } from '../components/RatingCard';
import { Avatar, Chip, PhotoButtons, StorageImg } from '../components/ui';
import { rateOutfitPhoto } from '../lib/ai';
import { useUserId } from '../lib/auth';
import { compressImage, uploadImage } from '../lib/images';
import { friendlyError, supabase } from '../lib/supabase';
import { OCCASIONS, label, occasionById, rateOutfitWithRules, weatherById } from '../shared/styleRules';
import type { ClosetItem, Profile, RatingResult } from '../shared/types';

type Tagged = Pick<Profile, 'id' | 'username' | 'avatar_path'>;

export default function FitCheck() {
  const userId = useUserId();
  const navigate = useNavigate();
  const { status, refresh } = useAiStatus();
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [occasion, setOccasion] = useState('casual');
  const [rating, setRating] = useState<RatingResult | null>(null);
  const [rating_busy, setRatingBusy] = useState(false);
  const [closet, setCloset] = useState<ClosetItem[]>([]);
  const [wearing, setWearing] = useState<Set<string>>(new Set());
  const [showPicker, setShowPicker] = useState(false);
  const [caption, setCaption] = useState('');
  const [includeRating, setIncludeRating] = useState(true);
  const [tagQuery, setTagQuery] = useState('');
  const [tagResults, setTagResults] = useState<Tagged[]>([]);
  const [tagged, setTagged] = useState<Tagged[]>([]);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('closet_items')
      .select('*')
      .eq('user_id', userId)
      .order('category')
      .then(({ data }) => setCloset((data ?? []) as ClosetItem[]));
  }, [userId]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function reset() {
    setPhoto(null);
    setPreview(null);
    setRating(null);
    setWearing(new Set());
    setShowPicker(false);
    setCaption('');
    setTagged([]);
    setTagQuery('');
    setTagResults([]);
    setError(undefined);
  }

  async function choose(file: File) {
    setRating(null);
    setError(undefined);
    try {
      const small = await compressImage(file);
      setPhoto(small);
      setPreview(URL.createObjectURL(small));
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  async function rate() {
    if (!photo) return;
    setRatingBusy(true);
    setError(undefined);
    try {
      const result = await rateOutfitPhoto(photo, occasionById(occasion).label);
      if (result) setRating(result);
      else setShowPicker(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRatingBusy(false);
    }
  }

  function rateFromCloset() {
    const items = closet.filter((c) => wearing.has(c.id));
    if (items.length === 0) return;
    setRating(rateOutfitWithRules(items, { occasion: occasionById(occasion), weather: weatherById('mild'), rain: false }));
    setShowPicker(false);
  }

  async function searchPeople(q: string) {
    setTagQuery(q);
    const name = q.trim().toLowerCase().replace(/^@/, '').replace(/[%_]/g, '');
    if (name.length < 2 || !userId) return setTagResults([]);
    const { data } = await supabase.from('profiles').select('id, username, avatar_path').ilike('username', `${name}%`).neq('id', userId).limit(6);
    setTagResults(((data ?? []) as Tagged[]).filter((p) => !tagged.some((x) => x.id === p.id)));
  }

  async function post() {
    if (!photo || !userId) return;
    setPosting(true);
    setError(undefined);
    try {
      const image_path = await uploadImage('posts', userId, photo);
      const withRating = includeRating && rating;
      const { data, error } = await supabase
        .from('posts')
        .insert({
          user_id: userId,
          image_path,
          caption: caption.trim() || null,
          occasion: occasionById(occasion).label,
          ai_rating: withRating ? withRating.rating : null,
          ai_feedback: withRating ? ratingToText(withRating).slice(0, 2000) : null,
          ai_source: withRating ? withRating.source : null,
        })
        .select('id')
        .single();
      if (error) throw error;
      if (tagged.length) {
        await supabase.from('post_tags').insert(tagged.map((p) => ({ post_id: data.id, tagged_user_id: p.id })));
      }
      reset();
      navigate(`/post/${data.id}`);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setPosting(false);
    }
  }

  return (
    <>
      <h1>Fit check</h1>
      <AiBanner status={status} onChange={refresh} />
      {preview ? (
        <div className="photo-frame">
          <img src={preview} alt="Your outfit" className="thumb" style={{ borderRadius: 16 }} />
          <button type="button" className="icon-btn remove" onClick={reset} aria-label="Remove photo">
            <X size={20} />
          </button>
        </div>
      ) : (
        <div className="card center" style={{ alignItems: 'center', padding: 28 }}>
          <Camera size={40} color="var(--accent)" />
          <strong style={{ fontSize: 18 }}>What are you wearing today?</strong>
          <p className="muted">Snap a full-length photo of your outfit to get it rated and share it.</p>
        </div>
      )}
      <PhotoButtons onPick={choose} />

      {photo ? (
        <>
          <h2>What’s it for?</h2>
          <div className="chips">
            {OCCASIONS.map((o) => (
              <Chip
                key={o.id}
                label={o.label}
                selected={occasion === o.id}
                onClick={() => {
                  setOccasion(o.id);
                  setRating(null);
                }}
              />
            ))}
          </div>
          {rating ? (
            <RatingCard result={rating} />
          ) : (
            <button type="button" className="btn primary block" onClick={rate} disabled={rating_busy}>
              <Star size={18} /> {rating_busy ? 'Rating…' : 'Rate my fit'}
            </button>
          )}

          {showPicker && !rating ? (
            <div className="card">
              <strong>{status === 'available' ? 'The AI couldn’t rate this photo.' : 'On-device AI isn’t available here.'}</strong>
              <p className="muted">
                Tap the closet items you’re wearing to get a style rating instead, or just post it and let the community rate it.
              </p>
              {closet.length === 0 ? (
                <p className="muted">Your closet is empty. Add clothes from the Closet tab.</p>
              ) : (
                <div className="grid4">
                  {closet.map((it) => {
                    const on = wearing.has(it.id);
                    return (
                      <button
                        key={it.id}
                        type="button"
                        className={`tile ${on ? 'on' : 'dim'}`}
                        aria-pressed={on}
                        aria-label={label(it)}
                        onClick={() =>
                          setWearing((s) => {
                            const n = new Set(s);
                            if (on) n.delete(it.id);
                            else n.add(it.id);
                            return n;
                          })
                        }
                      >
                        <StorageImg bucket="closet" path={it.image_path} />
                      </button>
                    );
                  })}
                </div>
              )}
              <button type="button" className="btn" onClick={rateFromCloset} disabled={wearing.size === 0}>
                Rate from my closet
              </button>
            </div>
          ) : null}

          <h2>Share it</h2>
          <textarea className="input" placeholder="Write a caption…" maxLength={500} value={caption} onChange={(e) => setCaption(e.target.value)} />
          <input className="input" placeholder="Tag people: type a username" autoCapitalize="none" value={tagQuery} onChange={(e) => searchPeople(e.target.value)} />
          {tagResults.map((p) => (
            <button
              key={p.id}
              type="button"
              className="list-row"
              onClick={() => {
                setTagged((x) => [...x, p]);
                setTagResults([]);
                setTagQuery('');
              }}
            >
              <Avatar path={p.avatar_path} size={28} /> @{p.username}
            </button>
          ))}
          {tagged.length ? (
            <div className="chips">
              {tagged.map((p) => (
                <Chip key={p.id} label={`@${p.username} ✕`} selected onClick={() => setTagged((x) => x.filter((y) => y.id !== p.id))} />
              ))}
            </div>
          ) : null}
          {rating ? (
            <label className="switch">
              <span>Show my rating on the post</span>
              <input type="checkbox" checked={includeRating} onChange={(e) => setIncludeRating(e.target.checked)} />
            </label>
          ) : null}
          {error ? <p className="error">{error}</p> : null}
          <button type="button" className="btn primary block" onClick={post} disabled={posting}>
            <Send size={18} /> {posting ? 'Posting…' : 'Post fit'}
          </button>
          <p className="muted tiny">Only post photos of yourself or people who agreed, and never anyone under 18.</p>
        </>
      ) : error ? (
        <p className="error">{error}</p>
      ) : null}
    </>
  );
}
