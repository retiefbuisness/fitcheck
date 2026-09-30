import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { Body, Button, Screen } from '../../src/components/ui';
import { space, useTheme } from '../../src/theme';

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: 'shirt-outline', text: 'Build a digital closet of the clothes you own' },
  { icon: 'sparkles-outline', text: 'Get outfit ideas for any occasion' },
  { icon: 'star-outline', text: 'Get your fit rated with tips to level it up' },
  { icon: 'people-outline', text: 'Share fits, tag friends, and get inspired' },
];

export default function Welcome() {
  const t = useTheme();
  return (
    <Screen scroll={false} edges={['top', 'bottom']}>
      <View style={{ flex: 1, justifyContent: 'center', gap: space.xl }}>
        <View style={{ gap: space.sm }}>
          <Text style={{ fontSize: 44, fontWeight: '900', color: t.text, letterSpacing: -1.5 }}>
            Fit<Text style={{ color: t.accent }}>Check</Text>
          </Text>
          <Body muted>Your closet, your fits, your people.</Body>
        </View>
        <View style={{ gap: space.md }}>
          {FEATURES.map((f) => (
            <View key={f.text} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Ionicons name={f.icon} size={22} color={t.accent} />
              <Body style={{ flex: 1 }}>{f.text}</Body>
            </View>
          ))}
        </View>
      </View>
      <View style={{ gap: space.sm }}>
        <Button title="Create account" onPress={() => router.push('/sign-up')} />
        <Button title="I already have an account" variant="secondary" onPress={() => router.push('/sign-in')} />
        <Body muted style={{ textAlign: 'center', fontSize: 13, marginTop: space.sm }}>
          For adults 18+ only.
        </Body>
      </View>
    </Screen>
  );
}
