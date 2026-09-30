import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { PostGrid, ProfileHeader, useProfileStats } from '../../src/components/ProfileHeader';
import { Button, Empty, Loading, Screen } from '../../src/components/ui';
import { useAuth } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabase';
import { space } from '../../src/theme';
import { FeedPost } from '../../src/types';

export default function MyProfile() {
  const { profile, session, refreshProfile } = useAuth();
  const userId = session?.user.id;
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const stats = useProfileStats(userId, refreshKey);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      refreshProfile();
      setRefreshKey((k) => k + 1);
      supabase
        .from('post_feed')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .then(({ data }) => setPosts((data ?? []) as FeedPost[]));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]),
  );

  if (!profile) return <Loading />;

  return (
    <Screen edges={[]}>
      <ProfileHeader
        profile={profile}
        postCount={posts.length}
        stats={stats}
        actions={
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button title="Edit profile" variant="secondary" onPress={() => router.push('/edit-profile')} style={{ flex: 1 }} />
            <Button title="Settings" icon="settings-outline" variant="secondary" onPress={() => router.push('/settings')} style={{ flex: 1 }} />
          </View>
        }
      />
      {posts.length ? (
        <PostGrid posts={posts} />
      ) : (
        <Empty icon="camera-outline" title="No fits yet" body="Post your first outfit from the Fit check tab." />
      )}
    </Screen>
  );
}
