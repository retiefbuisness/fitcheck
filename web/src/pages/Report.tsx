import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useUserId } from '../lib/auth';
import { REPORT_REASONS, submitReport } from '../lib/social';
import { friendlyError } from '../lib/supabase';
import type { ReportTarget } from '../shared/types';

interface ReportState {
  type: ReportTarget;
  id?: string;
  details?: string;
}

export default function Report() {
  const userId = useUserId();
  const navigate = useNavigate();
  const state = useLocation().state as ReportState | null;
  const isAi = state?.type === 'ai_response';
  const [reason, setReason] = useState(isAi ? 'offensive_ai' : '');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  if (!state?.type) return <Navigate to="/" replace />;
  const reasons = isAi
    ? REPORT_REASONS.filter((r) => ['offensive_ai', 'harassment', 'hate', 'other'].includes(r.id))
    : REPORT_REASONS.filter((r) => r.id !== 'offensive_ai');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!userId || !reason) return;
    setBusy(true);
    try {
      const combined = [details.trim(), isAi && state!.details ? `AI response:\n${state!.details}` : ''].filter(Boolean).join('\n\n');
      const isNew = await submitReport({ userId, targetType: state!.type, targetId: state!.id, reason, details: combined });
      alert(
        !isNew
          ? "You've already reported this. Thanks, we're on it."
          : reason === 'minor_safety'
            ? "Thanks. We've hidden this content while we review it. If a child is in danger, contact the police."
            : "Thanks for reporting. We'll review it. You can also block the account to stop seeing it.",
      );
      navigate(-1);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <h1>Report</h1>
      <p className="muted">{isAi ? 'What was wrong with this AI response?' : 'Why are you reporting this?'} Reports are anonymous.</p>
      <div className="stack" style={{ gap: 4 }}>
        {reasons.map((r) => (
          <label key={r.id} className="checkbox" style={{ padding: '8px 0' }}>
            <input type="radio" name="reason" checked={reason === r.id} onChange={() => setReason(r.id)} />
            <span>{r.label}</span>
          </label>
        ))}
      </div>
      <textarea className="input" placeholder="Add details (optional)" maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
      {error ? <p className="error">{error}</p> : null}
      <button className="btn primary block" disabled={busy || !reason}>
        {busy ? 'Sending…' : 'Send report'}
      </button>
    </form>
  );
}
