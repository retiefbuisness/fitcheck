import { Ban, ChevronRight, FileText, HeartHandshake, Mail, ShieldCheck, UserPen } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AiBanner, useAiStatus } from '../components/AiBanner';
import { LINKS, SUPPORT_EMAIL } from '../config';
import { friendlyError, supabase } from '../lib/supabase';

function Row({ icon, label, to, href }: { icon: ReactNode; label: string; to?: string; href?: string }) {
  const content = (
    <>
      {icon}
      <span className="grow">{label}</span>
      <ChevronRight size={18} className="muted" />
    </>
  );
  return to ? (
    <Link to={to} className="list-row">
      {content}
    </Link>
  ) : (
    <a href={href} className="list-row" target={href?.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
      {content}
    </a>
  );
}

export default function Settings() {
  const { status, refresh } = useAiStatus();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string>();

  async function deleteAccount() {
    const ok = confirm(
      'Delete your account? This permanently deletes your profile, closet, photos, posts, comments, likes and ratings. This cannot be undone.',
    );
    if (!ok) return;
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
      if (error) throw error;
      await supabase.auth.signOut({ scope: 'local' });
      alert('Your account and data have been deleted.');
    } catch (e) {
      setError(`${friendlyError(e)} You can also email ${SUPPORT_EMAIL}.`);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <h1>Settings</h1>
      <h2>Account</h2>
      <div>
        <Row icon={<UserPen size={22} />} label="Edit profile" to="/profile/edit" />
        <Row icon={<Ban size={22} />} label="Blocked accounts" to="/settings/blocked" />
      </div>
      <h2>On-device AI</h2>
      {status === 'available' ? (
        <p className="muted">On-device AI is ready. Your photos stay on your device when the AI looks at them.</p>
      ) : (
        <AiBanner status={status} onChange={refresh} />
      )}
      <h2>Help & legal</h2>
      <div>
        <Row icon={<ShieldCheck size={22} />} label="Privacy Policy" href={LINKS.privacy} />
        <Row icon={<FileText size={22} />} label="Terms of Use" href={LINKS.terms} />
        <Row icon={<HeartHandshake size={22} />} label="Child Safety Standards" href={LINKS.childSafety} />
        <Row icon={<Mail size={22} />} label="Contact support" href={`mailto:${SUPPORT_EMAIL}`} />
      </div>
      <div className="stack" style={{ gap: 8, marginTop: 16 }}>
        <button type="button" className="btn block" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
        <button type="button" className="btn danger block" onClick={deleteAccount} disabled={deleting}>
          {deleting ? 'Deleting…' : 'Delete account'}
        </button>
        {error ? <p className="error">{error}</p> : null}
      </div>
      <p className="muted tiny center">Fit Check · 18+ only</p>
    </>
  );
}
