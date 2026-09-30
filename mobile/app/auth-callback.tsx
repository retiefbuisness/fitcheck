import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Body, Button, Loading, Screen } from '../src/components/ui';
import { sessionFromUrl } from '../src/lib/deeplink';

// Landing screen for the "confirm your email" link.
export default function AuthCallback() {
  const url = Linking.useURL();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!url) return;
    sessionFromUrl(url)
      .then((ok) => router.replace(ok ? '/' : '/sign-in'))
      .catch((e) => setError(e.message));
  }, [url]);

  if (!error) return <Loading />;
  return (
    <Screen>
      <Body>That link didn’t work: {error}</Body>
      <Button title="Go to sign in" onPress={() => router.replace('/sign-in')} />
    </Screen>
  );
}
