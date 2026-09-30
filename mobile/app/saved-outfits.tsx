import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, Text } from 'react-native';
import { OutfitCard } from '../src/components/OutfitCard';
import { Empty, Screen } from '../src/components/ui';
import { useUserId } from '../src/lib/auth';
import { supabase } from '../src/lib/supabase';
import { useTheme } from '../src/theme';
import { ClosetItem } from '../src/types';

interface SavedRow {
  id: string;
  item_ids: string[];
  occasion: string | null;
  explanation: string | null;
  source: 'ai' | 'rules';
}

export default function SavedOutfits() {
  const t = useTheme();
  const me = useUserId();
  const [rows, setRows] = useState<SavedRow[]>([]);
  const [closet, setCloset] = useState<ClosetItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!me) return;
    const [s, c] = await Promise.all([
      supabase.from('saved_outfits').select('*').eq('user_id', me).order('created_at', { ascending: false }),
      supabase.from('closet_items').select('*').eq('user_id', me),
    ]);
    setRows((s.data ?? []) as SavedRow[]);
    setCloset((c.data ?? []) as ClosetItem[]);
    setLoaded(true);
  }, [me]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function remove(id: string) {
    Alert.alert('Remove saved outfit?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('saved_outfits').delete().eq('id', id);
          load();
        },
      },
    ]);
  }

  return (
    <Screen edges={['bottom']}>
      {loaded && rows.length === 0 ? (
        <Empty icon="bookmark-outline" title="No saved outfits" body="Save ideas from the Style me tab to find them here." />
      ) : null}
      {rows.map((r, i) => (
        <Pressable key={r.id} onLongPress={() => remove(r.id)}>
          {r.occasion ? <Text style={{ color: t.muted, marginBottom: 6 }}>{r.occasion} · hold to remove</Text> : null}
          <OutfitCard
            idea={{ itemIds: r.item_ids, explanation: r.explanation ?? '', source: r.source }}
            items={closet}
            index={i}
          />
        </Pressable>
      ))}
    </Screen>
  );
}
