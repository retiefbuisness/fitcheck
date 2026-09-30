import { Flag, Tag, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PostCard } from '../components/PostCard';
import { Avatar, Spinner, Stars } from '../components/ui';
import { useUserId } from '../lib/auth';
import { removeImage } from '../lib/images';
import { ratePost, timeAgo } from '../lib/social';
import { friendlyError, supabase } from '../lib/supabase';
import type { CommentRow, FeedPost } from '../shared/types';

interface TagRow {
  tagged_user_id: string;
  profiles: { username: string } | null;
}

export default function PostPage() {
  const { id } = useParams();
  const me = useUserId();
  const navigate = useNavigate();
  const [post, setPost] = useState<FeedPost | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [tags, setTags] = useState<TagRow[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string>();

  const fetchAll = useCallback(async () => {
    const [p, c, tg] = await Promise.all([
      supabase.from('post_feed').select('*').eq('id', id!).maybeSingle(),
      supabase
        .from('comments')
        .select('id, post_id, user_id, body, created_at, profiles(username, display_name, avatar_path)')
        .eq('post_id', id!)
        .order('created_at'),
      supabase.from('post_tags').select('tagged_user_id, profiles(username)').eq('post_id', id!),
    ]);
    return {
      post: (p.data as FeedPost | null) ?? null,
      comments: (c.data ?? []) as unknown as CommentRow[],
      tags: (tg.data ?? []) as unknown as TagRow[],
    };
  }, [id]);

  const load = useCallback(
    () =>
      fetchAll().then((r) => {
        if (!r.post) return setMissing(true);
        setPost(r.post);
        setComments(r.comments);
        setTags(r.tags);
      }),
    [fetchAll],
  );

  useEffect(() => {
    load();
  }, [load]);

  if (missing) return <p className="muted">This fit isn’t available. It may have been deleted or hidden.</p>;
  if (!post || !me) return <Spinner />;
  const mine = post.user_id === me;

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSending(true);
    const { error } = await supabase.from('comments').insert({ post_id: id, user_id: me, body });
    setSending(false);
    if (error) return setError(friendlyError(error));
    setText('');
    load();
  }

  async function rate(stars: number) {
    setPost((p) => (p ? { ...p, my_rating: stars } : p));
    try {
      await ratePost(id!, me!, stars);
      load();
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  async function deletePost() {
    if (!confirm('Delete this fit? This removes the post, its photo, comments and ratings.')) return;
    const { error } = await supabase.from('posts').delete().eq('id', id!);
    if (error) return setError(friendlyError(error));
    await removeImage('posts', post!.image_path);
    navigate('/profile');
  }

  async function deleteComment(commentId: string) {
    if (!confirm('Delete this comment?')) return;
    await supabase.from('comments').delete().eq('id', commentId);
    load();
  }

  async function removeMyTag() {
    await supabase.from('post_tags').delete().eq('post_id', id!).eq('tagged_user_id', me!);
    load();
  }

  const report = (type: 'post' | 'comment' | 'ai_response', targetId: string, details?: string) =>
    navigate('/report', { state: { type, id: targetId, details } });

  return (
    <>
      <PostCard post={post} onChange={setPost} />
      <div className="row">
        {mine ? (
          <button type="button" className="btn danger small" onClick={deletePost}>
            <Trash2 size={16} /> Delete fit
          </button>
        ) : (
          <button type="button" className="btn small" onClick={() => report('post', post.id)}>
            <Flag size={16} /> Report
          </button>
        )}
      </div>

      {tags.length ? (
        <div className="row wrap">
          <Tag size={16} className="muted" />
          {tags.map((tg) => (
            <Link key={tg.tagged_user_id} to={`/u/${tg.tagged_user_id}`} style={{ fontWeight: 600 }}>
              @{tg.profiles?.username}
            </Link>
          ))}
          {tags.some((tg) => tg.tagged_user_id === me) ? (
            <button type="button" className="btn ghost small" style={{ padding: 0, color: 'var(--muted)' }} onClick={removeMyTag}>
              Remove my tag
            </button>
          ) : null}
        </div>
      ) : null}

      {post.ai_feedback ? (
        <div className="card">
          <strong>
            {post.ai_source === 'gemini_nano' ? '✨ AI' : 'Style'} rating: {post.ai_rating}/5
          </strong>
          <p style={{ whiteSpace: 'pre-line' }}>{post.ai_feedback}</p>
          {post.ai_source === 'gemini_nano' ? (
            <button
              type="button"
              className="btn ghost small"
              style={{ alignSelf: 'flex-start', padding: 0, color: 'var(--muted)', textDecoration: 'underline' }}
              onClick={() => report('ai_response', post.id, post.ai_feedback ?? '')}
            >
              Report this AI response
            </button>
          ) : null}
        </div>
      ) : null}

      {!mine ? (
        <div className="card">
          <strong>{post.my_rating ? 'Your rating' : 'Rate this fit'}</strong>
          <Stars value={post.my_rating} size={32} onChange={rate} />
        </div>
      ) : null}

      <h2>Comments</h2>
      {comments.length === 0 ? <p className="muted">No comments yet. Share a kind tip!</p> : null}
      {comments.map((c) => (
        <div key={c.id} className="row" style={{ alignItems: 'flex-start' }}>
          <Link to={`/u/${c.user_id}`}>
            <Avatar path={c.profiles?.avatar_path} size={32} />
          </Link>
          <div className="grow">
            <p>
              <strong>{c.profiles?.username} </strong>
              {c.body}
            </p>
            <div className="row tiny muted" style={{ gap: 12 }}>
              <span>{timeAgo(c.created_at)}</span>
              {c.user_id !== me ? (
                <button type="button" className="btn ghost small" style={{ padding: 0, fontSize: 12, color: 'var(--muted)' }} onClick={() => report('comment', c.id)}>
                  Report
                </button>
              ) : null}
              {c.user_id === me || mine ? (
                <button type="button" className="btn ghost small" style={{ padding: 0, fontSize: 12, color: 'var(--muted)' }} onClick={() => deleteComment(c.id)}>
                  Delete
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ))}
      <form className="stack" onSubmit={send}>
        <textarea className="input" placeholder="Add a comment…" maxLength={500} value={text} onChange={(e) => setText(e.target.value)} />
        {error ? <p className="error">{error}</p> : null}
        <button className="btn primary" disabled={sending || !text.trim()}>
          {sending ? 'Posting…' : 'Post comment'}
        </button>
      </form>
    </>
  );
}
