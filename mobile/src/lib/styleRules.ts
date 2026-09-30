// Free, offline style engine. Builds outfits from the user's closet and rates
// outfits made of closet items. Used on every phone, and as the fallback when
// on-device AI isn't available. It also pre-picks candidates for the AI.
import { ClosetItem, OutfitIdea, RatingResult } from '../types';
import { colorByName, harmony } from './colors';

export interface Occasion {
  id: string;
  label: string;
  formality: [number, number];
}

export const OCCASIONS: Occasion[] = [
  { id: 'casual', label: 'Casual day', formality: [1, 2] },
  { id: 'work', label: 'Work / office', formality: [3, 4] },
  { id: 'interview', label: 'Job interview', formality: [4, 5] },
  { id: 'date', label: 'Date night', formality: [2, 4] },
  { id: 'party', label: 'Party / night out', formality: [2, 4] },
  { id: 'wedding', label: 'Wedding guest', formality: [4, 5] },
  { id: 'formal', label: 'Formal event', formality: [5, 5] },
  { id: 'gym', label: 'Gym / workout', formality: [1, 1] },
  { id: 'beach', label: 'Beach / pool', formality: [1, 1] },
  { id: 'travel', label: 'Travel day', formality: [1, 2] },
];

export interface Weather {
  id: string;
  label: string;
  warmth: number;
}

export const WEATHER: Weather[] = [
  { id: 'hot', label: 'Hot', warmth: 1 },
  { id: 'warm', label: 'Warm', warmth: 2 },
  { id: 'mild', label: 'Mild', warmth: 3 },
  { id: 'cold', label: 'Cold', warmth: 4 },
  { id: 'freezing', label: 'Freezing', warmth: 5 },
];

export function occasionById(id: string) {
  return OCCASIONS.find((o) => o.id === id) ?? OCCASIONS[0];
}
export function weatherById(id: string) {
  return WEATHER.find((w) => w.id === id) ?? WEATHER[2];
}

export interface StyleContext {
  occasion: Occasion;
  weather: Weather;
  rain: boolean;
}

function formalityGap(item: ClosetItem, [lo, hi]: [number, number]) {
  if (item.formality < lo) return lo - item.formality;
  if (item.formality > hi) return item.formality - hi;
  return 0;
}

// How well one item suits the context (higher is better, 0 is perfect).
export function itemFit(item: ClosetItem, ctx: StyleContext): number {
  let score = -1.5 * formalityGap(item, ctx.occasion.formality);
  const warmthWeight = item.category === 'outerwear' ? 0.4 : 0.8;
  score -= warmthWeight * Math.max(0, item.warmth - ctx.weather.warmth - 1);
  score -= warmthWeight * 0.5 * Math.max(0, ctx.weather.warmth - item.warmth - 1);

  const special = ctx.occasion.id;
  if (special === 'gym') score += item.category === 'activewear' ? 3 : -2;
  else if (item.category === 'activewear') score -= 2;
  if (special === 'beach') score += item.category === 'swimwear' ? 3 : 0;
  else if (item.category === 'swimwear') score -= 10;
  return score;
}

interface Scored {
  items: ClosetItem[];
  score: number;
  notes: string[];
  tips: string[];
}

// Scores a whole outfit: each item's fit plus colour and pattern rules.
export function scoreOutfit(items: ClosetItem[], ctx: StyleContext): Scored {
  const notes: string[] = [];
  const tips: string[] = [];
  let score = items.reduce((s, it) => s + itemFit(it, ctx), 0);

  const off = items.filter((it) => formalityGap(it, ctx.occasion.formality) >= 2);
  if (off.length === 0) {
    notes.push(`The formality is right for ${ctx.occasion.label.toLowerCase()}.`);
  } else {
    for (const it of off) {
      const tooFormal = it.formality > ctx.occasion.formality[1];
      tips.push(
        `${label(it)} is ${tooFormal ? 'dressier' : 'more casual'} than ${ctx.occasion.label.toLowerCase()} usually calls for.`,
      );
    }
  }

  const colors = items.flatMap((it) => [it.color, it.secondary_color].filter(Boolean) as string[]);
  const bright = [...new Set(colors.filter((c) => colorByName(c) && !colorByName(c)!.neutral))];
  let clashes = 0;
  for (let i = 0; i < bright.length; i++)
    for (let j = i + 1; j < bright.length; j++)
      if (harmony(bright[i], bright[j]) === 'clash') clashes++;
  if (bright.length > 2) {
    score -= 1.5 * (bright.length - 2);
    tips.push('Try keeping it to one or two statement colours and let neutrals do the rest.');
  }
  if (clashes > 0) {
    score -= 1.5 * clashes;
    tips.push(`${cap(bright.join(' and '))} can clash; swap one for a neutral like black, white, navy or beige.`);
  } else if (bright.length === 0) {
    notes.push('An all-neutral palette always looks put together.');
  } else {
    notes.push(`The colours work well together${bright.length === 1 ? `, with ${bright[0]} as the statement` : ''}.`);
  }

  const patterned = items.filter((it) => it.pattern && it.pattern !== 'solid');
  if (patterned.length > 1) {
    score -= 1.5 * (patterned.length - 1);
    tips.push('More than one pattern is competing; pair the patterned piece with solids.');
  } else if (patterned.length === 1) {
    notes.push(`The ${patterned[0].pattern} ${label(patterned[0]).toLowerCase()} adds interest without overdoing it.`);
  }

  const warmest = Math.max(...items.map((it) => it.warmth));
  if (ctx.weather.warmth >= 4 && !items.some((it) => it.category === 'outerwear')) {
    score -= 1.5;
    tips.push(`Add a warm layer; it's ${ctx.weather.label.toLowerCase()} out.`);
  } else if (ctx.weather.warmth <= 1 && warmest >= 4) {
    score -= 1;
    tips.push("Some pieces look heavy for hot weather; try lighter fabrics.");
  } else {
    notes.push(`Weather-ready for a ${ctx.weather.label.toLowerCase()} day.`);
  }
  if (ctx.rain && !items.some((it) => it.category === 'outerwear')) {
    tips.push('Rain is expected; a jacket or coat would help.');
  }

  const hasBase =
    items.some((it) => it.category === 'dress') ||
    (items.some((it) => it.category === 'top' || it.category === 'activewear') &&
      items.some((it) => it.category === 'bottom' || it.category === 'activewear'));
  if (!hasBase && ctx.occasion.id !== 'beach') tips.push('The outfit needs a top and bottom, or a dress.');
  if (!items.some((it) => it.category === 'shoes')) tips.push('Choose shoes to finish the look.');

  return { items, score, notes, tips };
}

// Turns a score into 1-5 stars.
function starsFor(s: Scored): number {
  const perItem = s.score / Math.max(1, s.items.length);
  const raw = 5 + perItem * 1.2 - 0.5 * s.tips.length;
  return Math.max(1, Math.min(5, Math.round(raw)));
}

export function rateOutfitWithRules(items: ClosetItem[], ctx: StyleContext): RatingResult {
  const s = scoreOutfit(items, ctx);
  const rating = starsFor(s);
  const summary =
    rating >= 5
      ? 'A strong, well-balanced outfit for the occasion.'
      : rating >= 4
        ? 'A good outfit with a small tweak or two to consider.'
        : rating >= 3
          ? 'A solid start. A couple of changes would lift it.'
          : 'This one needs some changes to suit the occasion.';
  return { rating, summary, works: s.notes.slice(0, 3), improve: s.tips.slice(0, 3), source: 'rules' };
}

// Deterministic pseudo-random so "shuffle" gives new but repeatable ideas.
function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function best(items: ClosetItem[], ctx: StyleContext, n: number, rand: () => number) {
  return items
    .map((it) => ({ it, s: itemFit(it, ctx) + rand() * 0.9 }))
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((x) => x.it);
}

export function candidateItems(closet: ClosetItem[], ctx: StyleContext, perCategory = 8, seed = 1) {
  const rand = rng(seed);
  const byCat = (c: string) => closet.filter((it) => it.category === c);
  const cats = ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory', 'bag', 'activewear', 'swimwear'];
  return cats.flatMap((c) => best(byCat(c), ctx, perCategory, rand));
}

export function generateOutfits(
  closet: ClosetItem[],
  ctx: StyleContext,
  count = 3,
  seed = 1,
): OutfitIdea[] {
  const rand = rng(seed);
  const by = (c: string) => closet.filter((it) => it.category === c);
  const tops = best([...by('top'), ...(ctx.occasion.id === 'gym' ? by('activewear') : [])], ctx, 10, rand);
  const bottoms = best([...by('bottom'), ...(ctx.occasion.id === 'gym' ? by('activewear') : [])], ctx, 10, rand);
  const dresses = best(by('dress'), ctx, 6, rand);
  const swim = ctx.occasion.id === 'beach' ? best(by('swimwear'), ctx, 4, rand) : [];
  const shoes = best(by('shoes'), ctx, 4, rand);
  const outer = best(by('outerwear'), ctx, 4, rand);
  const extras = best([...by('accessory'), ...by('bag')], ctx, 4, rand);

  const bases: ClosetItem[][] = [];
  for (const d of dresses) bases.push([d]);
  for (const s of swim) bases.push([s]);
  for (const t of tops) for (const b of bottoms) if (t.id !== b.id) bases.push([t, b]);

  const needsLayer = ctx.weather.warmth >= 3 || ctx.rain || ctx.occasion.formality[0] >= 4;
  const outfits: Scored[] = [];
  for (const base of bases) {
    let pieces = [...base];
    if (shoes.length) pieces.push(pickBest(shoes, pieces, ctx));
    if (needsLayer && outer.length) {
      const layer = pickBest(outer, pieces, ctx);
      const withLayer = scoreOutfit([...pieces, layer], ctx);
      if (withLayer.score >= scoreOutfit(pieces, ctx).score - 0.5) pieces = [...pieces, layer];
    }
    if (extras.length && ctx.occasion.id !== 'gym') {
      const extra = pickBest(extras, pieces, ctx);
      if (scoreOutfit([...pieces, extra], ctx).score >= scoreOutfit(pieces, ctx).score) pieces.push(extra);
    }
    const scored = scoreOutfit(pieces, ctx);
    scored.score += rand() * 0.6;
    outfits.push(scored);
  }

  outfits.sort((a, b) => b.score - a.score);
  const chosen: Scored[] = [];
  const used = new Set<string>();
  for (const o of outfits) {
    const baseIds = o.items.filter((it) => ['top', 'bottom', 'dress', 'swimwear', 'activewear'].includes(it.category)).map((it) => it.id);
    if (baseIds.every((id) => used.has(id)) && chosen.length > 0) continue;
    if (baseIds.filter((id) => used.has(id)).length > 1) continue;
    baseIds.forEach((id) => used.add(id));
    chosen.push(o);
    if (chosen.length >= count) break;
  }

  return chosen.map((o) => ({
    itemIds: o.items.map((it) => it.id),
    explanation: [...o.notes.slice(0, 2), ...o.tips.slice(0, 1)].join(' '),
    source: 'rules' as const,
  }));
}

function pickBest(options: ClosetItem[], current: ClosetItem[], ctx: StyleContext) {
  let top = options[0];
  let topScore = -Infinity;
  for (const o of options) {
    const s = scoreOutfit([...current, o], ctx).score;
    if (s > topScore) {
      topScore = s;
      top = o;
    }
  }
  return top;
}

export function label(it: ClosetItem) {
  return it.name?.trim() || `${it.color} ${it.category}`;
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// What's missing from a closet before outfit ideas are useful.
export function closetGaps(closet: ClosetItem[]): string[] {
  const has = (c: string) => closet.some((it) => it.category === c);
  const gaps: string[] = [];
  if (!has('dress') && !(has('top') && has('bottom'))) gaps.push('at least one top and one bottom (or a dress)');
  if (!has('shoes')) gaps.push('a pair of shoes');
  return gaps;
}
