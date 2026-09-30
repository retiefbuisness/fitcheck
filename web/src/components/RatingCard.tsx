import { CircleCheck, Lightbulb } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { RatingResult } from '../shared/types';
import { Stars } from './ui';

export function ratingToText(r: RatingResult) {
  return [r.summary, ...r.works.map((w) => `✓ ${w}`), ...r.improve.map((i) => `→ ${i}`)].filter(Boolean).join('\n');
}

export function RatingCard({ result }: { result: RatingResult }) {
  const navigate = useNavigate();
  return (
    <div className="card">
      <div className="row">
        <Stars value={result.rating} size={24} />
        <strong style={{ fontSize: 18 }}>{result.rating}/5</strong>
        <span className="grow" />
        <span className="muted tiny">{result.source === 'gemini_nano' ? 'On-device AI' : 'Style rules'}</span>
      </div>
      {result.summary ? <p style={{ fontWeight: 600 }}>{result.summary}</p> : null}
      {result.works.map((w, i) => (
        <div key={`w${i}`} className="row" style={{ alignItems: 'flex-start' }}>
          <CircleCheck size={18} color="var(--success)" style={{ flex: 'none', marginTop: 2 }} />
          <span>{w}</span>
        </div>
      ))}
      {result.improve.map((w, i) => (
        <div key={`i${i}`} className="row" style={{ alignItems: 'flex-start' }}>
          <Lightbulb size={18} color="var(--accent)" style={{ flex: 'none', marginTop: 2 }} />
          <span>{w}</span>
        </div>
      ))}
      <p className="muted tiny">Ratings are about the clothes only, and can be wrong.</p>
      {result.source === 'gemini_nano' ? (
        <button
          type="button"
          className="btn ghost small"
          style={{ alignSelf: 'flex-start', padding: 0, color: 'var(--muted)', textDecoration: 'underline' }}
          onClick={() => navigate('/report', { state: { type: 'ai_response', details: ratingToText(result) } })}
        >
          Report this AI response
        </button>
      ) : null}
    </div>
  );
}
