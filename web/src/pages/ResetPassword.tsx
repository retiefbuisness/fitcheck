import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Spinner } from '../components/ui';
import { useAuth } from '../lib/auth';
import { friendlyError, supabase } from '../lib/supabase';

// Landing page for the "reset your password" email link.
export default function ResetPassword() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError('Use at least 8 characters.');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(friendlyError(error));
    // Full reload clears the one-time "recovering" state.
    navigate('/', { replace: true });
    window.location.reload();
  }

  if (loading) return <Spinner />;
  return (
    <div className="hero">
      <h1>Choose a new password</h1>
      {session ? (
        <form className="stack" onSubmit={submit}>
          <label className="field">
            <span>New password (8+ characters)</span>
            <input className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button className="btn primary block" disabled={busy}>
            {busy ? 'Saving…' : 'Save new password'}
          </button>
        </form>
      ) : (
        <p className="muted">
          This link has expired or was already used. <Link to="/sign-in">Request a new one</Link>.
        </p>
      )}
    </div>
  );
}
