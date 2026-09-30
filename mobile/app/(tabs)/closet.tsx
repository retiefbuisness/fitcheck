import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { Chip, Empty, StorageImage } from '../../src/components/ui';
import { useUserId } from '../../src/lib/auth';
import { label } from '../../src/lib/styleRules';
import { supabase } from '../../src/lib/supabase';
import { space, useTheme } from '../../src/theme';
import { CATEGORIES, Category, ClosetItem } from '../../src/types';

export default function Closet() {
  const t = useTheme();
  const userId = useUserId();
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Category | 'all'>('all');

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      supabase
        .from('closet_items')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          setItems((data ?? []) as ClosetItem[]);
          setLoading(false);
        });
    }, [userId]),
  );

  const shown = useMemo(() => (filter === 'all' ? items : items.filter((i) => i.category === filter)), [items, filter]);
  const usedCats = CATEGORIES.filter((c) => items.some((i) => i.category === c.id));

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ paddingTop: space.md }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg }}>
          <Chip label={`All (${items.length})`} selected={filter === 'all'} onPress={() => setFilter('all')} />
          {usedCats.map((c) => (
            <Chip key={c.id} label={c.label} selected={filter === c.id} onPress={() => setFilter(c.id)} />
          ))}
          <Chip label="Saved outfits" onPress={() => router.push('/saved-outfits')} />
        </ScrollView>
      </View>

      <FlatList
        data={shown}
        numColumns={3}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: space.lg, gap: space.sm, paddingBottom: 96 }}
        columnWrapperStyle={{ gap: space.sm }}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/closet/${item.id}`)} style={{ width: '32%', gap: 4 }} accessibilityLabel={label(item)}>
            <StorageImage bucket="closet" path={item.image_path} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 12 }} />
            <Text numberOfLines={1} style={{ color: t.muted, fontSize: 12 }}>
              {label(item)}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={t.accent} style={{ marginTop: 48 }} />
          ) : (
            <Empty
              icon="shirt-outline"
              title="Your closet is empty"
              body="Snap the clothes you own to get outfit ideas. Start with a few tops, bottoms and shoes."
            />
          )
        }
      />

      <Pressable
        onPress={() => router.push('/closet/add')}
        accessibilityLabel="Add clothing item"
        style={{
          position: 'absolute',
          right: space.lg,
          bottom: space.lg,
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: t.accent,
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 4,
        }}
      >
        <Ionicons name="add" size={32} color={t.accentText} />
      </Pressable>
    </View>
  );
}
