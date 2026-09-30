// "Smart photos" for closet items, all on the user's own device:
//  1. cut the clothing item out of the photo and put it on a clean white background
//  2. recognise what it is (type, colour, pattern) so the form fills itself in
// The AI models are downloaded once (about 90 MB, then cached by the browser),
// so the user opts in first. Photos never leave the device for this.
import { nearestColorName } from '../shared/colors';
import type { Category } from '../shared/types';
import { LABEL_EMBEDDINGS } from './clothingEmbeddings';
import { COLOR_LABELS, GARMENTS, LABEL_TEXTS, PATTERN_LABELS } from './clothingLabels';

const BG_REMOVAL_URL = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm';
const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0/+esm';
const CLIP_MODEL = 'Xenova/clip-vit-base-patch32';
const SETTING_KEY = 'fitcheck.smartPhotos';

export const SMART_DOWNLOAD_MB = 90;

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
};
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
  const cutout = await removeBackground(photo, { model: 'isnet_quint8', output: { format: 'image/png' } });
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

// Two most common colours among the item's own (non-transparent) pixels.
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
  return [...buckets.values()]
    .sort((a, b) => b[0] - a[0])
    .slice(0, 2)
    .map(([n, r, g, b]) => `#${hex(r / n)}${hex(g / n)}${hex(b / n)}`);
}

// ---------- 2. Recognising the item ----------

type Tensor = { data: Float32Array };
type TfModule = {
  env: { allowLocalModels: boolean };
  AutoProcessor: { from_pretrained: (id: string) => Promise<(img: unknown) => Promise<object>> };
  CLIPVisionModelWithProjection: {
    from_pretrained: (id: string, o: object) => Promise<(inputs: object) => Promise<{ image_embeds: Tensor }>>;
  };
  RawImage: { fromBlob: (b: Blob) => Promise<unknown> };
};

let clip: Promise<{ tf: TfModule; processor: (img: unknown) => Promise<object>; model: (i: object) => Promise<{ image_embeds: Tensor }> }> | null = null;

function loadClip() {
  clip ??= (async () => {
    const tf = (await import(/* @vite-ignore */ TRANSFORMERS_URL)) as TfModule;
    tf.env.allowLocalModels = false;
    const [processor, model] = await Promise.all([
      tf.AutoProcessor.from_pretrained(CLIP_MODEL),
      tf.CLIPVisionModelWithProjection.from_pretrained(CLIP_MODEL, { dtype: 'q4', device: 'wasm' }),
    ]);
    return { tf, processor, model };
  })();
  clip.catch(() => (clip = null));
  return clip;
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

// Softmax over the similarity scores (CLIP's usual temperature of 100).
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

export async function recogniseClothing(photo: Blob, colors: string[] = []): Promise<SmartGuess> {
  const { tf, processor, model } = await loadClip();
  const image = await tf.RawImage.fromBlob(photo);
  const inputs = await processor(image);
  const { image_embeds } = await model(inputs);
  const emb = Float32Array.from(image_embeds.data);
  const norm = Math.sqrt(emb.reduce((s, x) => s + x * x, 0)) || 1;
  for (let i = 0; i < emb.length; i++) emb[i] /= norm;

  const vectors = labelVectors();
  const g = GARMENTS.length;
  const p = PATTERN_LABELS.length;
  const garmentP = probabilities(emb, vectors.slice(0, g));
  const patternP = probabilities(emb, vectors.slice(g, g + p));
  const colorP = probabilities(emb, vectors.slice(g + p));

  const guess: SmartGuess = {};

  // Decide the category first by adding up all its garment types (more reliable
  // than a single label), then pick the most likely garment within it.
  const byCategory = new Map<Category, number>();
  GARMENTS.forEach((it, i) => byCategory.set(it.category, (byCategory.get(it.category) ?? 0) + garmentP[i]));
  const [category, categoryP] = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];
  let item: (typeof GARMENTS)[number] | undefined;
  if (categoryP >= 0.3) {
    guess.category = category;
    const idx = GARMENTS.map((it, i) => (it.category === category ? garmentP[i] : -1));
    const best = argmax(idx);
    if (garmentP[best] >= 0.1) {
      item = GARMENTS[best];
      guess.formality = item.formality;
      guess.warmth = item.warmth;
    }
  }

  // Main colour: the item's most common pixel colour (after the background is gone).
  // The AI's colour guess is used when we have no pixels, or as the second colour.
  const clipColorIdx = argmax(colorP);
  const clipColor = colorP[clipColorIdx] >= 0.25 ? COLOR_LABELS[clipColorIdx].color : undefined;
  const mainColor = colors[0] ? nearestColorName(colors[0]) : clipColor;
  if (mainColor) guess.color = mainColor;
  const second =
    clipColor && clipColor !== mainColor && colorP[clipColorIdx] >= 0.3
      ? clipColor
      : colors[1] && nearestColorName(colors[1]) !== mainColor
        ? nearestColorName(colors[1])
        : undefined;
  if (second) guess.secondary_color = second;

  const patternIdx = argmax(patternP);
  if (patternP[patternIdx] >= 0.4) guess.pattern = PATTERN_LABELS[patternIdx].pattern;

  if (item) {
    const patternWord = guess.pattern === 'striped' || guess.pattern === 'checked' || guess.pattern === 'floral' ? `${guess.pattern} ` : '';
    const name = `${mainColor ? `${mainColor} ` : ''}${patternWord}${item.name.toLowerCase()}`;
    guess.name = name.charAt(0).toUpperCase() + name.slice(1);
  }
  return guess;
}
