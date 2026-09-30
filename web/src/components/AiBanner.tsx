import { Info, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { downloadAiModel, getAiStatus, type AiStatus } from '../lib/ai';

export function useAiStatus() {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const refresh = useCallback(() => {
    getAiStatus().then(setStatus);
  }, []);
  useEffect(refresh, [refresh]);
  return { status, refresh };
}

// Shows whether the browser's on-device AI is ready and lets the user download it once.
export function AiBanner({ status, onChange }: { status: AiStatus | null; onChange: () => void }) {
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  if (status == null || status === 'available') return null;

  async function download() {
    setBusy(true);
    try {
      await downloadAiModel((f) => setProgress(Math.round(f * 100)));
    } catch (e) {
      alert(`Download failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
      setProgress(null);
      onChange();
    }
  }

  if (status === 'unavailable') {
    return (
      <div className="banner">
        <Info size={20} className="muted" style={{ flex: 'none' }} />
        <p className="muted small">
          This browser doesn’t have on-device AI, so Fit Check uses its built-in style rules. Everything still works. (On-device AI
          needs desktop Chrome on a powerful computer, or the Android app on a supported phone.)
        </p>
      </div>
    );
  }
  return (
    <div className="banner" style={{ flexDirection: 'column' }}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <Sparkles size={20} color="var(--accent)" style={{ flex: 'none' }} />
        <p className="small">
          {status === 'downloading' || busy
            ? `Downloading the on-device AI${progress != null ? ` (${progress}%)` : ''}… You can keep using Fit Check.`
            : 'Your browser supports private on-device AI. Download it once for smarter ideas and ratings.'}
        </p>
      </div>
      {status === 'downloadable' ? (
        <button type="button" className="btn primary" onClick={download} disabled={busy}>
          {busy ? 'Downloading…' : 'Download AI'}
        </button>
      ) : null}
    </div>
  );
}
