import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { FeedPost, Profile } from '../shared/types';
import { Avatar, StorageImg } from './ui';

export function useProfileStats(userId: string | undefined, refreshKey = 0) {
  const [stats, setStats] = useState({ followers: 0, following: 0 });
  useEffect(() => {
    if (!userId) return;
    Promise.all([
      supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', userId),
      supabase.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', userId),
    ]).then(([a, b]) => setStats({ followers: a.count ?? 0, following: b.count ?? 0 }));
  }, [userId, refreshKey]);
  return stats;
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="grow center">
      <div style={{ fontSize: 18, fontWeight: 800 }}>{n}</div>
      <div className="muted tiny">{label}</div>
    </div>
  );
}

export function ProfileHeader({
  profile,
  postCount,
  stats,
  actions,
}: {
  profile: Profile;
  postCount: number;
  stats: { followers: number; following: number };
  actions?: ReactNode;
}) {
  return (
    <div className="stack">
      <div className="row" style={{ gap: 16 }}>
        <Avatar path={profile.avatar_path} size={76} />
        <div className="row grow">
          <Stat n={postCount} label="Fits" />
          <Stat n={stats.followers} label="Followers" />
          <Stat n={stats.following} label="Following" />
        </div>
      </div>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>{profile.display_name || profile.username}</div>
        <div className="muted">@{profile.username}</div>
        {profile.bio ? <p style={{ marginTop: 6 }}>{profile.bio}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function PostGrid({ posts }: { posts: FeedPost[] }) {
  return (
    <div className="grid-posts">
      {posts.map((p) => (
        <Link key={p.id} to={`/post/${p.id}`} aria-label="Open post">
          <StorageImg bucket="posts" path={p.image_path} alt={p.caption ?? 'Outfit'} />
        </Link>
      ))}
    </div>
  );
}
