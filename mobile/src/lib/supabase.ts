import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Only refresh the session while the app is in the foreground.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

// Postgres raises readable messages from the sign-up checks; surface them.
export function friendlyError(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e);
  if (/18 or older/i.test(msg)) return 'You must be 18 or older to use Fit Check.';
  if (/date of birth/i.test(msg)) return 'Please enter a valid date of birth.';
  if (/accept the Terms/i.test(msg)) return 'Please accept the Terms of Use and Privacy Policy.';
  if (/duplicate key.*username|profiles_username_key/i.test(msg)) return 'That username is taken.';
  if (/Database error saving new user/i.test(msg))
    return 'We could not create your account. Check your details and try again.';
  if (/Invalid login credentials/i.test(msg)) return 'Wrong email or password.';
  if (/Email not confirmed/i.test(msg)) return 'Please confirm your email first. Check your inbox.';
  if (/network|fetch/i.test(msg)) return 'No connection. Check your internet and try again.';
  return msg;
}
