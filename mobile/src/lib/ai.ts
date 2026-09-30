// Fit Check's AI features. Uses Gemini Nano on the phone when available and
// falls back to the free style rules engine otherwise.
import * as Nano from '../../modules/fitcheck-ai';
import { CATEGORIES, Category, ClosetItem, OutfitIdea, PATTERNS, RatingResult } from '../types';
import { nearestColorName } from './colors';
import { StyleContext, candidateItems, generateOutfits, label } from './styleRules';

export type AiStatus = Nano.NanoStatus;

export const getAiStatus = Nano.getStatus;
export const downloadAiModel = Nano.download;

const SAFETY_RULES =
  "Only talk about the clothes, colours, how the garments fit, accessories and styling. " +
  "Never comment on the person's body, weight, shape, skin, face, age, race or attractiveness. " +
  'Be kind, encouraging and specific.';

// Drops any line that slips into commenting on the person rather than the clothes.
// (Words like "skinny" or "slim" are left out because they describe garments.)
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

// ---------------------------------------------------------------------------
// Outfit rating from a photo
// ---------------------------------------------------------------------------

export async function rateOutfitPhoto(imageUri: string, occasionLabel: string): Promise<RatingResult | null> {
  if ((await Nano.getStatus()) !== 'available') return null;
  const prompt =
    `You are Fit Check, a friendly fashion stylist. Look at the outfit in this photo. ` +
    `It is for: ${occasionLabel}.\n${SAFETY_RULES}\n` +
    `If no outfit or clothing is clearly visible, reply only: RATING: 0\n` +
    `Otherwise reply in exactly this format and nothing else:\n` +
    `RATING: <whole number from 1 to 5>\n` +
    `SUMMARY: <one short sentence>\n` +
    `WORKS: <something that works>\n` +
    `WORKS: <something else that works>\n` +
    `IMPROVE: <one specific styling tip>\n` +
    `IMPROVE: <another specific styling tip>`;

  const text = await Nano.generate(prompt, imageUri, { temperature: 0.3, topK: 16, maxOutputTokens: 320 });
  const ratingStr = field(text, 'RATING')[0];
  const rating = ratingStr ? parseInt(ratingStr, 10) : NaN;
  if (rating === 0) throw new Error("Couldn't spot an outfit in that photo. Try a clear, full-length shot.");
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) return null;

  const summary = clean(field(text, 'SUMMARY'))[0] ?? '';
  return {
    rating,
    summary,
    works: clean(field(text, 'WORKS')).slice(0, 3),
    improve: clean(field(text, 'IMPROVE')).slice(0, 3),
    source: 'gemini_nano',
  };
}

// ---------------------------------------------------------------------------
// Auto-tagging a closet item from its photo
// ---------------------------------------------------------------------------

export interface ItemGuess {
  category?: Category;
  name?: string;
  color?: string;
  pattern?: string;
  formality?: number;
  warmth?: number;
}

export async function describeClothing(imageUri: string): Promise<ItemGuess> {
  const guess: ItemGuess = {};

  // Colour sampling works on every Android phone, no AI needed.
  const hexes = await Nano.dominantColors(imageUri);
  if (hexes[0]) guess.color = nearestColorName(hexes[0]);

  if ((await Nano.getStatus()) !== 'available') return guess;
  try {
    const prompt =
      'Describe the single main clothing item in this photo. Reply in exactly this format and nothing else:\n' +
      `CATEGORY: one of ${CATEGORIES.map((c) => c.id).join(', ')}\n` +
      'NAME: a short name, at most 4 words, like "white linen shirt"\n' +
      'COLOR: the main colour, one word\n' +
      `PATTERN: one of ${PATTERNS.join(', ')}\n` +
      'FORMALITY: a number from 1 (very casual) to 5 (black tie)\n' +
      'WARMTH: a number from 1 (very light) to 5 (very warm)';
    const text = await Nano.generate(prompt, imageUri, { temperature: 0.1, topK: 8, maxOutputTokens: 120 });

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
    // Keep whatever we already have; the user can fill in the rest.
  }
  return guess;
}

// ---------------------------------------------------------------------------
// Outfit ideas from the closet
// ---------------------------------------------------------------------------

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
  if ((await Nano.getStatus()) !== 'available') return { ideas: rulesIdeas, usedAi: false };

  // Keep the prompt well under the on-device model's input limit.
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
    'OUTFIT: <item numbers separated by commas>\n' +
    'WHY: <one or two sentences on why it works for the occasion>';

  try {
    const text = await Nano.generate(prompt, null, { temperature: 0.7, topK: 32, maxOutputTokens: 380 });
    const outfitLines = field(text, 'OUTFIT');
    const whyLines = field(text, 'WHY');
    const aiIdeas: OutfitIdea[] = [];
    outfitLines.forEach((line, i) => {
      const nums = [...new Set((line.match(/\d+/g) ?? []).map((n) => parseInt(n, 10)))];
      const items = nums.map((n) => candidates[n - 1]).filter(Boolean);
      const why = clean([whyLines[i] ?? ''])[0];
      if (items.length >= 1 && isValidOutfit(items) && why) {
        aiIdeas.push({ itemIds: items.map((it) => it.id), explanation: why, source: 'ai' });
      }
    });
    if (aiIdeas.length === 0) return { ideas: rulesIdeas, usedAi: false };

    // Top up with rule-based ideas if the model returned fewer than 3.
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
