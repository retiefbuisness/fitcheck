// "Smart photos" for closet items, all on the user's own device:
//  1. cut the clothing item out of the photo and put it on a clean white background
//  2. recognise what it is (type, colour, pattern) so the form fills itself in
// The AI models are downloaded once (about 100 MB, then cached by the browser).
// It's on by default and can be turned off. Photos never leave the device for this.
import { nearestColorName } from '../shared/colors';
import type { Category } from '../shared/types';
import { LABEL_EMBEDDINGS } from './clothingEmbeddings';
import { COLOR_LABELS, GARMENTS, LABEL_TEXTS, PATTERN_LABELS } from './clothingLabels';

const BG_REMOVAL_URL = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm';
const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0/+esm';
const FASHION_MODEL = 'Marqo/marqo-fashionSigLIP'; // fashion-trained, runs in the browser
const SETTING_KEY = 'fitcheck.smartPhotos.v2'; // v2: on by default (v1 was opt-in)

export const SMART_DOWNLOAD_MB = 100;

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

// ---------- 1. Background removal ----------

type BgModule = {
  removeBackground: (image: Blob, config?: object) => Promise<Blob>;
  preload?: (config?: object) => Promise<void>;
};
const BG_CONFIG = { model: 'isnet_quint8', output: { format: 'image/png' } };
let bgModule: Promise<BgModule> | null = null;

function loadBgRemoval() {
  bgModule ??= import(/* @vite-ignore */ BG_REMOVAL_URL) as Promise<BgModule>;
  bgModule.catch(() => (bgModule = null));
  return bgModule;
}

export interface CleanPhoto {
  clean: Blob; // item on white, 3:4 JPEG
  colors: string[]; // up to two dominant hex colours of the item itself
}

// Cuts the item out and centres it on a white 3:4 canvas with a little padding.
export async function cleanBackground(photo: Blob): Promise<CleanPhoto> {
  const { removeBackground } = await loadBgRemoval();
  const cutout = await removeBackground(photo, BG_CONFIG);
  bgReady = true;
  const bitmap = await createImageBitmap(cutout);
  try {
    // Find the item's bounding box from the transparency mask.
    const probe = document.createElement('canvas');
    probe.width = bitmap.width;
    probe.height = bitmap.height;
    const pctx = probe.getContext('2d', { willReadFrequently: true })!;
    pctx.drawImage(bitmap, 0, 0);
    const { data } = pctx.getImageData(0, 0, bitmap.width, bitmap.height);
    let minX = bitmap.width;
    let minY = bitmap.height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < bitmap.height; y += 2) {
      for (let x = 0; x < bitmap.width; x += 2) {
        if (data[(y * bitmap.width + x) * 4 + 3] > 40) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0 || (maxX - minX) * (maxY - minY) < bitmap.width * bitmap.height * 0.02) {
      throw new Error('No clothing item found in the photo.');
    }
    const boxW = maxX - minX + 1;
    const boxH = maxY - minY + 1;

    const OUT_W = 900;
    const OUT_H = 1200;
    const canvas = document.createElement('canvas');
    canvas.width = OUT_W;
    canvas.height = OUT_H;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, OUT_W, OUT_H);
    const scale = Math.min((OUT_W * 0.86) / boxW, (OUT_H * 0.86) / boxH);
    const dw = boxW * scale;
    const dh = boxH * scale;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, minX, minY, boxW, boxH, (OUT_W - dw) / 2, (OUT_H - dh) / 2, dw, dh);

    const clean = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't save the cleaned photo."))), 'image/jpeg', 0.85),
    );
    return { clean, colors: itemColors(data, bitmap.width, bitmap.height) };
  } finally {
    bitmap.close();
  }
}

// Most common colour (and a second, if there's a lot of it) among the item's own pixels.
function itemColors(data: Uint8ClampedArray, width: number, height: number): string[] {
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
  const top = [...buckets.values()].sort((a, b) => b[0] - a[0]);
  // A second colour only counts if it covers a fair part of the item (not just shadows or a logo).
  return top
    .filter((c, i) => i === 0 || (i === 1 && c[0] >= top[0][0] * 0.4))
    .map(([n, r, g, b]) => `#${hex(r / n)}${hex(g / n)}${hex(b / n)}`);
}

// ---------- 2. Recognising the item ----------

type Tensor = { data: Float32Array };
type Model = (inputs: object) => Promise<{ image_embeds: Tensor }>;
type TfModule = {
  env: { allowLocalModels: boolean };
  AutoProcessor: { from_pretrained: (id: string) => Promise<(img: unknown) => Promise<object>> };
  SiglipVisionModel: { from_pretrained: (id: string, o: object) => Promise<Model> };
  RawImage: { fromBlob: (b: Blob) => Promise<unknown> };
};

let vision: Promise<{ tf: TfModule; processor: (img: unknown) => Promise<object>; model: Model }> | null = null;

let cpuOnly = false;

async function loadModel(tf: TfModule) {
  // The graphics chip is much faster where the browser supports it; otherwise the CPU.
  if (!cpuOnly && (navigator as { gpu?: unknown }).gpu) {
    try {
      return await tf.SiglipVisionModel.from_pretrained(FASHION_MODEL, { dtype: 'q4f16', device: 'webgpu' });
    } catch {
      // Fall back to the CPU below.
    }
  }
  return tf.SiglipVisionModel.from_pretrained(FASHION_MODEL, { dtype: 'q4', device: 'wasm' });
}

function loadVision() {
  vision ??= (async () => {
    const tf = (await import(/* @vite-ignore */ TRANSFORMERS_URL)) as TfModule;
    tf.env.allowLocalModels = false;
    const [processor, model] = await Promise.all([tf.AutoProcessor.from_pretrained(FASHION_MODEL), loadModel(tf)]);
    return { tf, processor, model };
  })();
  vision.then(() => (visionReady = true)).catch(() => (vision = null));
  return vision;
}

let visionReady = false;
let bgReady = false;

// True once the AI models are downloaded and loaded in this session.
export function smartPhotosReady() {
  return visionReady && bgReady;
}

// Starts the one-off downloads early (e.g. when the Add screen opens) so the
// photo is ready to scan by the time the user has picked one.
export function warmUpSmartPhotos() {
  loadVision().catch(() => {});
  loadBgRemoval()
    .then((m) => m.preload?.(BG_CONFIG))
    .then(() => (bgReady = true))
    .catch(() => {});
}

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
  const { tf, processor, model } = await loadVision();
  const image = await tf.RawImage.fromBlob(photo);
  const { image_embeds } = await model(await processor(image));
  const emb = Float32Array.from(image_embeds.data);
  const norm = Math.sqrt(emb.reduce((s, x) => s + x * x, 0)) || 1;
  for (let i = 0; i < emb.length; i++) emb[i] /= norm;
  return emb;
}

export async function recogniseClothing(photo: Blob, colors: string[] = []): Promise<SmartGuess> {
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

  // Main colour: the item's most common pixel colour (once the background is gone),
  // otherwise the AI's colour guess. Second colour only from the pixels.
  const mainColor = colors[0] ? nearestColorName(colors[0]) : COLOR_LABELS[argmax(colorP)].color;
  guess.color = mainColor;
  const second = colors[1] ? nearestColorName(colors[1]) : undefined;
  if (second && second !== mainColor) guess.secondary_color = second;

  const patternIdx = argmax(patternP);
  guess.pattern = patternP[patternIdx] >= 0.4 ? PATTERN_LABELS[patternIdx].pattern : 'solid';

  const patternWord = ['striped', 'checked', 'floral'].includes(guess.pattern) ? `${guess.pattern} ` : '';
  const name = `${mainColor} ${patternWord}${item.name.toLowerCase()}`;
  guess.name = name.charAt(0).toUpperCase() + name.slice(1);
  return guess;
}
