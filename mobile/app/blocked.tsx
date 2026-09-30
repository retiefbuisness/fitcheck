import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { Avatar, Button, Empty, Screen } from '../src/components/ui';
import { useUserId } from '../src/lib/auth';
import { unblockUser } from '../src/lib/social';
import { supabase } from '../src/lib/supabase';
import { space, useTheme } from '../src/theme';

interface BlockRow {
  blocked_id: string;
  profile: { username: string; avatar_path: string | null } | null;
}

export default function Blocked() {
  const t = useTheme();
  const me = useUserId();
  const [rows, setRows] = useState<BlockRow[]>([]);

  const load = useCallback(async () => {
    if (!me) return;
    const { data } = await supabase
      .from('blocks')
      .select('blocked_id, profile:profiles!blocks_blocked_id_fkey(username, avatar_path)')
      .eq('blocker_id', me);
    setRows((data ?? []) as unknown as BlockRow[]);
  }, [me]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <Screen edges={['bottom']}>
      {rows.length === 0 ? <Empty icon="ban-outline" title="No blocked accounts" /> : null}
      {rows.map((r) => (
        <View key={r.blocked_id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Avatar path={r.profile?.avatar_path} />
          <Text style={{ color: t.text, flex: 1, fontWeight: '600' }}>@{r.profile?.username}</Text>
          <Button
            title="Unblock"
            variant="secondary"
            onPress={async () => {
              await unblockUser(r.blocked_id, me!);
              load();
            }}
          />
        </View>
      ))}
    </Screen>
  );
}
