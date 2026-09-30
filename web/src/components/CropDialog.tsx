import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

// Lets the user drag and zoom a photo inside a round frame, then returns the
// square crop as a JPEG. Used for profile pictures.
const VIEW = 280; // on-screen frame size in px
const OUT = 512; // saved image size in px

interface Props {
  file: Blob;
  onCancel: () => void;
  onDone: (cropped: Blob) => void;
}

export function CropDialog({ file, onCancel, onDone }: Props) {
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [url, setUrl] = useState<string>();
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string>();
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    let alive = true;
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    createImageBitmap(file, { imageOrientation: 'from-image' })
      .then((b) => (alive ? setBitmap(b) : b.close()))
      .catch(() => setError("Couldn't read that photo. Try another one."));
    return () => {
      alive = false;
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  useEffect(() => () => bitmap?.close(), [bitmap]);

  // Size of the photo on screen: the short side fills the frame at zoom 1.
  const base = bitmap ? VIEW / Math.min(bitmap.width, bitmap.height) : 1;
  const w = bitmap ? bitmap.width * base * zoom : VIEW;
  const h = bitmap ? bitmap.height * base * zoom : VIEW;

  function clamp(x: number, y: number, width = w, height = h) {
    const maxX = Math.max(0, (width - VIEW) / 2);
    const maxY = Math.max(0, (height - VIEW) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) };
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    setOffset(clamp(d.ox + e.clientX - d.x, d.oy + e.clientY - d.y));
  }

  function changeZoom(z: number) {
    setZoom(z);
    if (bitmap) setOffset((o) => clamp(o.x, o.y, bitmap.width * base * z, bitmap.height * base * z));
  }

  async function done() {
    if (!bitmap) return;
    const canvas = document.createElement('canvas');
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext('2d')!;
    // Map the frame back to photo pixels.
    const scale = base * zoom; // screen px per photo px
    const size = VIEW / scale;
    const sx = bitmap.width / 2 - (VIEW / 2 + offset.x) / scale;
    const sy = bitmap.height / 2 - (VIEW / 2 + offset.y) / scale;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, OUT, OUT);
    ctx.drawImage(bitmap, sx, sy, size, size, 0, 0, OUT, OUT);
    canvas.toBlob(
      (b) => (b ? onDone(b) : setError("Couldn't crop that photo. Try another one.")),
      'image/jpeg',
      0.85,
    );
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Crop your photo">
      <div className="modal stack">
        <h2 style={{ margin: 0 }}>Move and zoom</h2>
        <p className="muted small" style={{ margin: 0 }}>
          Drag the photo to choose what shows in your profile picture.
        </p>
        <div
          className="crop-frame"
          style={{ width: VIEW, height: VIEW }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        >
          {url && bitmap ? (
            <img
              src={url}
              alt=""
              draggable={false}
              style={{
                width: w,
                height: h,
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
              }}
            />
          ) : null}
          <div className="crop-mask" aria-hidden />
        </div>
        <label className="field">
          <span>Zoom</span>
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => changeZoom(parseFloat(e.target.value))}
            aria-label="Zoom"
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn primary" onClick={done} disabled={!bitmap}>
            Use photo
          </button>
        </div>
      </div>
    </div>
  );
}
