// "Smart photos" for closet items, all on the user's own device:
//  1. find the clothing in the photo (even on a hanger or worn by someone), cut it out
//     and put it on a clean white background (skipped if it's already on plain white)
//  2. recognise what it is (type, colour, pattern) so the form fills itself in
// The background removal runs here; the clothing AI runs in a background worker at
// the same time (smartWorker.ts). Models download once, then the browser caches them.
// It's on by default and can be turned off. Photos never leave the device for this.
import { colorByName, colorDistance, nearestColorName } from '../shared/colors';
import type { Category } from '../shared/types';
import type { Classification, PartsResult } from './smartAi';
import type { WorkerRequest, WorkerResponse } from './smartWorker';

const BG_REMOVAL_URL = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm';
const SETTING_KEY = 'fitcheck.smartPhotos.v2'; // v2: on by default (v1 was opt-in)

export const SMART_DOWNLOAD_MB = 130;

export type SmartSetting = 'on' | 'off' | null;

export function getSmartSetting(): SmartSetting {
  try {
    const v = localStorage.getItem(SETTING_KEY);
    return v === 'on' || v === 'off' ? v : null;
  } catch {
    return null;
  }
}

export function setSmartSetting(v: 'on' | 'off') {
  try {
    localStorage.setItem(SETTING_KEY, v);
  } catch {
    // Private mode etc. The choice just won't be remembered.
  }
}

// ---------- The background worker (clothing AI) ----------

let worker: Worker | null = null;
let nextId = 1;
const waiting = new Map<number, (r: WorkerResponse) => void>();

type Ok = Extract<WorkerResponse, { ok: true }>;
type Request = WorkerRequest extends infer R ? (R extends { id: number } ? Omit<R, 'id'> : never) : never;

function ask(req: Request): Promise<Ok> {
  worker ??= (() => {
    const w = new Worker(new URL('./smartWorker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<WorkerResponse>) => {
      waiting.get(e.data.id)?.(e.data);
      waiting.delete(e.data.id);
    };
    return w;
  })();
  const id = nextId++;
  return new Promise((resolve, reject) => {
    waiting.set(id, (r) => (r.ok ? resolve(r) : reject(new Error(r.error))));
    worker!.postMessage({ ...req, id });
  });
}

// ---------- Background removal (runs on the page) ----------

type BgModule = {
  removeBackground: (image: Blob, config?: object) => Promise<Blob>;
  preload?: (config?: object) => Promise<void>;
};
const BG_CONFIG = { model: 'isnet_quint8', output: { format: 'image/png' } };
let bgModule: Promise<BgModule> | null = null;
const ready = { bg: false, ai: false };

function loadBgRemoval() {
  bgModule ??= import(/* @vite-ignore */ BG_REMOVAL_URL) as Promise<BgModule>;
  bgModule.catch(() => (bgModule = null));
  return bgModule;
}

// True once all the AI models are downloaded and loaded in this session.
export function smartPhotosReady() {
  return ready.bg && ready.ai;
}

// Starts the one-off downloads early (e.g. when the Add screen opens) so the
// photo is ready to scan by the time the user has picked one.
export function warmUpSmartPhotos() {
  loadBgRemoval()
    .then((m) => m.preload?.(BG_CONFIG))
    .then(() => (ready.bg = true))
    .catch(() => {});
  ask({ type: 'warm' })
    .then(() => (ready.ai = true))
    .catch(() => {});
}

// ---------- Helpers ----------

// A named colour and how much of the item it covers (0-1).
export interface ColorShare {
  name: string;
  share: number;
}

// One piece of clothing cut out of the photo.
export interface CleanPiece {
  label: string; // e.g. "Top", "Trousers" (empty if we couldn't tell)
  clean: Blob; // the piece on white, 3:4 JPEG
  colors: ColorShare[]; // its main colours, biggest first
}

function canvas2d(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext('2d', { willReadFrequently: true })! };
}

function toBlob(c: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't save the photo."))), type, quality),
  );
}

// Grows a 0/1 mask by r pixels, so the cut doesn't clip the edges of the clothing.
function dilate(mask: Uint8Array, w: number, h: number, r: number) {
  const tmp = new Uint8Array(mask.length);
  const out = new Uint8Array(mask.length);
  // Two sweeps per row (then per column): nearest set pixel on each side.
  for (let y = 0; y < h; y++) {
    let last = -Infinity;
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x]) last = x;
      if (x - last <= r) tmp[y * w + x] = 1;
    }
    last = Infinity;
    for (let x = w - 1; x >= 0; x--) {
      if (mask[y * w + x]) last = x;
      if (last - x <= r) tmp[y * w + x] = 1;
    }
  }
  for (let x = 0; x < w; x++) {
    let last = -Infinity;
    for (let y = 0; y < h; y++) {
      if (tmp[y * w + x]) last = y;
      if (y - last <= r) out[y * w + x] = 1;
    }
    last = Infinity;
    for (let y = h - 1; y >= 0; y--) {
      if (tmp[y * w + x]) last = y;
      if (last - y <= r) out[y * w + x] = 1;
    }
  }
  return out;
}

// Scales a small 0/1 mask up to the photo's size with smooth edges (0-255).
function upscale(mask: Uint8Array, w: number, h: number, W: number, H: number) {
  const small = canvas2d(w, h);
  const img = small.ctx.createImageData(w, h);
  for (let i = 0; i < mask.length; i++) img.data[i * 4 + 3] = mask[i] ? 255 : 0;
  small.ctx.putImageData(img, 0, 0);
  const big = canvas2d(W, H);
  big.ctx.imageSmoothingQuality = 'high';
  big.ctx.drawImage(small.c, 0, 0, W, H);
  const data = big.ctx.getImageData(0, 0, W, H).data;
  const out = new Uint8ClampedArray(W * H);
  for (let i = 0; i < out.length; i++) out[i] = data[i * 4 + 3];
  return out;
}

// Finds the "holes" in a shape: empty areas completely surrounded by the shape
// (not connected to the edge of the photo). Returns a 0/1 map of those pixels.
// With maxShare, only holes smaller than that share of the photo count.
function enclosed(filled: (i: number) => boolean, w: number, h: number, maxShare = 1) {
  const outside = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (i: number) => {
    if (!outside[i] && !filled(i)) {
      outside[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < w * (h - 1)) push(i + w);
  }
  const holes = new Uint8Array(w * h);
  for (let i = 0; i < holes.length; i++) if (!outside[i] && !filled(i)) holes[i] = 1;
  if (maxShare >= 1) return holes;
  // Leave big gaps open (e.g. inside a bag handle): only fill holes up to maxShare of the photo.
  const seen = new Uint8Array(w * h);
  const limit = w * h * maxShare;
  for (let start = 0; start < holes.length; start++) {
    if (!holes[start] || seen[start]) continue;
    const part: number[] = [start];
    seen[start] = 1;
    for (let k = 0; k < part.length; k++) {
      const i = part[k];
      const x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
        if (j >= 0 && j < holes.length && holes[j] && !seen[j]) {
          seen[j] = 1;
          part.push(j);
        }
      }
    }
    if (part.length > limit) for (const i of part) holes[i] = 0;
  }
  return holes;
}

// Makes the cut-out solid: the background remover sometimes makes bright parts of
// the clothing see-through or leaves holes in it, which would show up as white
// patches. Edges stay soft; the inside becomes fully solid and holes are filled.
function solidify(alpha: Uint8ClampedArray, W: number, H: number) {
  const out = new Uint8ClampedArray(alpha.length);
  for (let i = 0; i < alpha.length; i++) out[i] = Math.min(255, Math.max(0, ((alpha[i] - 30) * 255) / 110));
  const holes = enclosed((i) => out[i] > 40, W, H, 0.02);
  for (let i = 0; i < holes.length; i++) if (holes[i]) out[i] = 255;
  return out;
}

// Puts the visible part of the photo (alpha 0-255 per pixel) on a white 3:4 canvas.
async function compose(pixels: Uint8ClampedArray, alpha: Uint8ClampedArray, W: number, H: number) {
  let minX = W;
  let minY = H;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      if (alpha[y * W + x] > 40) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0 || (maxX - minX) * (maxY - minY) < W * H * 0.01) return null;

  const cut = canvas2d(W, H);
  const img = cut.ctx.createImageData(W, H);
  for (let i = 0; i < alpha.length; i++) {
    img.data[i * 4] = pixels[i * 4];
    img.data[i * 4 + 1] = pixels[i * 4 + 1];
    img.data[i * 4 + 2] = pixels[i * 4 + 2];
    img.data[i * 4 + 3] = alpha[i];
  }
  cut.ctx.putImageData(img, 0, 0);

  const boxW = maxX - minX + 1;
  const boxH = maxY - minY + 1;
  const OUT_W = 900;
  const OUT_H = 1200;
  const out = canvas2d(OUT_W, OUT_H);
  out.ctx.fillStyle = '#ffffff';
  out.ctx.fillRect(0, 0, OUT_W, OUT_H);
  const scale = Math.min((OUT_W * 0.86) / boxW, (OUT_H * 0.86) / boxH);
  const dw = boxW * scale;
  const dh = boxH * scale;
  out.ctx.imageSmoothingQuality = 'high';
  out.ctx.drawImage(cut.c, minX, minY, boxW, boxH, (OUT_W - dw) / 2, (OUT_H - dh) / 2, dw, dh);
  return { clean: await toBlob(out.c, 'image/jpeg', 0.85), colors: itemColors(img.data, W, H) };
}

// Main named colours among the visible pixels, biggest first.
function itemColors(data: Uint8ClampedArray, width: number, height: number): ColorShare[] {
  const buckets = new Map<number, [number, number, number, number]>();
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 30000)));
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 200) continue;
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const acc = buckets.get(key) ?? [0, 0, 0, 0];
      acc[0]++;
      acc[1] += r;
      acc[2] += g;
      acc[3] += b;
      buckets.set(key, acc);
    }
  }
  const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  const named = new Map<string, number>();
  let total = 0;
  for (const [n, r, g, b] of buckets.values()) {
    const name = nearestColorName(`#${hex(r / n)}${hex(g / n)}${hex(b / n)}`);
    named.set(name, (named.get(name) ?? 0) + n);
    total += n;
  }
  return [...named.entries()]
    .map(([name, n]) => ({ name, share: n / (total || 1) }))
    .sort((a, b) => b.share - a.share)
    .slice(0, 6);
}

// If the photo is already on a plain white (or near-white) background, there's
// nothing to remove: returns which pixels belong to the item (255) or the background (0).
function plainWhiteBackground(pixels: Uint8ClampedArray, W: number, H: number): Uint8ClampedArray | null {
  const border = Math.max(2, Math.round(Math.min(W, H) * 0.03));
  let n = 0;
  let light = 0;
  const sum = [0, 0, 0];
  const visit = (x: number, y: number) => {
    const i = (y * W + x) * 4;
    n++;
    if (pixels[i] > 225 && pixels[i + 1] > 225 && pixels[i + 2] > 225) light++;
    sum[0] += pixels[i];
    sum[1] += pixels[i + 1];
    sum[2] += pixels[i + 2];
  };
  for (let y = 0; y < H; y++) {
    const edgeRow = y < border || y >= H - border;
    for (let x = 0; x < W; x++) if (edgeRow || x < border || x >= W - border) visit(x, y);
  }
  if (n === 0 || light / n < 0.93) return null;
  const bg = sum.map((s) => s / n);
  const alpha = new Uint8ClampedArray(W * H);
  for (let i = 0; i < alpha.length; i++) {
    const d = Math.abs(pixels[i * 4] - bg[0]) + Math.abs(pixels[i * 4 + 1] - bg[1]) + Math.abs(pixels[i * 4 + 2] - bg[2]);
    alpha[i] = d > 36 ? 255 : 0;
  }
  return alpha;
}

// For a photo already on white: keep the photo as it is (no cut-out needed), just
// centred on a 3:4 white canvas, and read the colours from the item's own pixels.
async function keepAsIs(pixels: Uint8ClampedArray, itemMask: Uint8ClampedArray, W: number, H: number) {
  let minX = W;
  let minY = H;
  let maxX = -1;
  let maxY = -1;
  let count = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (itemMask[y * W + x]) {
        count++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  // The whole rectangle around the item is kept, so nothing of it is cut away.
  const box = new Uint8ClampedArray(W * H);
  if (count > W * H * 0.02) {
    for (let y = minY; y <= maxY; y++) box.fill(255, y * W + minX, y * W + maxX + 1);
  } else {
    box.fill(255); // a very light item on white: keep the whole photo
  }
  const result = await compose(pixels, box, W, H);
  if (!result) return null;
  const itemPixels = new Uint8ClampedArray(pixels);
  for (let i = 0; i < itemMask.length; i++) itemPixels[i * 4 + 3] = itemMask[i];
  const colors = itemColors(itemPixels, W, H);
  return { ...result, colors: colors.length ? colors : result.colors };
}

// ---------- 1 + 2. Scanning a photo ----------

export interface SmartGuess {
  category?: Category;
  name?: string;
  color?: string;
  secondary_color?: string | null;
  pattern?: string;
  formality?: number;
  warmth?: number;
}

export interface ScanResult {
  pieces: CleanPiece[]; // biggest first; the first is shown and filled in
  guess: SmartGuess | null; // for the first piece
  alreadyWhite: boolean; // the photo already had a white background
}

// Turns what the AI recognised plus the item's colours into the form's details.
function finishGuess(c: Classification, colors: ColorShare[]): SmartGuess {
  // Colour: the item's main colours, weighted by how strongly the AI sees each colour
  // family on the clothing (so a bit of skin or a shadow doesn't win).
  const family = (name: string) => colorByName(name)?.family ?? name;
  const scored = colors
    .map((col) => ({ ...col, score: col.share * ((c.colorP[family(col.name)] ?? 0) + 0.1) }))
    .sort((a, b) => b.score - a.score);
  const aiTop = Object.entries(c.colorP).sort((a, b) => b[1] - a[1])[0]?.[0];
  const mainColor = scored[0]?.name ?? aiTop ?? 'black';
  // A second colour only if there's a lot of it and it really looks different
  // (not just a shadow or highlight of the main colour).
  const second = scored
    .slice(1)
    .find((s) => s.share >= 0.15 && s.score >= scored[0].score * 0.3 && colorDistance(s.name, mainColor) > 25);

  const patternWord = ['striped', 'checked', 'floral'].includes(c.pattern) ? `${c.pattern} ` : '';
  const name = `${mainColor} ${patternWord}${c.itemName.toLowerCase()}`;
  return {
    category: c.category,
    name: name.charAt(0).toUpperCase() + name.slice(1),
    color: mainColor,
    secondary_color: second?.name ?? null,
    pattern: c.pattern,
    formality: c.formality,
    warmth: c.warmth,
  };
}

// Cuts each piece of clothing out of the photo (biggest first), puts it on white and
// recognises the first one. Anything that isn't the clothing (a hanger, the person
// wearing it, the room) is removed.
export async function scanPhoto(photo: Blob): Promise<ScanResult> {
  const bitmap = await createImageBitmap(photo, { imageOrientation: 'from-image' });
  const W = bitmap.width;
  const H = bitmap.height;
  const { ctx } = canvas2d(W, H);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const pixels = ctx.getImageData(0, 0, W, H).data;

  // Already on white: no cut-out needed, just recognise it (much quicker).
  const itemMask = plainWhiteBackground(pixels, W, H);
  if (itemMask) {
    const kept = await keepAsIs(pixels, itemMask, W, H);
    if (kept) {
      const piece = { label: '', ...kept };
      const guess = await recogniseClothing(piece).catch(() => null);
      return { pieces: [piece], guess, alreadyWhite: true };
    }
  }

  // Otherwise: the background removal (here) and the clothing AI (in the worker) at the same time.
  const fgTask = (async () => {
    const { removeBackground } = await loadBgRemoval();
    const cutout = await createImageBitmap(await removeBackground(photo, BG_CONFIG));
    ready.bg = true;
    const c = canvas2d(W, H);
    c.ctx.drawImage(cutout, 0, 0, W, H);
    cutout.close();
    const data = c.ctx.getImageData(0, 0, W, H).data;
    const fg = new Uint8ClampedArray(W * H);
    for (let i = 0; i < fg.length; i++) fg[i] = data[i * 4 + 3];
    return solidify(fg, W, H);
  })().catch(() => null);
  const aiTask = ask({ type: 'analyse', photo })
    .then((r) => {
      ready.ai = true;
      return { parts: r.parts ?? null, classification: r.classification ?? null };
    })
    .catch(() => ({ parts: null as PartsResult | null, classification: null as Classification | null }));
  const [fg, { parts, classification }] = await Promise.all([fgTask, aiTask]);

  const fgArea = fg ? fg.reduce((s, a) => s + (a > 40 ? 1 : 0), 0) : 0;
  const pieces: CleanPiece[] = [];
  let firstIsAiPiece = false;
  for (const piece of parts?.pieces.slice(0, 4) ?? []) {
    const { w, h, person, owner } = parts!;
    // Worn: follow the clothing closely so skin is cut away. Not worn: allow a
    // generous margin (the outline comes from the background removal) but drop
    // things that stick out, like a hanger hook. Either way, never keep skin, hair
    // or another piece of clothing.
    const grown = dilate(piece.mask, w, h, Math.round(Math.max(w, h) * (person ? 0.015 : 0.04)));
    for (let i = 0; i < grown.length; i++) if (owner[i] !== -1 && owner[i] !== piece.index) grown[i] = 0;
    // Never leave holes inside the piece (bits the model wasn't sure about).
    const holes = enclosed((i) => grown[i] === 1, w, h);
    for (let i = 0; i < holes.length; i++) if (holes[i] && (!person || owner[i] === -1)) grown[i] = 1;
    const keep = upscale(grown, w, h, W, H);
    const keepArea = keep.reduce((n, a) => n + (a > 40 ? 1 : 0), 0);
    // The clothing fills the photo (a close-up): there's no background to remove.
    const fillsPhoto = !person && keepArea > W * H * 0.85;
    // The background remover missed a big part of the clothing (e.g. it took grey
    // fabric for background): follow the clothing finder's outline instead.
    const fgMissed = !person && fg !== null && fgArea < keepArea * 0.7;
    const alpha = new Uint8ClampedArray(W * H);
    let area = 0;
    for (let i = 0; i < alpha.length; i++) {
      alpha[i] = fillsPhoto ? 255 : fg && !fgMissed ? Math.min(fg[i], keep[i]) : keep[i];
      if (alpha[i] > 40) area++;
    }
    // On its own (flat or on a hanger), the piece should be most of the foreground.
    // If not, the parts model missed some of it: use the plain cut-out instead.
    if (!person && fg && pieces.length === 0 && area < fgArea * 0.6) break;
    const result = await compose(pixels, alpha, W, H);
    if (result) {
      if (pieces.length === 0) firstIsAiPiece = true;
      pieces.push({ label: piece.label, ...result });
    }
  }
  if (pieces.length === 0 && fg) {
    const result = await compose(pixels, fg, W, H);
    if (result) pieces.push({ label: '', ...result });
  }
  if (pieces.length === 0) throw new Error('No clothing item found in the photo.');

  const guess =
    firstIsAiPiece && classification
      ? finishGuess(classification, pieces[0].colors)
      : await recogniseClothing(pieces[0]).catch(() => null);
  return { pieces, guess, alreadyWhite: false };
}

// Recognises one cut-out piece (used when the user picks a different piece).
export async function recogniseClothing(piece: CleanPiece): Promise<SmartGuess> {
  const { classification } = await ask({ type: 'classify', photo: piece.clean });
  if (!classification) throw new Error("Couldn't recognise the item.");
  return finishGuess(classification, piece.colors);
}
