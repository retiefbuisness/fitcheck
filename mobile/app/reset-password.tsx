import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { Body, Button, Input, Screen } from '../src/components/ui';
import { sessionFromUrl } from '../src/lib/deeplink';
import { friendlyError, supabase } from '../src/lib/supabase';

export default function ResetPassword() {
  const url = Linking.useURL();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    sessionFromUrl(url)
      .then(async (ok) => {
        const { data } = await supabase.auth.getSession();
        setReady(ok || !!data.session);
      })
      .catch((e) => Alert.alert('Link expired', friendlyError(e)));
  }, [url]);

  async function save() {
    if (password.length < 8) return Alert.alert('Password too short', 'Use at least 8 characters.');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return Alert.alert("Couldn't update password", friendlyError(error));
    Alert.alert('Password updated', "You're all set.");
    router.replace('/');
  }

  return (
    <Screen edges={['bottom']}>
      {ready ? (
        <>
          <Input label="New password (8+ characters)" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
          <Button title="Save new password" onPress={save} loading={busy} />
        </>
      ) : (
        <Body muted>Open the reset link from your email on this phone to continue.</Body>
      )}
    </Screen>
  );
}
