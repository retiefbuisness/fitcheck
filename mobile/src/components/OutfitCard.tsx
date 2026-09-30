import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { label } from '../lib/styleRules';
import { space, useTheme } from '../theme';
import { ClosetItem, OutfitIdea } from '../types';
import { Card, StorageImage } from './ui';

export function OutfitCard({
  idea,
  items,
  index,
  onSave,
  saved,
}: {
  idea: OutfitIdea;
  items: ClosetItem[];
  index: number;
  onSave?: () => void;
  saved?: boolean;
}) {
  const t = useTheme();
  const pieces = idea.itemIds.map((id) => items.find((it) => it.id === id)).filter(Boolean) as ClosetItem[];
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Text style={{ color: t.text, fontSize: 17, fontWeight: '800', flex: 1 }}>Outfit {index + 1}</Text>
        <Text style={{ color: t.muted, fontSize: 12 }}>
          {idea.source === 'ai' ? '✨ On-device AI' : 'Style rules'}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {pieces.map((it) => (
          <Pressable key={it.id} onPress={() => router.push(`/closet/${it.id}`)} style={{ width: '31%', gap: 4 }}>
            <StorageImage bucket="closet" path={it.image_path} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 10 }} />
            <Text numberOfLines={1} style={{ color: t.muted, fontSize: 12 }}>
              {label(it)}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={{ color: t.text, lineHeight: 20 }}>{idea.explanation}</Text>
      {onSave ? (
        <Pressable
          onPress={saved ? undefined : onSave}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}
          accessibilityRole="button"
        >
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={18} color={t.accent} />
          <Text style={{ color: t.accent, fontWeight: '700' }}>{saved ? 'Saved' : 'Save outfit'}</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}
