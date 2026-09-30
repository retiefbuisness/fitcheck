import { Camera, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PostGrid, ProfileHeader, useProfileStats } from '../components/ProfileHeader';
import { Empty, Spinner } from '../components/ui';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import type { FeedPost } from '../shared/types';

export default function MyProfile() {
  const { profile, session } = useAuth();
  const userId = session?.user.id;
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const stats = useProfileStats(userId);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('post_feed')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data }) => setPosts((data ?? []) as FeedPost[]));
  }, [userId]);

  if (!profile) return <Spinner />;
  return (
    <>
      <ProfileHeader
        profile={profile}
        postCount={posts.length}
        stats={stats}
        actions={
          <div className="row">
            <Link to="/profile/edit" className="btn small grow">
              Edit profile
            </Link>
            <Link to="/settings" className="btn small grow">
              <Settings size={16} /> Settings
            </Link>
          </div>
        }
      />
      {posts.length ? (
        <PostGrid posts={posts} />
      ) : (
        <Empty icon={<Camera size={44} />} title="No fits yet" body="Post your first outfit from the Fit check tab." />
      )}
    </>
  );
}
