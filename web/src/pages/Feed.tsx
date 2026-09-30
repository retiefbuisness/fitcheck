import { Camera, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { PostCard } from '../components/PostCard';
import { Chip, Empty, Spinner } from '../components/ui';
import { useUserId } from '../lib/auth';
import { supabase } from '../lib/supabase';
import type { FeedPost } from '../shared/types';

const PAGE = 15;
type Mode = 'explore' | 'following';

export default function Feed() {
  const userId = useUserId();
  const [mode, setMode] = useState<Mode>('explore');
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [done, setDone] = useState(false);

  const fetchPage = useCallback(
    async (before?: string) => {
      let q = supabase.from('post_feed').select('*').order('created_at', { ascending: false }).limit(PAGE);
      if (before) q = q.lt('created_at', before);
      if (mode === 'following' && userId) {
        const { data: f } = await supabase.from('follows').select('following_id').eq('follower_id', userId);
        q = q.in('user_id', [userId, ...(f ?? []).map((r) => r.following_id)]);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as FeedPost[];
    },
    [mode, userId],
  );

  useEffect(() => {
    let alive = true;
    fetchPage()
      .then((first) => {
        if (!alive) return;
        setPosts(first);
        setDone(first.length < PAGE);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [fetchPage]);

  async function loadMore() {
    if (done || loadingMore || posts.length === 0) return;
    setLoadingMore(true);
    try {
      const more = await fetchPage(posts[posts.length - 1].created_at);
      setPosts((p) => [...p, ...more.filter((m) => !p.some((x) => x.id === m.id))]);
      if (more.length < PAGE) setDone(true);
    } finally {
      setLoadingMore(false);
    }
  }

  function switchTo(m: Mode) {
    if (m === mode) return;
    setLoading(true);
    setPosts([]);
    setMode(m);
  }

  return (
    <>
      <div className="chips">
        <Chip label="Explore" selected={mode === 'explore'} onClick={() => switchTo('explore')} />
        <Chip label="Following" selected={mode === 'following'} onClick={() => switchTo('following')} />
      </div>
      {loading ? (
        <Spinner />
      ) : posts.length === 0 ? (
        mode === 'following' ? (
          <Empty icon={<Users size={44} />} title="No fits yet" body="Follow people from Explore to see their fits here." />
        ) : (
          <Empty icon={<Camera size={44} />} title="Be the first" body="Post your fit from the Fit check tab." />
        )
      ) : (
        posts.map((p) => <PostCard key={p.id} post={p} onChange={(n) => setPosts((all) => all.map((x) => (x.id === n.id ? n : x)))} />)
      )}
      {!loading && !done ? (
        <button type="button" className="btn block" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      ) : null}
    </>
  );
}
