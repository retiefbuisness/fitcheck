import { Bookmark, BookmarkCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { label } from '../shared/styleRules';
import type { ClosetItem, OutfitIdea } from '../shared/types';
import { StorageImg } from './ui';

export function OutfitCard({
  idea,
  items,
  index,
  onSave,
  saved,
}: {
  idea: OutfitIdea;
  items: ClosetItem[];
  index: number;
  onSave?: () => void;
  saved?: boolean;
}) {
  const pieces = idea.itemIds.map((id) => items.find((it) => it.id === id)).filter((x): x is ClosetItem => !!x);
  return (
    <div className="card">
      <div className="row spread">
        <strong style={{ fontSize: 17 }}>Outfit {index + 1}</strong>
        <span className="muted tiny">{idea.source === 'ai' ? '✨ On-device AI' : 'Style rules'}</span>
      </div>
      <div className="grid3">
        {pieces.map((it) => (
          <Link key={it.id} to={`/closet/${it.id}`} className="tile">
            <StorageImg bucket="closet" path={it.image_path} alt={label(it)} />
            <span className="caption">{label(it)}</span>
          </Link>
        ))}
      </div>
      <p>{idea.explanation}</p>
      {onSave ? (
        <button type="button" className="btn ghost small" style={{ alignSelf: 'flex-start', padding: 0 }} onClick={saved ? undefined : onSave}>
          {saved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />} {saved ? 'Saved' : 'Save outfit'}
        </button>
      ) : null}
    </div>
  );
}
