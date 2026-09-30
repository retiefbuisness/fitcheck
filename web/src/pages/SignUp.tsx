import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { LINKS, MIN_AGE } from '../config';
import { friendlyError, supabase } from '../lib/supabase';

function ageFrom(day: number, month: number, year: number): number | null {
  const dob = new Date(year, month - 1, day);
  if (dob.getFullYear() !== year || dob.getMonth() !== month - 1 || dob.getDate() !== day) return null;
  const now = new Date();
  let age = now.getFullYear() - year;
  if (now.getMonth() < month - 1 || (now.getMonth() === month - 1 && now.getDate() < day)) age--;
  return age >= 0 && age < 130 ? age : null;
}

const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;
const TODAY = new Date().toISOString().slice(0, 10);

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState<string>();
  const [displayName, setDisplayName] = useState('');
  const [dob, setDob] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [sentTo, setSentTo] = useState<string>();
  const [exists, setExists] = useState<'username' | 'email'>();

  async function checkUsername() {
    const u = username.trim().toLowerCase();
    if (!USERNAME_RE.test(u)) {
      setUsernameError('3-20 characters: letters, numbers, _ or .');
      return false;
    }
    const { data, error } = await supabase.rpc('username_available', { p_username: u });
    if (error) return true; // the server checks again on sign-up
    setUsernameError(data ? undefined : 'That username is taken');
    return !!data;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    const [y, m, d] = dob.split('-').map((n) => parseInt(n, 10));
    const age = y && m && d ? ageFrom(d, m, y) : null;
    if (age == null) return setError('Please enter your real date of birth.');
    if (age < MIN_AGE) return setError(`Sorry, Fit Check is only for people aged ${MIN_AGE} and over.`);
    if (password.length < 8) return setError('Use a password with at least 8 characters.');
    if (!accepted) return setError('Please accept the Terms of Use and Privacy Policy.');

    setBusy(true);
    if (!(await checkUsername())) {
      setBusy(false);
      if (USERNAME_RE.test(username.trim().toLowerCase())) setExists('username');
      return;
    }
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          username: username.trim().toLowerCase(),
          display_name: displayName.trim(),
          date_of_birth: dob,
          accepted_terms: true,
        },
      },
    });
    setBusy(false);
    if (error) {
      if (/already registered|already exists|duplicate key.*username|profiles_username_key/i.test(error.message)) {
        return setExists(/username/i.test(error.message) ? 'username' : 'email');
      }
      return setError(friendlyError(error));
    }
    // With email confirmation on, Supabase answers an existing email with a user that has no identities.
    if (data.user && data.user.identities?.length === 0) return setExists('email');
    if (!data.session) setSentTo(email.trim());
  }

  if (exists) {
    return (
      <div className="hero">
        <Link to="/welcome" className="brand">
          Fit<span>Check</span>
        </Link>
        <div className="stack">
          <h1>This account already exists</h1>
          <p className="muted">
            {exists === 'username' ? (
              <>
                Someone already has the username <strong>@{username.trim().toLowerCase()}</strong>. If it's yours, sign in.
                Otherwise go back and pick a different username.
              </>
            ) : (
              <>
                There's already a Fit Check account for <strong>{email.trim()}</strong>. Sign in instead, or go back and use a
                different email.
              </>
            )}
          </p>
          <Link to="/sign-in" className="btn primary block">
            Sign in
          </Link>
          <button type="button" className="btn ghost block" onClick={() => setExists(undefined)}>
            Sign up with different details
          </button>
        </div>
      </div>
    );
  }

  if (sentTo) {
    return (
      <div className="hero">
        <h1>Check your email</h1>
        <p>
          We sent a confirmation link to <strong>{sentTo}</strong>. Open it to finish creating your account, then sign in.
        </p>
        <Link to="/sign-in" className="btn primary block">
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="hero">
      <Link to="/welcome" className="brand">
        Fit<span>Check</span>
      </Link>
      <form className="stack" onSubmit={submit}>
        <h1>Create account</h1>
        <label className="field">
          <span>Email</span>
          <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="field">
          <span>Password (8+ characters)</span>
          <input className="input" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <label className="field">
          <span>Username</span>
          <input
            className="input"
            autoCapitalize="none"
            maxLength={20}
            value={username}
            onChange={(e) => {
              setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''));
              setUsernameError(undefined);
            }}
            onBlur={() => username && checkUsername()}
            required
          />
          {usernameError ? <span className="error">{usernameError}</span> : null}
        </label>
        <label className="field">
          <span>Display name (optional)</span>
          <input className="input" maxLength={40} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </label>
        <label className="field">
          <span>Date of birth</span>
          <input className="input" type="date" value={dob} max={TODAY} onChange={(e) => setDob(e.target.value)} required />
          <span className="muted tiny" style={{ fontWeight: 400 }}>
            Used only to confirm you’re 18+. We don’t store it.
          </span>
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
          <span>
            I’m 18 or older and I agree to the{' '}
            <a href={LINKS.terms} target="_blank" rel="noreferrer">
              Terms of Use
            </a>{' '}
            and{' '}
            <a href={LINKS.privacy} target="_blank" rel="noreferrer">
              Privacy Policy
            </a>
            .
          </span>
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn primary block" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
        <p className="muted small center">
          Already have an account? <Link to="/sign-in">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
