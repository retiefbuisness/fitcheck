import { Camera, ImagePlus, Shirt, Star, StarHalf, User } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { useSignedUrl, type Bucket } from '../lib/images';

export function Spinner({ inline }: { inline?: boolean }) {
  return <div className={inline ? 'spinner inline' : 'spinner'} role="status" aria-label="Loading" />;
}

export function Empty({ icon, title, body }: { icon: ReactNode; title: string; body?: string }) {
  return (
    <div className="empty">
      {icon}
      <strong>{title}</strong>
      {body ? <p>{body}</p> : null}
    </div>
  );
}

export function StorageImg({
  bucket,
  path,
  className = 'thumb',
  alt = '',
}: {
  bucket: Bucket;
  path: string | null | undefined;
  className?: string;
  alt?: string;
}) {
  const url = useSignedUrl(bucket, path);
  if (!url) {
    return (
      <div className={`${className} placeholder`} aria-hidden>
        {path ? null : <Shirt size={28} />}
      </div>
    );
  }
  return <img src={url} alt={alt} className={className} loading="lazy" />;
}

export function Avatar({ path, size = 36 }: { path: string | null | undefined; size?: number }) {
  const url = useSignedUrl('avatars', path);
  const style = { width: size, height: size };
  if (!url) {
    return (
      <span className="avatar" style={style} aria-hidden>
        <User size={size * 0.5} />
      </span>
    );
  }
  return <img src={url} alt="" className="avatar" style={style} />;
}

export function Stars({
  value,
  size = 18,
  onChange,
}: {
  value: number | null | undefined;
  size?: number;
  onChange?: (v: number) => void;
}) {
  const v = value ?? 0;
  return (
    <span className="stars" aria-label={`${v} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const icon =
          v >= n ? (
            <Star size={size} fill="currentColor" />
          ) : v >= n - 0.5 ? (
            <StarHalf size={size} fill="currentColor" />
          ) : (
            <Star size={size} />
          );
        return onChange ? (
          <button key={n} type="button" onClick={() => onChange(n)} aria-label={`Rate ${n} stars`}>
            {icon}
          </button>
        ) : (
          <span key={n}>{icon}</span>
        );
      })}
    </span>
  );
}

export function Chip({ label, selected, onClick }: { label: string; selected?: boolean; onClick?: () => void }) {
  return (
    <button type="button" className={selected ? 'chip selected' : 'chip'} aria-pressed={!!selected} onClick={onClick}>
      {label}
    </button>
  );
}

// "Camera" opens the phone camera directly; "Photos" opens the gallery / file picker.
export function PhotoButtons({ onPick }: { onPick: (file: File) => void }) {
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onPick(file);
  };
  return (
    <div className="row">
      <button type="button" className="btn grow" onClick={() => camera.current?.click()}>
        <Camera size={18} /> Camera
      </button>
      <button type="button" className="btn grow" onClick={() => library.current?.click()}>
        <ImagePlus size={18} /> Photos
      </button>
      <input ref={camera} type="file" accept="image/*" capture="environment" className="visually-hidden" onChange={handle} />
      <input ref={library} type="file" accept="image/*" className="visually-hidden" onChange={handle} />
    </div>
  );
}
