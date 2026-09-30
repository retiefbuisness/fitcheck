import { supabase } from './supabase';

// Supabase email links come back as fitcheck://path#access_token=...&refresh_token=...
export async function sessionFromUrl(url: string | null) {
  if (!url) return false;
  const fragment = url.includes('#') ? url.split('#')[1] : url.split('?')[1] ?? '';
  const params = new URLSearchParams(fragment);
  const errorDescription = params.get('error_description');
  if (errorDescription) throw new Error(errorDescription.replace(/\+/g, ' '));
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return false;
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
  return true;
}
