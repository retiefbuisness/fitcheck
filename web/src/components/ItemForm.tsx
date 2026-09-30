import { COLORS } from '../shared/colors';
import { CATEGORIES, PATTERNS, type Category } from '../shared/types';
import { Chip } from './ui';

export interface ItemDraft {
  name: string;
  category: Category;
  color: string;
  secondary_color: string | null;
  pattern: string;
  formality: number;
  warmth: number;
  notes: string;
}

export const EMPTY_DRAFT: ItemDraft = {
  name: '',
  category: 'top',
  color: 'black',
  secondary_color: null,
  pattern: 'solid',
  formality: 2,
  warmth: 2,
  notes: '',
};

const FORMALITY = ['Very casual', 'Casual', 'Smart casual', 'Dressy', 'Formal'];
const WARMTH = ['Very light', 'Light', 'Medium', 'Warm', 'Very warm'];

function Scale({ value, labels, onChange }: { value: number; labels: string[]; onChange: (v: number) => void }) {
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="scale">
        {labels.map((l, i) => (
          <button key={l} type="button" className={i + 1 <= value ? 'on' : ''} aria-label={l} aria-pressed={value === i + 1} onClick={() => onChange(i + 1)} />
        ))}
      </div>
      <span className="muted small">{labels[value - 1]}</span>
    </div>
  );
}

function Swatches({ value, onChange, allowNone }: { value: string | null; onChange: (v: string | null) => void; allowNone?: boolean }) {
  return (
    <div className="swatches">
      {allowNone ? (
        <button type="button" className={value == null ? 'swatch selected' : 'swatch'} onClick={() => onChange(null)} aria-label="No second colour" style={{ background: 'var(--card)' }}>
          –
        </button>
      ) : null}
      {COLORS.map((c) => (
        <button
          key={c.name}
          type="button"
          className={value === c.name ? 'swatch selected' : 'swatch'}
          style={{ background: c.hex }}
          title={c.name}
          aria-label={c.name}
          aria-pressed={value === c.name}
          onClick={() => onChange(c.name)}
        />
      ))}
    </div>
  );
}

export function ItemForm({ draft, onChange }: { draft: ItemDraft; onChange: (d: ItemDraft) => void }) {
  const set = <K extends keyof ItemDraft>(k: K, v: ItemDraft[K]) => onChange({ ...draft, [k]: v });
  return (
    <div className="stack">
      <label className="field">
        <span>Name</span>
        <input className="input" placeholder="e.g. white linen shirt" value={draft.name} maxLength={60} onChange={(e) => set('name', e.target.value)} />
      </label>
      <h2>Type</h2>
      <div className="chips">
        {CATEGORIES.map((c) => (
          <Chip key={c.id} label={c.label} selected={draft.category === c.id} onClick={() => set('category', c.id)} />
        ))}
      </div>
      <h2>Main colour: {draft.color}</h2>
      <Swatches value={draft.color} onChange={(v) => set('color', v ?? 'black')} />
      <h2>Second colour{draft.secondary_color ? `: ${draft.secondary_color}` : ' (optional)'}</h2>
      <Swatches value={draft.secondary_color} onChange={(v) => set('secondary_color', v)} allowNone />
      <h2>Pattern</h2>
      <div className="chips">
        {PATTERNS.map((p) => (
          <Chip key={p} label={p} selected={draft.pattern === p} onClick={() => set('pattern', p)} />
        ))}
      </div>
      <h2>How dressy is it?</h2>
      <Scale value={draft.formality} labels={FORMALITY} onChange={(v) => set('formality', v)} />
      <h2>How warm is it?</h2>
      <Scale value={draft.warmth} labels={WARMTH} onChange={(v) => set('warmth', v)} />
      <label className="field">
        <span>Notes (optional)</span>
        <textarea className="input" value={draft.notes} maxLength={300} onChange={(e) => set('notes', e.target.value)} />
      </label>
      <p className="muted tiny">Your closet is private. Only you can see it.</p>
    </div>
  );
}
