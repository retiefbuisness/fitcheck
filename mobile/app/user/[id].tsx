import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, View } from 'react-native';
import { PostGrid, ProfileHeader, useProfileStats } from '../../src/components/ProfileHeader';
import { Body, Button, Empty, Loading, Screen } from '../../src/components/ui';
import { useUserId } from '../../src/lib/auth';
import { blockUser, setFollowing, unblockUser } from '../../src/lib/social';
import { friendlyError, supabase } from '../../src/lib/supabase';
import { space, useTheme } from '../../src/theme';
import { FeedPost, Profile } from '../../src/types';

export default function UserProfile() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useUserId();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [following, setFollowingState] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const stats = useProfileStats(id, refreshKey);

  const load = useCallback(async () => {
    if (!me) return;
    if (id === me) return router.replace('/profile');
    const [p, f, b, posts] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
      supabase.from('follows').select('following_id').eq('follower_id', me).eq('following_id', id).maybeSingle(),
      supabase.from('blocks').select('blocked_id').eq('blocker_id', me).eq('blocked_id', id).maybeSingle(),
      supabase.from('post_feed').select('*').eq('user_id', id).order('created_at', { ascending: false }),
    ]);
    if (!p.data) return router.back();
    setProfile(p.data as Profile);
    setFollowingState(!!f.data);
    setBlocked(!!b.data);
    setPosts((posts.data ?? []) as FeedPost[]);
  }, [id, me]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!profile || !me) return <Loading />;

  async function toggleFollow() {
    const next = !following;
    setFollowingState(next);
    try {
      await setFollowing(id, me!, next);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setFollowingState(!next);
      Alert.alert('Something went wrong', friendlyError(e));
    }
  }

  function confirmBlock() {
    Alert.alert(
      `Block @${profile!.username}?`,
      "They won't be able to see your posts or comments, and you won't see theirs. They won't be notified.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await blockUser(id, me!);
              await load();
            } catch (e) {
              Alert.alert("Couldn't block", friendlyError(e));
            }
          },
        },
      ],
    );
  }

  function menu() {
    const report = () => router.push({ pathname: '/report', params: { type: 'user', id } });
    const options = [blocked ? 'Unblock' : 'Block', 'Report', 'Cancel'];
    const handle = async (i: number) => {
      if (i === 0) {
        if (blocked) {
          await unblockUser(id, me!);
          load();
        } else confirmBlock();
      } else if (i === 1) report();
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: 2, destructiveButtonIndex: 0 }, handle);
    } else {
      Alert.alert(`@${profile!.username}`, undefined, [
        { text: options[0], style: 'destructive', onPress: () => handle(0) },
        { text: 'Report', onPress: () => handle(1) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }

  return (
    <Screen edges={[]}>
      <Stack.Screen
        options={{
          title: `@${profile.username}`,
          headerRight: () => (
            <Pressable onPress={menu} hitSlop={10} accessibilityLabel="More options">
              <Ionicons name="ellipsis-horizontal" size={24} color={t.text} />
            </Pressable>
          ),
        }}
      />
      <ProfileHeader
        profile={profile}
        postCount={posts.length}
        stats={stats}
        actions={
          blocked ? (
            <View style={{ gap: space.sm }}>
              <Body muted>You blocked this account.</Body>
              <Button title="Unblock" variant="secondary" onPress={async () => { await unblockUser(id, me); load(); }} />
            </View>
          ) : (
            <Button title={following ? 'Following' : 'Follow'} variant={following ? 'secondary' : 'primary'} onPress={toggleFollow} />
          )
        }
      />
      {blocked ? null : posts.length ? (
        <PostGrid posts={posts} />
      ) : (
        <Empty icon="camera-outline" title="No fits yet" />
      )}
    </Screen>
  );
}
