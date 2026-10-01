// The clothing AI models, run inside a background worker (smartWorker.ts) so they
// work at the same time as the background removal and don't freeze the page.
//  - a clothing-parts model finds each piece of clothing in a photo
//  - a fashion-trained model recognises what an item is
import type { Category } from '../shared/types';
import { LABEL_EMBEDDINGS } from './clothingEmbeddings';
import { COLOR_LABELS, GARMENTS, LABEL_TEXTS, PATTERN_LABELS } from './clothingLabels';

const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0/+esm';
const FASHION_MODEL = 'Marqo/marqo-fashionSigLIP'; // recognises the item (fashion-trained)
const PARTS_MODEL = 'Xenova/segformer_b2_clothes'; // finds each piece of clothing in a photo
const PARTS_SIZE = 512; // the parts model looks at a smaller copy (much faster)

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

let tfModule: Promise<TfModule> | null = null;
let parts: Promise<PartsPipeline> | null = null;
let vision: Promise<{ processor: (img: unknown) => Promise<object>; model: Model }> | null = null;
let cpuOnly = false;

function loadTf() {
  tfModule ??= (async () => {
    const tf = (await import(/* @vite-ignore */ TRANSFORMERS_URL)) as TfModule;
    tf.env.allowLocalModels = false;
    return tf;
  })();
  tfModule.catch(() => (tfModule = null));
  return tfModule;
}

function loadParts() {
  parts ??= loadTf().then((tf) => tf.pipeline('image-segmentation', PARTS_MODEL, { dtype: 'q8', device: 'wasm' }));
  parts.catch(() => (parts = null));
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
  vision.catch(() => (vision = null));
  return vision;
}

export async function warmUp() {
  await Promise.all([loadParts(), loadVision()]);
}

// ---------- Finding the pieces of clothing ----------

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

export interface Piece {
  label: string;
  index: number; // value in `owner` for this piece's pixels
  mask: Uint8Array; // 0/1 per pixel, w x h
  area: number; // share of the photo
}

export interface PartsResult {
  pieces: Piece[]; // biggest first
  owner: Int16Array; // per pixel: piece index, -2 for skin/hair, -1 for background
  person: boolean; // someone is wearing the clothes
  w: number;
  h: number;
}

async function smallCopy(photo: Blob, max: number) {
  const bitmap = await createImageBitmap(photo);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return { canvas, ctx, w, h };
}

export async function findPieces(photo: Blob): Promise<PartsResult> {
  const { canvas, w, h } = await smallCopy(photo, PARTS_SIZE);
  const [tf, segment] = await Promise.all([loadTf(), loadParts()]);
  const results = await segment(await tf.RawImage.fromBlob(await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 })));

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
  const person = personArea / (w * h) > 0.01;

  const areas = names.map((_, index) => owner.reduce((n, o) => n + (o === index ? 1 : 0), 0) / (w * h));
  const order = names.map((_, i) => i).sort((a, b) => areas[b] - areas[a]);

  if (!person && order.length > 0) {
    // Nobody is wearing it, so it's one item (the model sometimes calls the top of
    // a pair of trousers a "top"). Join all the clothing into one piece.
    const main = order[0];
    const mask = new Uint8Array(w * h);
    let n = 0;
    for (let i = 0; i < owner.length; i++) {
      if (owner[i] >= 0) {
        owner[i] = main;
        mask[i] = 1;
        n++;
      }
    }
    const area = n / (w * h);
    return { pieces: area >= 0.008 ? [{ label: names[main], index: main, mask, area }] : [], owner, person, w, h };
  }

  // Worn: each piece separately. Small bits (a sliver of a shoe or belt) are left out.
  const biggest = areas[order[0]] ?? 0;
  const pieces = order
    .filter((i) => areas[i] >= 0.015 && areas[i] >= biggest * 0.08)
    .map((index) => {
      const mask = new Uint8Array(w * h);
      for (let i = 0; i < mask.length; i++) if (owner[i] === index) mask[i] = 1;
      return { label: names[index], index, mask, area: areas[index] };
    });
  return { pieces, owner, person, w, h };
}

// A rough cut-out of one piece on white, good enough to recognise it while the
// detailed cut-out is still being made.
export async function roughCut(photo: Blob, piece: Piece): Promise<Blob> {
  const { ctx, w, h } = await smallCopy(photo, PARTS_SIZE);
  const img = ctx.getImageData(0, 0, w, h);
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (piece.mask[i]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      } else {
        img.data.set([255, 255, 255, 255], i * 4);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  if (maxX < 0) return ctx.canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.08);
  const size = Math.max(maxX - minX, maxY - minY) + pad * 2;
  const out = new OffscreenCanvas(size, size);
  const octx = out.getContext('2d')!;
  octx.fillStyle = '#ffffff';
  octx.fillRect(0, 0, size, size);
  octx.drawImage(
    ctx.canvas,
    minX,
    minY,
    maxX - minX + 1,
    maxY - minY + 1,
    (size - (maxX - minX)) / 2,
    (size - (maxY - minY)) / 2,
    maxX - minX + 1,
    maxY - minY + 1,
  );
  return out.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
}

// ---------- Recognising the item ----------

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

export interface Classification {
  category: Category;
  itemName: string;
  formality: number;
  warmth: number;
  pattern: string;
  colorP: Record<string, number>; // how strongly the AI sees each colour family
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

export async function classify(photo: Blob): Promise<Classification> {
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

  // The category comes from adding up all its garment types, which is more reliable
  // than one label; then the most likely garment within it gives the name.
  const byCategory = new Map<Category, number>();
  GARMENTS.forEach((it, i) => byCategory.set(it.category, (byCategory.get(it.category) ?? 0) + garmentP[i]));
  const category = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const item = GARMENTS[argmax(GARMENTS.map((it, i) => (it.category === category ? garmentP[i] : -1)))];
  const patternIdx = argmax(patternP);

  return {
    category,
    itemName: item.name,
    formality: item.formality,
    warmth: item.warmth,
    pattern: patternP[patternIdx] >= 0.4 ? PATTERN_LABELS[patternIdx].pattern : 'solid',
    colorP: Object.fromEntries(COLOR_LABELS.map((c, i) => [c.color, colorP[i]])),
  };
}
