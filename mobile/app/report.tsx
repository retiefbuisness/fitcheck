import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Body, Button, Input, Screen } from '../src/components/ui';
import { useUserId } from '../src/lib/auth';
import { REPORT_REASONS, submitReport } from '../src/lib/social';
import { friendlyError } from '../src/lib/supabase';
import { space, useTheme } from '../src/theme';
import { ReportTarget } from '../src/types';

export default function Report() {
  const t = useTheme();
  const userId = useUserId();
  const params = useLocalSearchParams<{ type: ReportTarget; id?: string; details?: string }>();
  const isAi = params.type === 'ai_response';
  const [reason, setReason] = useState<string>(isAi ? 'offensive_ai' : '');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  const reasons = isAi
    ? REPORT_REASONS.filter((r) => ['offensive_ai', 'harassment', 'hate', 'other'].includes(r.id))
    : REPORT_REASONS.filter((r) => r.id !== 'offensive_ai');

  async function submit() {
    if (!userId || !reason) return;
    setBusy(true);
    try {
      const combined = [details.trim(), isAi && params.details ? `AI response:\n${params.details}` : '']
        .filter(Boolean)
        .join('\n\n');
      await submitReport({
        userId,
        targetType: params.type,
        targetId: params.id,
        reason,
        details: combined,
      });
      Alert.alert(
        'Thanks for reporting',
        reason === 'minor_safety'
          ? "We've hidden this content while we review it. If a child is in danger, contact the police."
          : "We'll review it. You can also block the account to stop seeing it.",
      );
      router.back();
    } catch (e) {
      Alert.alert("Couldn't send report", friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={['bottom']}>
      <Body muted>
        {isAi ? 'What was wrong with this AI response?' : 'Why are you reporting this?'} Reports are anonymous.
      </Body>
      <View style={{ gap: space.xs }}>
        {reasons.map((r) => (
          <Pressable
            key={r.id}
            onPress={() => setReason(r.id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: reason === r.id }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10 }}
          >
            <Ionicons name={reason === r.id ? 'radio-button-on' : 'radio-button-off'} size={22} color={t.accent} />
            <Text style={{ color: t.text, fontSize: 16 }}>{r.label}</Text>
          </Pressable>
        ))}
      </View>
      <Input placeholder="Add details (optional)" value={details} onChangeText={setDetails} maxLength={1000} multiline />
      <Button title="Send report" onPress={submit} loading={busy} disabled={!reason} />
    </Screen>
  );
}
