import { Ionicons } from '@expo/vector-icons';
import { Tabs, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ColorValue, Pressable, Text, View } from 'react-native';
import { useUserId } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';

function Bell() {
  const t = useTheme();
  const userId = useUserId();
  const [unread, setUnread] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('read_at', null)
        .then(({ count }) => setUnread(count ?? 0));
    }, [userId]),
  );

  return (
    <Pressable onPress={() => router.push('/notifications')} hitSlop={10} style={{ marginRight: 16 }} accessibilityLabel="Activity">
      <Ionicons name="notifications-outline" size={24} color={t.text} />
      {unread > 0 ? (
        <View
          style={{
            position: 'absolute',
            top: -4,
            right: -6,
            backgroundColor: t.danger,
            borderRadius: 9,
            minWidth: 18,
            height: 18,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 4,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{unread > 99 ? '99+' : unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

type IconName = keyof typeof Ionicons.glyphMap;
type TabIconProps = { color: ColorValue; focused: boolean; size: number };

function icon(name: IconName) {
  function TabIcon({ color, focused, size }: TabIconProps) {
    return <Ionicons name={(focused ? name : `${name}-outline`) as IconName} color={color} size={size} />;
  }
  return TabIcon;
}

export default function TabsLayout() {
  const t = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: t.bg },
        headerTintColor: t.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '800' },
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.muted,
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border },
        sceneStyle: { backgroundColor: t.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Feed', headerTitle: 'Fit Check', tabBarIcon: icon('home'), headerRight: Bell }}
      />
      <Tabs.Screen name="closet" options={{ title: 'Closet', tabBarIcon: icon('shirt') }} />
      <Tabs.Screen name="style" options={{ title: 'Style me', tabBarIcon: icon('sparkles') }} />
      <Tabs.Screen name="fitcheck" options={{ title: 'Fit check', tabBarIcon: icon('camera') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person') }} />
    </Tabs>
  );
}
