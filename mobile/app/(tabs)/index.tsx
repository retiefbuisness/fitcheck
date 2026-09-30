import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { PostCard } from '../../src/components/PostCard';
import { Chip, ChipRow, Empty } from '../../src/components/ui';
import { useUserId } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabase';
import { space, useTheme } from '../../src/theme';
import { FeedPost } from '../../src/types';

const PAGE = 15;
type Mode = 'following' | 'explore';

export default function Feed() {
  const t = useTheme();
  const userId = useUserId();
  const [mode, setMode] = useState<Mode>('explore');
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [done, setDone] = useState(false);
  const loadingMore = useRef(false);

  const fetchPage = useCallback(
    async (before?: string) => {
      let q = supabase.from('post_feed').select('*').order('created_at', { ascending: false }).limit(PAGE);
      if (before) q = q.lt('created_at', before);
      if (mode === 'following' && userId) {
        const { data: f } = await supabase.from('follows').select('following_id').eq('follower_id', userId);
        const ids = [userId, ...(f ?? []).map((r) => r.following_id)];
        q = q.in('user_id', ids);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as FeedPost[];
    },
    [mode, userId],
  );

  const reload = useCallback(async () => {
    try {
      const first = await fetchPage();
      setPosts(first);
      setDone(first.length < PAGE);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchPage]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  async function loadMore() {
    if (done || loadingMore.current || posts.length === 0) return;
    loadingMore.current = true;
    try {
      const more = await fetchPage(posts[posts.length - 1].created_at);
      setPosts((p) => [...p, ...more.filter((m) => !p.some((x) => x.id === m.id))]);
      if (more.length < PAGE) setDone(true);
    } finally {
      loadingMore.current = false;
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: space.lg, gap: space.lg }}
        ListHeaderComponent={
          <ChipRow>
            <Chip label="Explore" selected={mode === 'explore'} onPress={() => { setMode('explore'); setLoading(true); }} />
            <Chip label="Following" selected={mode === 'following'} onPress={() => { setMode('following'); setLoading(true); }} />
          </ChipRow>
        }
        renderItem={({ item }) => (
          <PostCard post={item} onChange={(p) => setPosts((all) => all.map((x) => (x.id === p.id ? p : x)))} />
        )}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={t.accent} style={{ marginTop: 48 }} />
          ) : mode === 'following' ? (
            <Empty icon="people-outline" title="No fits yet" body="Follow people from Explore to see their fits here." />
          ) : (
            <Empty icon="camera-outline" title="Be the first" body="Post your fit from the Fit check tab." />
          )
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); reload(); }} tintColor={t.accent} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
      />
    </View>
  );
}
