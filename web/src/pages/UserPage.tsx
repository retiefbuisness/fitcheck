import { Camera, Flag } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { PostGrid, ProfileHeader, useProfileStats } from '../components/ProfileHeader';
import { Empty, Spinner } from '../components/ui';
import { useUserId } from '../lib/auth';
import { blockUser, setFollowing, unblockUser } from '../lib/social';
import { friendlyError, supabase } from '../lib/supabase';
import type { FeedPost, Profile } from '../shared/types';

export default function UserPage() {
  const { id } = useParams();
  const me = useUserId();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [following, setFollowingState] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string>();
  const stats = useProfileStats(id, refreshKey);

  const fetchAll = useCallback(async () => {
    const [p, f, b, ps] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id!).maybeSingle(),
      supabase.from('follows').select('following_id').eq('follower_id', me!).eq('following_id', id!).maybeSingle(),
      supabase.from('blocks').select('blocked_id').eq('blocker_id', me!).eq('blocked_id', id!).maybeSingle(),
      supabase.from('post_feed').select('*').eq('user_id', id!).order('created_at', { ascending: false }),
    ]);
    return {
      profile: (p.data as Profile | null) ?? null,
      following: !!f.data,
      blocked: !!b.data,
      posts: (ps.data ?? []) as FeedPost[],
    };
  }, [id, me]);

  const load = useCallback(
    () =>
      fetchAll().then((r) => {
        if (!r.profile) return navigate('/', { replace: true });
        setProfile(r.profile);
        setFollowingState(r.following);
        setBlocked(r.blocked);
        setPosts(r.posts);
      }),
    [fetchAll, navigate],
  );

  useEffect(() => {
    if (me && id && id !== me) load();
  }, [me, id, load]);

  if (id === me) return <Navigate to="/profile" replace />;
  if (!profile || !me) return <Spinner />;

  async function toggleFollow() {
    const next = !following;
    setFollowingState(next);
    try {
      await setFollowing(id!, me!, next);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setFollowingState(!next);
      setError(friendlyError(e));
    }
  }

  async function toggleBlock() {
    if (blocked) {
      await unblockUser(id!, me!);
    } else {
      const ok = confirm(
        `Block @${profile!.username}? They won't be able to see your posts or comments, and you won't see theirs. They won't be notified.`,
      );
      if (!ok) return;
      await blockUser(id!, me!);
    }
    load();
  }

  return (
    <>
      <ProfileHeader
        profile={profile}
        postCount={posts.length}
        stats={stats}
        actions={
          <div className="stack" style={{ gap: 8 }}>
            {blocked ? (
              <p className="muted">You blocked this account.</p>
            ) : (
              <button type="button" className={following ? 'btn block' : 'btn primary block'} onClick={toggleFollow}>
                {following ? 'Following' : 'Follow'}
              </button>
            )}
            <div className="row">
              <button type="button" className="btn small grow" onClick={toggleBlock}>
                {blocked ? 'Unblock' : 'Block'}
              </button>
              <button type="button" className="btn small grow" onClick={() => navigate('/report', { state: { type: 'user', id } })}>
                <Flag size={16} /> Report
              </button>
            </div>
            {error ? <p className="error">{error}</p> : null}
          </div>
        }
      />
      {blocked ? null : posts.length ? <PostGrid posts={posts} /> : <Empty icon={<Camera size={44} />} title="No fits yet" />}
    </>
  );
}
