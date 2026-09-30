import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Alert } from 'react-native';
import { Body, Button, Input, Screen } from '../../src/components/ui';
import { friendlyError, supabase } from '../../src/lib/supabase';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) Alert.alert('Sign in failed', friendlyError(error));
  }

  async function forgot() {
    if (!email.trim()) {
      Alert.alert('Enter your email', 'Type your email address above first.');
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: Linking.createURL('/reset-password'),
    });
    if (error) Alert.alert('Something went wrong', friendlyError(error));
    else Alert.alert('Check your email', 'Open the link on this phone to choose a new password.');
  }

  return (
    <Screen edges={['bottom']}>
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <Input
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
      />
      <Button title="Sign in" onPress={signIn} loading={busy} disabled={!email || !password} />
      <Button title="Forgot password?" variant="ghost" onPress={forgot} />
      <Body muted style={{ fontSize: 13, textAlign: 'center' }}>
        Just signed up? Confirm your email first, then sign in here.
      </Body>
    </Screen>
  );
}
