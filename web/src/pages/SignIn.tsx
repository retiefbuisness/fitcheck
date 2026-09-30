import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { friendlyError, supabase } from '../lib/supabase';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError(friendlyError(error));
  }

  async function forgot() {
    if (!email.trim()) return setError('Type your email address above first.');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) setError(friendlyError(error));
    else setNotice('Check your email for a link to choose a new password.');
  }

  return (
    <div className="hero">
      <Link to="/welcome" className="brand">
        Fit<span>Check</span>
      </Link>
      <form className="stack" onSubmit={submit}>
        <h1>Sign in</h1>
        <label className="field">
          <span>Email</span>
          <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="field">
          <span>Password</span>
          <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error ? <p className="error">{error}</p> : null}
        {notice ? <p className="small">{notice}</p> : null}
        <button className="btn primary block" disabled={busy || !email || !password}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <button type="button" className="btn ghost" onClick={forgot}>
          Forgot password?
        </button>
        <p className="muted small center">
          New here? <Link to="/sign-up">Create an account</Link>
        </p>
      </form>
    </div>
  );
}
