import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Body, Button, Input, Screen } from '../../src/components/ui';
import { LINKS, MIN_AGE } from '../../src/config';
import { friendlyError, supabase } from '../../src/lib/supabase';
import { space, useTheme } from '../../src/theme';

function ageFrom(day: number, month: number, year: number): number | null {
  const dob = new Date(year, month - 1, day);
  if (dob.getFullYear() !== year || dob.getMonth() !== month - 1 || dob.getDate() !== day) return null;
  const now = new Date();
  let age = now.getFullYear() - year;
  const beforeBirthday = now.getMonth() < month - 1 || (now.getMonth() === month - 1 && now.getDate() < day);
  if (beforeBirthday) age--;
  return age >= 0 && age < 130 ? age : null;
}

const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;

export default function SignUp() {
  const t = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState<string>();
  const [displayName, setDisplayName] = useState('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);

  async function checkUsername(name = username) {
    const u = name.trim().toLowerCase();
    if (!USERNAME_RE.test(u)) {
      setUsernameError('3-20 characters: letters, numbers, _ or .');
      return false;
    }
    const { data, error } = await supabase.rpc('username_available', { p_username: u });
    if (error) return true; // the server will check again on sign-up
    setUsernameError(data ? undefined : 'That username is taken');
    return !!data;
  }

  async function submit() {
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    const age = ageFrom(d, m, y);
    if (age == null) return Alert.alert('Check your date of birth', 'Please enter a real date.');
    if (age < MIN_AGE) return Alert.alert('Sorry', `Fit Check is only for people aged ${MIN_AGE} and over.`);
    if (password.length < 8) return Alert.alert('Password too short', 'Use at least 8 characters.');
    if (!accepted) return Alert.alert('One more thing', 'Please accept the Terms of Use and Privacy Policy.');

    setBusy(true);
    if (!(await checkUsername())) {
      setBusy(false);
      return;
    }
    const dob = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: Linking.createURL('/auth-callback'),
        data: {
          username: username.trim().toLowerCase(),
          display_name: displayName.trim(),
          date_of_birth: dob,
          accepted_terms: true,
        },
      },
    });
    setBusy(false);
    if (error) return Alert.alert("Couldn't create account", friendlyError(error));
    if (!data.session) {
      Alert.alert('Confirm your email', `We sent a link to ${email.trim()}. Tap it on this phone, then sign in.`, [
        { text: 'OK', onPress: () => router.replace('/sign-in') },
      ]);
    }
  }

  const dobInput = { keyboardType: 'number-pad' as const, style: { textAlign: 'center' as const } };

  return (
    <Screen edges={['bottom']}>
      <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" />
      <Input label="Password (8+ characters)" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
      <Input
        label="Username"
        value={username}
        onChangeText={(v) => {
          setUsername(v.toLowerCase().replace(/[^a-z0-9_.]/g, ''));
          setUsernameError(undefined);
        }}
        onBlur={() => username && checkUsername()}
        autoCapitalize="none"
        maxLength={20}
        error={usernameError}
      />
      <Input label="Display name (optional)" value={displayName} onChangeText={setDisplayName} maxLength={40} />

      <View style={{ gap: 6 }}>
        <Text style={{ color: t.muted, fontSize: 13, fontWeight: '600' }}>Date of birth</Text>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Input placeholder="DD" value={day} onChangeText={setDay} maxLength={2} {...dobInput} />
          </View>
          <View style={{ flex: 1 }}>
            <Input placeholder="MM" value={month} onChangeText={setMonth} maxLength={2} {...dobInput} />
          </View>
          <View style={{ flex: 1.5 }}>
            <Input placeholder="YYYY" value={year} onChangeText={setYear} maxLength={4} {...dobInput} />
          </View>
        </View>
        <Text style={{ color: t.muted, fontSize: 12 }}>Used only to confirm you’re 18+. We don’t store it.</Text>
      </View>

      <Pressable
        onPress={() => setAccepted((a) => !a)}
        style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: accepted }}
      >
        <Ionicons name={accepted ? 'checkbox' : 'square-outline'} size={22} color={t.accent} />
        <Body style={{ flex: 1 }}>
          I’m 18 or older and I agree to the{' '}
          <Text style={{ color: t.accent, fontWeight: '700' }} onPress={() => WebBrowser.openBrowserAsync(LINKS.terms)}>
            Terms of Use
          </Text>{' '}
          and{' '}
          <Text style={{ color: t.accent, fontWeight: '700' }} onPress={() => WebBrowser.openBrowserAsync(LINKS.privacy)}>
            Privacy Policy
          </Text>
          .
        </Body>
      </Pressable>

      <Button
        title="Create account"
        onPress={submit}
        loading={busy}
        disabled={!email || !password || !username || !day || !month || !year}
      />
    </Screen>
  );
}
