import { ReactNode, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { space, useTheme } from '../theme';
import { FeedPost, Profile } from '../types';
import { Avatar, StorageImage } from './ui';

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
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ color: t.text, fontSize: 18, fontWeight: '800' }}>{n}</Text>
      <Text style={{ color: t.muted, fontSize: 12 }}>{label}</Text>
    </View>
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
  const t = useTheme();
  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
        <Avatar path={profile.avatar_path} size={76} />
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <Stat n={postCount} label="Fits" />
          <Stat n={stats.followers} label="Followers" />
          <Stat n={stats.following} label="Following" />
        </View>
      </View>
      <View>
        <Text style={{ color: t.text, fontSize: 18, fontWeight: '800' }}>{profile.display_name || profile.username}</Text>
        <Text style={{ color: t.muted }}>@{profile.username}</Text>
        {profile.bio ? <Text style={{ color: t.text, marginTop: 6, lineHeight: 20 }}>{profile.bio}</Text> : null}
      </View>
      {actions}
    </View>
  );
}

export function PostGrid({ posts }: { posts: FeedPost[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
      {posts.map((p) => (
        <Pressable key={p.id} onPress={() => router.push(`/post/${p.id}`)} style={{ width: '32.5%' }} accessibilityLabel="Open post">
          <StorageImage bucket="posts" path={p.image_path} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 6 }} />
        </Pressable>
      ))}
    </View>
  );
}
