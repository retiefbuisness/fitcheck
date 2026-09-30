// Public configuration, safe to ship in the browser: the publishable key only
// allows what the database security rules allow. Can be overridden with
// VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY at build time.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://vtghnxijqqjuonzdinmr.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_rMtrTXN63O7A50jbSKry7Q_iMm6xmmH';

export const WEBSITE_URL = 'https://fitcheck-legal-two.vercel.app';

export const LINKS = {
  privacy: `${WEBSITE_URL}/privacy.html`,
  terms: `${WEBSITE_URL}/terms.html`,
  childSafety: `${WEBSITE_URL}/child-safety.html`,
  deleteAccount: `${WEBSITE_URL}/delete-account.html`,
};

export const SUPPORT_EMAIL = 'retiefbuisness@gmail.com';
export const MIN_AGE = 18;
