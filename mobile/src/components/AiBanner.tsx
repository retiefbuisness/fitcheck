import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { AiStatus, downloadAiModel, getAiStatus } from '../lib/ai';
import { radius, space, useTheme } from '../theme';
import { Button } from './ui';

export function useAiStatus() {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const refresh = useCallback(() => {
    getAiStatus().then(setStatus);
  }, []);
  useFocusEffect(refresh);
  return { status, refresh };
}

// Shows whether on-device AI is ready, and lets the user download it once.
export function AiBanner({ status, onChange }: { status: AiStatus | null; onChange: () => void }) {
  const t = useTheme();
  const [mb, setMb] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  if (status == null || status === 'available') return null;

  async function download() {
    setBusy(true);
    try {
      const ok = await downloadAiModel((bytes) => setMb(Math.round(bytes / 1_000_000)));
      if (!ok) Alert.alert('Download failed', 'Check your connection (Wi-Fi recommended) and try again.');
    } catch (e: any) {
      Alert.alert('Download failed', e?.message ?? 'Please try again later.');
    } finally {
      setBusy(false);
      setMb(null);
      onChange();
    }
  }

  const box = {
    flexDirection: 'row' as const,
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: t.soft,
  };

  if (status === 'unavailable') {
    return (
      <View style={box}>
        <Ionicons name="information-circle-outline" size={20} color={t.muted} />
        <Text style={{ color: t.muted, flex: 1, lineHeight: 19 }}>
          This phone doesn’t support on-device AI, so Fit Check uses its built-in style rules instead. Everything
          still works.
        </Text>
      </View>
    );
  }

  return (
    <View style={[box, { flexDirection: 'column' }]}>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Ionicons name="sparkles" size={20} color={t.accent} />
        <Text style={{ color: t.text, flex: 1, lineHeight: 19 }}>
          {status === 'downloading' || busy
            ? `Downloading the on-device AI${mb ? ` (${mb} MB)` : ''}… You can keep using the app.`
            : 'Your phone supports private on-device AI. Download it once (Wi-Fi recommended) for smarter ideas and ratings.'}
        </Text>
      </View>
      {status === 'downloadable' ? <Button title="Download AI" icon="download-outline" onPress={download} loading={busy} /> : null}
    </View>
  );
}
