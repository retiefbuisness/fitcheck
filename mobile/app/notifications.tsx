import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { timeAgo } from '../src/components/PostCard';
import { Avatar, Empty, Screen } from '../src/components/ui';
import { useUserId } from '../src/lib/auth';
import { supabase } from '../src/lib/supabase';
import { space, useTheme } from '../src/theme';
import { NotificationRow } from '../src/types';

const TEXT: Record<NotificationRow['type'], string> = {
  like: 'liked your fit',
  comment: 'commented on your fit',
  tag: 'tagged you in a fit',
  follow: 'started following you',
  rating: 'rated your fit',
};

export default function Notifications() {
  const t = useTheme();
  const me = useUserId();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!me) return;
    (async () => {
      const { data } = await supabase
        .from('notifications')
        .select('id, type, post_id, actor_id, read_at, created_at, actor:profiles!notifications_actor_id_fkey(username, display_name, avatar_path)')
        .eq('user_id', me)
        .order('created_at', { ascending: false })
        .limit(100);
      setRows((data ?? []) as unknown as NotificationRow[]);
      setLoaded(true);
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', me).is('read_at', null);
    })();
  }, [me]);

  return (
    <Screen edges={['bottom']}>
      {loaded && rows.length === 0 ? (
        <Empty icon="notifications-outline" title="Nothing yet" body="Likes, comments, tags and follows will show up here." />
      ) : null}
      {rows.map((n) => (
        <Pressable
          key={n.id}
          onPress={() => (n.post_id ? router.push(`/post/${n.post_id}`) : router.push(`/user/${n.actor_id}`))}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, opacity: n.read_at ? 0.75 : 1 }}
        >
          <Avatar path={n.actor?.avatar_path} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, lineHeight: 20 }}>
              <Text style={{ fontWeight: '700' }}>{n.actor?.display_name || n.actor?.username} </Text>
              {TEXT[n.type]}
            </Text>
            <Text style={{ color: t.muted, fontSize: 12 }}>{timeAgo(n.created_at)}</Text>
          </View>
          {!n.read_at ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.accent }} /> : null}
        </Pressable>
      ))}
    </Screen>
  );
}
