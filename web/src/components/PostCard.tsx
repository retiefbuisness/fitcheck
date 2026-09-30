import { Heart, MessageCircle, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUserId } from '../lib/auth';
import { setLiked, timeAgo } from '../lib/social';
import type { FeedPost } from '../shared/types';
import { Avatar, Stars, StorageImg } from './ui';

// Controlled by the parent: likes update optimistically through onChange.
export function PostCard({ post: p, onChange }: { post: FeedPost; onChange: (p: FeedPost) => void }) {
  const userId = useUserId();

  async function toggleLike() {
    if (!userId) return;
    const next = { ...p, liked_by_me: !p.liked_by_me, like_count: p.like_count + (p.liked_by_me ? -1 : 1) };
    onChange(next);
    try {
      await setLiked(p.id, userId, next.liked_by_me);
    } catch {
      onChange(p);
    }
  }

  return (
    <article className="card flush">
      <Link to={`/u/${p.user_id}`} className="row" style={{ padding: 12, textDecoration: 'none', color: 'inherit' }}>
        <Avatar path={p.avatar_path} size={34} />
        <div className="grow">
          <div style={{ fontWeight: 700 }}>{p.display_name || p.username}</div>
          <div className="muted tiny">
            @{p.username} · {timeAgo(p.created_at)}
            {p.occasion ? ` · ${p.occasion}` : ''}
          </div>
        </div>
      </Link>
      <Link to={`/post/${p.id}`} aria-label="Open post">
        <StorageImg bucket="posts" path={p.image_path} className="post-image" alt={p.caption ?? 'Outfit photo'} />
      </Link>
      <div className="stack" style={{ padding: 12, gap: 8 }}>
        <div className="row" style={{ gap: 16 }}>
          <button type="button" className="row icon-btn" style={{ width: 'auto', gap: 4, padding: '0 6px' }} onClick={toggleLike} aria-label={p.liked_by_me ? 'Unlike' : 'Like'}>
            <Heart size={22} fill={p.liked_by_me ? 'var(--danger)' : 'none'} color={p.liked_by_me ? 'var(--danger)' : 'currentColor'} />
            <strong>{p.like_count}</strong>
          </button>
          <Link to={`/post/${p.id}`} className="row" style={{ gap: 4, color: 'inherit', textDecoration: 'none' }} aria-label="Comments">
            <MessageCircle size={21} /> <strong>{p.comment_count}</strong>
          </Link>
          <span className="grow" />
          {p.avg_rating != null ? (
            <span className="row" style={{ gap: 4 }}>
              <Stars value={Number(p.avg_rating)} size={15} />
              <span className="muted tiny">({p.rating_count})</span>
            </span>
          ) : null}
        </div>
        {p.ai_rating ? (
          <div className="muted small row" style={{ gap: 4 }}>
            <Sparkles size={13} color="var(--accent)" /> {p.ai_source === 'gemini_nano' ? 'AI' : 'Style'} rating: {p.ai_rating}/5
          </div>
        ) : null}
        {p.caption ? (
          <p>
            <strong>{p.username} </strong>
            {p.caption}
          </p>
        ) : null}
      </div>
    </article>
  );
}
