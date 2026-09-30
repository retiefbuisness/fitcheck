// Public app configuration. These values are safe to ship inside the app:
// the publishable key only allows what the database security rules allow.
export const SUPABASE_URL = 'https://vtghnxijqqjuonzdinmr.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_rMtrTXN63O7A50jbSKry7Q_iMm6xmmH';

// Where the legal pages in /website are hosted (Vercel project "fitcheck-legal").
export const WEBSITE_URL = 'https://fitcheck-legal-two.vercel.app';

export const LINKS = {
  privacy: `${WEBSITE_URL}/privacy.html`,
  terms: `${WEBSITE_URL}/terms.html`,
  childSafety: `${WEBSITE_URL}/child-safety.html`,
  deleteAccount: `${WEBSITE_URL}/delete-account.html`,
};

export const SUPPORT_EMAIL = 'retiefbuisness@gmail.com';

export const MIN_AGE = 18;
