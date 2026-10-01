// "Smart photos" for closet items, all on the user's own device:
//  1. find the clothing in the photo (even on a hanger or worn by someone), cut it out
//     and put it on a clean white background
//  2. recognise what it is (type, colour, pattern) so the form fills itself in
// The AI models are downloaded once (then cached by the browser).
// It's on by default and can be turned off. Photos never leave the device for this.
import { nearestColorName } from '../shared/colors';
import type { Category } from '../shared/types';
import { LABEL_EMBEDDINGS } from './clothingEmbeddings';
import { COLOR_LABELS, GARMENTS, LABEL_TEXTS, PATTERN_LABELS } from './clothingLabels';

const BG_REMOVAL_URL = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm';
const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0/+esm';
const FASHION_MODEL = 'Marqo/marqo-fashionSigLIP'; // recognises the item (fashion-trained)
const PARTS_MODEL = 'Xenova/segformer_b2_clothes'; // finds each piece of clothing in a photo
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

// ---------- Loading the AI models ----------

type Tensor = { data: Float32Array };
type Model = (inputs: object) => Promise<{ image_embeds: Tensor }>;
type Mask = { data: ArrayLike<number>; width: number; height: number };
type PartsPipeline = (image: unknown) => Promise<{ label: string; mask: Mask }[]>;
type TfModule = {
  env: { allowLocalModels: boolean };
  AutoProcessor: { from_pretrained: (id: string) => Promise<(img: unknown) => Promise<object>> };
  SiglipVisionModel: { from_pretrained: (id: string, o: object) => Promise<Model> };
  RawImage: { fromBlob: (b: Blob) => Promise<unknown> };
  pipeline: (task: string, model: string, o: object) => Promise<PartsPipeline>;
};
type BgModule = {
  removeBackground: (image: Blob, config?: object) => Promise<Blob>;
  preload?: (config?: object) => Promise<void>;
};
const BG_CONFIG = { model: 'isnet_quint8', output: { format: 'image/png' } };

let tfModule: Promise<TfModule> | null = null;
let bgModule: Promise<BgModule> | null = null;
let parts: Promise<PartsPipeline> | null = null;
let vision: Promise<{ processor: (img: unknown) => Promise<object>; model: Model }> | null = null;
let cpuOnly = false;
const ready = { bg: false, parts: false, vision: false };

function loadTf() {
  tfModule ??= (async () => {
    const tf = (await import(/* @vite-ignore */ TRANSFORMERS_URL)) as TfModule;
    tf.env.allowLocalModels = false;
    return tf;
  })();
  tfModule.catch(() => (tfModule = null));
  return tfModule;
}

function loadBgRemoval() {
  bgModule ??= import(/* @vite-ignore */ BG_REMOVAL_URL) as Promise<BgModule>;
  bgModule.catch(() => (bgModule = null));
  return bgModule;
}

function loadParts() {
  parts ??= loadTf().then((tf) => tf.pipeline('image-segmentation', PARTS_MODEL, { dtype: 'q8', device: 'wasm' }));
  parts.then(() => (ready.parts = true)).catch(() => (parts = null));
  return parts;
}

// The graphics chip is much faster where the browser has a usable one; otherwise the CPU.
async function canUseGpu() {
  if (cpuOnly) return false;
  try {
    const gpu = (navigator as { gpu?: { requestAdapter: () => Promise<{ features: Set<string> } | null> } }).gpu;
    const adapter = await gpu?.requestAdapter();
    return !!adapter && adapter.features.has('shader-f16');
  } catch {
    return false;
  }
}

function loadVision() {
  vision ??= (async () => {
    const tf = await loadTf();
    const gpu = await canUseGpu();
    const [processor, model] = await Promise.all([
      tf.AutoProcessor.from_pretrained(FASHION_MODEL),
      tf.SiglipVisionModel.from_pretrained(
        FASHION_MODEL,
        gpu ? { dtype: 'q4f16', device: 'webgpu' } : { dtype: 'q4', device: 'wasm' },
      ),
    ]);
    return { processor, model };
  })();
  vision.then(() => (ready.vision = true)).catch(() => (vision = null));
  return vision;
}

// True once all the AI models are downloaded and loaded in this session.
export function smartPhotosReady() {
  return ready.bg && ready.parts && ready.vision;
}

// Starts the one-off downloads early (e.g. when the Add screen opens) so the
// photo is ready to scan by the time the user has picked one.
export function warmUpSmartPhotos() {
  loadBgRemoval()
    .then((m) => m.preload?.(BG_CONFIG))
    .then(() => (ready.bg = true))
    .catch(() => {});
  loadParts().catch(() => {});
  loadVision().catch(() => {});
}

// ---------- 1. Cutting out the clothing ----------

// A named colour and how much of the cut-out it covers (0-1).
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

// What the clothing-parts model calls each piece, and how we show it.
const PIECE_NAMES: Record<string, string> = {
  'Upper-clothes': 'Top',
  Pants: 'Trousers',
  Skirt: 'Skirt',
  Dress: 'Dress',
  'Left-shoe': 'Shoes',
  'Right-shoe': 'Shoes',
  Hat: 'Hat',
  Bag: 'Bag',
  Scarf: 'Scarf',
  Belt: 'Belt',
  Sunglasses: 'Sunglasses',
};
const PERSON_PARTS = new Set(['Hair', 'Face', 'Left-leg', 'Right-leg', 'Left-arm', 'Right-arm']);
const PARTS_SIZE = 512; // the parts model looks at a smaller copy (much faster)

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

interface Pieces {
  pieces: { label: string; mask: Uint8Array; area: number; index: number }[]; // biggest first
  owner: Int16Array; // per pixel: which piece (index), -2 for skin/hair, -1 for background
  person: boolean; // someone is wearing the clothes
  w: number;
  h: number;
}

// Finds each piece of clothing in the photo with the clothing-parts model.
async function findPieces(bitmap: ImageBitmap): Promise<Pieces> {
  const scale = Math.min(1, PARTS_SIZE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const { c, ctx } = canvas2d(w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  const [tf, segment] = await Promise.all([loadTf(), loadParts()]);
  const results = await segment(await tf.RawImage.fromBlob(await toBlob(c, 'image/jpeg', 0.9)));

  const names: string[] = [];
  const owner = new Int16Array(w * h).fill(-1);
  let personArea = 0;
  for (const { label, mask } of results) {
    if (mask.width !== w || mask.height !== h) continue;
    let id: number;
    if (PERSON_PARTS.has(label)) {
      id = -2;
    } else if (PIECE_NAMES[label]) {
      const name = PIECE_NAMES[label];
      id = names.indexOf(name);
      if (id < 0) id = names.push(name) - 1;
    } else {
      continue;
    }
    for (let i = 0; i < owner.length; i++) {
      if (mask.data[i] > 127) {
        owner[i] = id;
        if (id === -2) personArea++;
      }
    }
  }
  const pieces = names
    .map((label, index) => {
      const mask = new Uint8Array(w * h);
      let n = 0;
      for (let i = 0; i < mask.length; i++) {
        if (owner[i] === index) {
          mask[i] = 1;
          n++;
        }
      }
      return { label, mask, area: n / (w * h), index };
    })
    .filter((p) => p.area >= 0.008)
    .sort((a, b) => b.area - a.area);
  return { pieces, owner, person: personArea / (w * h) > 0.01, w, h };
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

// Cuts each piece of clothing out of the photo (biggest first) and puts it on white.
// Anything that isn't the clothing (a hanger, the person wearing it, the room) is removed.
export async function cleanBackground(photo: Blob): Promise<CleanPiece[]> {
  const bitmap = await createImageBitmap(photo, { imageOrientation: 'from-image' });
  try {
    const W = bitmap.width;
    const H = bitmap.height;
    const { ctx } = canvas2d(W, H);
    ctx.drawImage(bitmap, 0, 0);
    const pixels = ctx.getImageData(0, 0, W, H).data;

    // Clean outline of everything in the foreground.
    let fg: Uint8ClampedArray | null = null;
    try {
      const { removeBackground } = await loadBgRemoval();
      const cutout = await createImageBitmap(await removeBackground(photo, BG_CONFIG));
      ready.bg = true;
      const c = canvas2d(W, H);
      c.ctx.drawImage(cutout, 0, 0, W, H);
      cutout.close();
      const data = c.ctx.getImageData(0, 0, W, H).data;
      fg = new Uint8ClampedArray(W * H);
      for (let i = 0; i < fg.length; i++) fg[i] = data[i * 4 + 3];
    } catch {
      // Carry on with the clothing-parts model alone.
    }

    // Where each piece of clothing is.
    let found: Pieces | null = null;
    try {
      found = await findPieces(bitmap);
    } catch {
      // Carry on with the background removal alone.
    }

    const fgArea = fg ? fg.reduce((s, a) => s + (a > 40 ? 1 : 0), 0) : 0;
    const out: CleanPiece[] = [];
    for (const piece of found?.pieces.slice(0, 4) ?? []) {
      const { w, h, person, owner } = found!;
      // Worn: follow the clothing closely so skin is cut away. Not worn: allow a
      // generous margin (the outline comes from the background removal) but drop
      // things that stick out, like a hanger hook. Either way, never keep skin, hair
      // or another piece of clothing.
      const grown = dilate(piece.mask, w, h, Math.round(Math.max(w, h) * (person ? 0.015 : 0.04)));
      for (let i = 0; i < grown.length; i++) if (owner[i] !== -1 && owner[i] !== piece.index) grown[i] = 0;
      const keep = upscale(grown, w, h, W, H);
      const alpha = new Uint8ClampedArray(W * H);
      let area = 0;
      for (let i = 0; i < alpha.length; i++) {
        alpha[i] = fg ? Math.min(fg[i], keep[i]) : keep[i];
        if (alpha[i] > 40) area++;
      }
      // On its own (flat or on a hanger), the piece should be most of the foreground.
      // If not, the parts model missed some of it: use the plain cut-out instead.
      if (!person && fg && out.length === 0 && area < fgArea * 0.6) break;
      const result = await compose(pixels, alpha, W, H);
      if (result) out.push({ label: piece.label, ...result });
    }

    if (out.length === 0 && fg) {
      const result = await compose(pixels, fg, W, H);
      if (result) out.push({ label: '', ...result });
    }
    if (out.length === 0) throw new Error('No clothing item found in the photo.');
    return out;
  } finally {
    bitmap.close();
  }
}

// Main named colours among the visible pixels, biggest first.
function itemColors(data: Uint8ClampedArray, width: number, height: number): ColorShare[] {
  const buckets = new Map<number, [number, number, number, number]>();
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 20000)));
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 200) continue;
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
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
    .slice(0, 5);
}

// ---------- 2. Recognising the item ----------

// Unpacks the int8 label embeddings into normalised Float32 vectors.
let labels: Float32Array[] | null = null;
function labelVectors(): Float32Array[] {
  if (labels) return labels;
  const bytes = Uint8Array.from(atob(LABEL_EMBEDDINGS.data), (c) => c.charCodeAt(0));
  const dim = LABEL_EMBEDDINGS.dim;
  const out: Float32Array[] = [];
  for (let i = 0; i < LABEL_TEXTS.length; i++) {
    const v = new Float32Array(dim);
    let norm = 0;
    for (let j = 0; j < dim; j++) {
      const b = bytes[i * dim + j];
      v[j] = b > 127 ? b - 256 : b;
      norm += v[j] * v[j];
    }
    norm = Math.sqrt(norm) || 1;
    for (let j = 0; j < dim; j++) v[j] /= norm;
    out.push(v);
  }
  labels = out;
  return out;
}

// Softmax over the similarity scores (temperature 100, as in CLIP/SigLIP examples).
function probabilities(image: Float32Array, vectors: Float32Array[]): number[] {
  const scores = vectors.map((v) => v.reduce((s, x, j) => s + x * image[j], 0) * 100);
  const max = Math.max(...scores);
  const exp = scores.map((s) => Math.exp(s - max));
  const sum = exp.reduce((a, b) => a + b, 0);
  return exp.map((e) => e / sum);
}

function argmax(values: number[]) {
  return values.reduce((best, v, i) => (v > values[best] ? i : best), 0);
}

export interface SmartGuess {
  category?: Category;
  name?: string;
  color?: string;
  secondary_color?: string | null;
  pattern?: string;
  formality?: number;
  warmth?: number;
}

async function imageEmbedding(photo: Blob): Promise<Float32Array> {
  const [tf, { processor, model }] = await Promise.all([loadTf(), loadVision()]);
  const image = await tf.RawImage.fromBlob(photo);
  const { image_embeds } = await model(await processor(image));
  const emb = Float32Array.from(image_embeds.data);
  const norm = Math.sqrt(emb.reduce((s, x) => s + x * x, 0)) || 1;
  for (let i = 0; i < emb.length; i++) emb[i] /= norm;
  return emb;
}

export async function recogniseClothing(photo: Blob, colors: ColorShare[] = []): Promise<SmartGuess> {
  let emb: Float32Array;
  try {
    emb = await imageEmbedding(photo);
  } catch (e) {
    if (cpuOnly) throw e;
    // Some graphics chips load the model but can't run it: try again on the CPU.
    cpuOnly = true;
    vision = null;
    emb = await imageEmbedding(photo);
  }

  const vectors = labelVectors();
  const g = GARMENTS.length;
  const p = PATTERN_LABELS.length;
  const garmentP = probabilities(emb, vectors.slice(0, g));
  const patternP = probabilities(emb, vectors.slice(g, g + p));
  const colorP = probabilities(emb, vectors.slice(g + p));

  const guess: SmartGuess = {};

  // Always make a best guess (the user can change it). The category comes from
  // adding up all its garment types, which is more reliable than one label;
  // then the most likely garment within that category gives the name.
  const byCategory = new Map<Category, number>();
  GARMENTS.forEach((it, i) => byCategory.set(it.category, (byCategory.get(it.category) ?? 0) + garmentP[i]));
  const category = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const item = GARMENTS[argmax(GARMENTS.map((it, i) => (it.category === category ? garmentP[i] : -1)))];
  guess.category = category;
  guess.formality = item.formality;
  guess.warmth = item.warmth;

  // Colour: the cut-out's main colours, weighted by how strongly the AI sees each one
  // on the clothing (so a bit of skin or a shadow doesn't win).
  const aiP = new Map(COLOR_LABELS.map((c, i) => [c.color, colorP[i]]));
  const scored = colors
    .map((c) => ({ name: c.name, share: c.share, score: c.share * ((aiP.get(c.name) ?? 0) + 0.1) }))
    .sort((a, b) => b.score - a.score);
  const mainColor = scored[0]?.name ?? COLOR_LABELS[argmax(colorP)].color;
  guess.color = mainColor;
  const second = scored[1];
  if (second && second.share >= 0.2 && second.score >= scored[0].score * 0.4) guess.secondary_color = second.name;

  const patternIdx = argmax(patternP);
  guess.pattern = patternP[patternIdx] >= 0.4 ? PATTERN_LABELS[patternIdx].pattern : 'solid';

  const patternWord = ['striped', 'checked', 'floral'].includes(guess.pattern) ? `${guess.pattern} ` : '';
  const name = `${mainColor} ${patternWord}${item.name.toLowerCase()}`;
  guess.name = name.charAt(0).toUpperCase() + name.slice(1);
  return guess;
}
