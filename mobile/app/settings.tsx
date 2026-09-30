import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, Linking, Pressable, Text, View } from 'react-native';
import { AiBanner, useAiStatus } from '../src/components/AiBanner';
import { Body, Button, Heading, Screen } from '../src/components/ui';
import { LINKS, SUPPORT_EMAIL } from '../src/config';
import { friendlyError, supabase } from '../src/lib/supabase';
import { space, useTheme } from '../src/theme';

function Row({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12 }}>
      <Ionicons name={icon} size={22} color={t.text} />
      <Text style={{ color: t.text, fontSize: 16, flex: 1 }}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={t.muted} />
    </Pressable>
  );
}

export default function Settings() {
  const t = useTheme();
  const { status, refresh } = useAiStatus();
  const [deleting, setDeleting] = useState(false);

  function confirmDelete() {
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your profile, closet, photos, posts, comments, likes and ratings. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete forever', style: 'destructive', onPress: deleteAccount },
      ],
    );
  }

  async function deleteAccount() {
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
      if (error) throw error;
      await supabase.auth.signOut({ scope: 'local' });
      Alert.alert('Account deleted', 'Your account and data have been deleted.');
    } catch (e) {
      Alert.alert("Couldn't delete account", `${friendlyError(e)}\n\nYou can also email ${SUPPORT_EMAIL}.`);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Screen edges={['bottom']}>
      <Heading>Account</Heading>
      <Row icon="person-circle-outline" label="Edit profile" onPress={() => router.push('/edit-profile')} />
      <Row icon="ban-outline" label="Blocked accounts" onPress={() => router.push('/blocked')} />

      <Heading>On-device AI</Heading>
      {status === 'available' ? (
        <Body muted>On-device AI is ready. Your photos stay on your phone when the AI looks at them.</Body>
      ) : (
        <AiBanner status={status} onChange={refresh} />
      )}

      <Heading>Help & legal</Heading>
      <Row icon="shield-checkmark-outline" label="Privacy Policy" onPress={() => WebBrowser.openBrowserAsync(LINKS.privacy)} />
      <Row icon="document-text-outline" label="Terms of Use" onPress={() => WebBrowser.openBrowserAsync(LINKS.terms)} />
      <Row icon="heart-outline" label="Child Safety Standards" onPress={() => WebBrowser.openBrowserAsync(LINKS.childSafety)} />
      <Row icon="mail-outline" label="Contact support" onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} />

      <View style={{ gap: space.sm, marginTop: space.lg }}>
        <Button title="Sign out" variant="secondary" onPress={() => supabase.auth.signOut()} />
        <Button title="Delete account" variant="danger" onPress={confirmDelete} loading={deleting} />
      </View>
      <Text style={{ color: t.muted, fontSize: 12, textAlign: 'center', marginTop: space.md }}>Fit Check · 18+ only</Text>
    </Screen>
  );
}
