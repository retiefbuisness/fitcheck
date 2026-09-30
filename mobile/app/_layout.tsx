import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Loading } from '../src/components/ui';
import { AuthProvider, useAuth } from '../src/lib/auth';
import { useTheme } from '../src/theme';

// Screens reachable without being signed in (besides the (auth) group).
const PUBLIC_ROUTES = ['auth-callback', 'reset-password'];

function Gate() {
  const t = useTheme();
  const { session, loading } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;
    const first = segments[0] as string | undefined;
    const inAuth = first === '(auth)';
    const isPublic = first != null && PUBLIC_ROUTES.includes(first);
    if (!session && !inAuth && !isPublic) router.replace('/welcome');
    else if (session && inAuth) router.replace('/');
  }, [session, loading, segments]);

  if (loading) return <Loading />;

  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: t.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="closet/add" options={{ title: 'Add to closet' }} />
        <Stack.Screen name="closet/[id]" options={{ title: 'Item' }} />
        <Stack.Screen name="post/[id]" options={{ title: 'Fit' }} />
        <Stack.Screen name="user/[id]" options={{ title: '' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="edit-profile" options={{ title: 'Edit profile' }} />
        <Stack.Screen name="blocked" options={{ title: 'Blocked accounts' }} />
        <Stack.Screen name="notifications" options={{ title: 'Activity' }} />
        <Stack.Screen name="saved-outfits" options={{ title: 'Saved outfits' }} />
        <Stack.Screen name="report" options={{ title: 'Report', presentation: 'modal' }} />
        <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password" options={{ title: 'New password' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
