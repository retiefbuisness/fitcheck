// Fit Check's AI on the web. Uses Chrome's built-in on-device model (Prompt API,
// Gemini Nano) when the browser supports it, and the free style rules otherwise.
// Prompts and parsing match mobile/src/lib/ai.ts.
import { nearestColorName } from '../shared/colors';
import { candidateItems, generateOutfits, label, type StyleContext } from '../shared/styleRules';
import { CATEGORIES, PATTERNS, type Category, type ClosetItem, type OutfitIdea, type RatingResult } from '../shared/types';
import { dominantColors } from './images';

export type AiStatus = 'available' | 'downloadable' | 'downloading' | 'unavailable';

interface LMSession {
  prompt(input: unknown): Promise<string>;
  destroy(): void;
}
interface LMMonitor {
  addEventListener(type: 'downloadprogress', cb: (e: { loaded: number }) => void): void;
}
interface LanguageModelApi {
  availability(options: object): Promise<string>;
  create(options: object & { monitor?: (m: LMMonitor) => void }): Promise<LMSession>;
}

const LM = (globalThis as { LanguageModel?: LanguageModelApi }).LanguageModel;

const MODEL_OPTIONS = {
  expectedInputs: [{ type: 'text', languages: ['en'] }, { type: 'image' }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
};

export async function getAiStatus(): Promise<AiStatus> {
  if (!LM) return 'unavailable';
  try {
    const a = await LM.availability(MODEL_OPTIONS);
    return a === 'available' || a === 'downloadable' || a === 'downloading' ? a : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

// Must be called from a click (browsers require user activation to download).
export async function downloadAiModel(onProgress?: (fraction: number) => void) {
  if (!LM) return false;
  const session = await LM.create({
    ...MODEL_OPTIONS,
    monitor: (m) => m.addEventListener('downloadprogress', (e) => onProgress?.(e.loaded)),
  });
  session.destroy();
  return true;
}

async function generate(prompt: string, image?: Blob): Promise<string> {
  if (!LM) throw new Error('On-device AI is not available in this browser.');
  const session = await LM.create(MODEL_OPTIONS);
  try {
    const content: { type: string; value: unknown }[] = [{ type: 'text', value: prompt }];
    if (image) content.push({ type: 'image', value: image });
    return await session.prompt([{ role: 'user', content }]);
  } finally {
    session.destroy();
  }
}

const SAFETY_RULES =
  'Only talk about the clothes, colours, how the garments fit, accessories and styling. ' +
  "Never comment on the person's body, weight, shape, skin, face, age, race or attractiveness. " +
  'Be kind, encouraging and specific.';

// Drops any line that slips into commenting on the person rather than the clothes.
const BODY_WORDS =
  /\b(weight|overweight|fat|chubby|curvy|body|bodies|figure|face|skin|complexion|attractive|unattractive|ugly|handsome|sexy|belly|stomach|hips|thighs|chest|breasts?|butt)\b/i;

function clean(lines: string[]) {
  return lines.map((l) => l.trim()).filter((l) => l.length > 0 && !BODY_WORDS.test(l));
}

function field(text: string, name: string): string[] {
  const re = new RegExp(`^\\s*[*-]?\\s*\\**${name}\\**\\s*:\\s*(.+)$`, 'gim');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push(m[1].trim());
  return out;
}

export async function rateOutfitPhoto(image: Blob, occasionLabel: string): Promise<RatingResult | null> {
  if ((await getAiStatus()) !== 'available') return null;
  const prompt =
    `You are Fit Check, a friendly fashion stylist. Look at the outfit in this photo. It is for: ${occasionLabel}.\n` +
    `${SAFETY_RULES}\nIf no outfit or clothing is clearly visible, reply only: RATING: 0\n` +
    'Otherwise reply in exactly this format and nothing else:\n' +
    'RATING: <whole number from 1 to 5>\nSUMMARY: <one short sentence>\nWORKS: <something that works>\n' +
    'WORKS: <something else that works>\nIMPROVE: <one specific styling tip>\nIMPROVE: <another specific styling tip>';
  const text = await generate(prompt, image);
  const rating = parseInt(field(text, 'RATING')[0] ?? '', 10);
  if (rating === 0) throw new Error("Couldn't spot an outfit in that photo. Try a clear, full-length shot.");
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) return null;
  return {
    rating,
    summary: clean(field(text, 'SUMMARY'))[0] ?? '',
    works: clean(field(text, 'WORKS')).slice(0, 3),
    improve: clean(field(text, 'IMPROVE')).slice(0, 3),
    source: 'gemini_nano',
  };
}

export interface ItemGuess {
  category?: Category;
  name?: string;
  color?: string;
  pattern?: string;
  formality?: number;
  warmth?: number;
}

export async function describeClothing(image: Blob): Promise<ItemGuess> {
  const guess: ItemGuess = {};
  const hexes = await dominantColors(image);
  if (hexes[0]) guess.color = nearestColorName(hexes[0]);
  if ((await getAiStatus()) !== 'available') return guess;
  try {
    const prompt =
      'Describe the single main clothing item in this photo. Reply in exactly this format and nothing else:\n' +
      `CATEGORY: one of ${CATEGORIES.map((c) => c.id).join(', ')}\n` +
      'NAME: a short name, at most 4 words, like "white linen shirt"\nCOLOR: the main colour, one word\n' +
      `PATTERN: one of ${PATTERNS.join(', ')}\n` +
      'FORMALITY: a number from 1 (very casual) to 5 (black tie)\nWARMTH: a number from 1 (very light) to 5 (very warm)';
    const text = await generate(prompt, image);
    const cat = field(text, 'CATEGORY')[0]?.toLowerCase();
    const match = CATEGORIES.find((c) => cat?.includes(c.id));
    if (match) guess.category = match.id;
    const name = field(text, 'NAME')[0]?.replace(/["']/g, '');
    if (name) guess.name = name.split(/\s+/).slice(0, 5).join(' ').slice(0, 60);
    const color = field(text, 'COLOR')[0]?.toLowerCase().replace(/[^a-z ]/g, '');
    if (color) guess.color = color.split(' ').pop();
    const pattern = field(text, 'PATTERN')[0]?.toLowerCase();
    const p = PATTERNS.find((x) => pattern?.includes(x));
    if (p) guess.pattern = p;
    const f = parseInt(field(text, 'FORMALITY')[0] ?? '', 10);
    if (f >= 1 && f <= 5) guess.formality = f;
    const w = parseInt(field(text, 'WARMTH')[0] ?? '', 10);
    if (w >= 1 && w <= 5) guess.warmth = w;
  } catch {
    // Keep what we have; the user can fill in the rest.
  }
  return guess;
}

function isValidOutfit(items: ClosetItem[]) {
  const has = (c: Category) => items.some((it) => it.category === c);
  return has('dress') || has('swimwear') || ((has('top') || has('activewear')) && (has('bottom') || has('activewear')));
}

export async function suggestOutfits(
  closet: ClosetItem[],
  ctx: StyleContext,
  seed: number,
): Promise<{ ideas: OutfitIdea[]; usedAi: boolean }> {
  const rulesIdeas = generateOutfits(closet, ctx, 3, seed);
  if ((await getAiStatus()) !== 'available') return { ideas: rulesIdeas, usedAi: false };
  const candidates = candidateItems(closet, ctx, 6, seed);
  if (candidates.length < 2) return { ideas: rulesIdeas, usedAi: false };

  const list = candidates
    .map(
      (it, i) =>
        `${i + 1}. ${it.category}: ${label(it)} (${it.color}${it.pattern !== 'solid' ? `, ${it.pattern}` : ''}; formality ${it.formality}/5; warmth ${it.warmth}/5)`,
    )
    .join('\n');
  const prompt =
    `You are a friendly fashion stylist. Build outfits ONLY from these numbered clothing items:\n${list}\n\n` +
    `Occasion: ${ctx.occasion.label}. Weather: ${ctx.weather.label.toLowerCase()}${ctx.rain ? ', with rain' : ''}.\n` +
    'Each outfit needs a dress, or a top and a bottom, plus shoes if there are any. Add outerwear if it is cold or rainy.\n' +
    'Reply with 3 different outfits in exactly this format and nothing else:\n' +
    'OUTFIT: <item numbers separated by commas>\nWHY: <one or two sentences on why it works for the occasion>';
  try {
    const text = await generate(prompt);
    const outfitLines = field(text, 'OUTFIT');
    const whyLines = field(text, 'WHY');
    const aiIdeas: OutfitIdea[] = [];
    outfitLines.forEach((line, i) => {
      const nums = [...new Set((line.match(/\d+/g) ?? []).map((n) => parseInt(n, 10)))];
      const items = nums.map((n) => candidates[n - 1]).filter(Boolean);
      const why = clean([whyLines[i] ?? ''])[0];
      if (items.length && isValidOutfit(items) && why) aiIdeas.push({ itemIds: items.map((it) => it.id), explanation: why, source: 'ai' });
    });
    if (aiIdeas.length === 0) return { ideas: rulesIdeas, usedAi: false };
    const seen = new Set(aiIdeas.map((o) => [...o.itemIds].sort().join()));
    for (const r of rulesIdeas) {
      if (aiIdeas.length >= 3) break;
      if (!seen.has([...r.itemIds].sort().join())) aiIdeas.push(r);
    }
    return { ideas: aiIdeas, usedAi: true };
  } catch {
    return { ideas: rulesIdeas, usedAi: false };
  }
}
