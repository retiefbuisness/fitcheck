import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { space, useTheme } from '../theme';
import { RatingResult } from '../types';
import { Card, Stars } from './ui';

export function ratingToText(r: RatingResult) {
  return [
    r.summary,
    ...r.works.map((w) => `✓ ${w}`),
    ...r.improve.map((i) => `→ ${i}`),
  ]
    .filter(Boolean)
    .join('\n');
}

export function RatingCard({ result, reportable = true }: { result: RatingResult; reportable?: boolean }) {
  const t = useTheme();
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Stars value={result.rating} size={24} />
        <Text style={{ color: t.text, fontSize: 18, fontWeight: '800' }}>{result.rating}/5</Text>
        <View style={{ flex: 1 }} />
        <Text style={{ color: t.muted, fontSize: 12 }}>
          {result.source === 'gemini_nano' ? 'On-device AI' : 'Style rules'}
        </Text>
      </View>
      {result.summary ? <Text style={{ color: t.text, fontSize: 15, fontWeight: '600' }}>{result.summary}</Text> : null}
      {result.works.map((w, i) => (
        <View key={`w${i}`} style={{ flexDirection: 'row', gap: space.sm }}>
          <Ionicons name="checkmark-circle" size={18} color={t.success} />
          <Text style={{ color: t.text, flex: 1, lineHeight: 20 }}>{w}</Text>
        </View>
      ))}
      {result.improve.map((w, i) => (
        <View key={`i${i}`} style={{ flexDirection: 'row', gap: space.sm }}>
          <Ionicons name="bulb-outline" size={18} color={t.accent} />
          <Text style={{ color: t.text, flex: 1, lineHeight: 20 }}>{w}</Text>
        </View>
      ))}
      <Text style={{ color: t.muted, fontSize: 12, marginTop: space.xs }}>
        Ratings are about the clothes only, and can be wrong.
      </Text>
      {reportable && result.source === 'gemini_nano' ? (
        <Pressable
          onPress={() =>
            router.push({ pathname: '/report', params: { type: 'ai_response', details: ratingToText(result) } })
          }
          hitSlop={8}
          accessibilityRole="button"
        >
          <Text style={{ color: t.muted, fontSize: 13, textDecorationLine: 'underline' }}>Report this AI response</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}
