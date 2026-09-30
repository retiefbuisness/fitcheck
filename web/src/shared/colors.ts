// Shared with the mobile app (mobile/src). Keep the two copies in sync.
// Named clothing colours, with a hue for the colour-harmony rules.
// Neutrals go with everything.
export interface NamedColor {
  name: string;
  hex: string;
  neutral: boolean;
  hue?: number;
}

export const COLORS: NamedColor[] = [
  { name: 'black', hex: '#1a1a1a', neutral: true },
  { name: 'white', hex: '#f5f5f5', neutral: true },
  { name: 'grey', hex: '#8c8c8c', neutral: true },
  { name: 'navy', hex: '#1f2a4d', neutral: true },
  { name: 'denim', hex: '#4a6a93', neutral: true },
  { name: 'beige', hex: '#d9c7a7', neutral: true },
  { name: 'cream', hex: '#f3ead3', neutral: true },
  { name: 'brown', hex: '#6b4423', neutral: true },
  { name: 'khaki', hex: '#a89f6b', neutral: true },
  { name: 'olive', hex: '#6b6b2a', neutral: true },
  { name: 'red', hex: '#c62828', neutral: false, hue: 0 },
  { name: 'burgundy', hex: '#6d1a2c', neutral: false, hue: 345 },
  { name: 'pink', hex: '#ec6fa0', neutral: false, hue: 335 },
  { name: 'orange', hex: '#ef6c00', neutral: false, hue: 30 },
  { name: 'yellow', hex: '#f9c80e', neutral: false, hue: 50 },
  { name: 'green', hex: '#2e7d32', neutral: false, hue: 120 },
  { name: 'teal', hex: '#00838f', neutral: false, hue: 185 },
  { name: 'blue', hex: '#1e63d6', neutral: false, hue: 215 },
  { name: 'purple', hex: '#6a1b9a', neutral: false, hue: 280 },
];

export function colorByName(name: string | null | undefined): NamedColor | undefined {
  if (!name) return undefined;
  const n = name.trim().toLowerCase();
  return (
    COLORS.find((c) => c.name === n) ??
    COLORS.find((c) => n.includes(c.name)) ??
    ALIASES[n]
  );
}

const ALIASES: Record<string, NamedColor | undefined> = {
  gray: COLORS[2],
  charcoal: COLORS[2],
  tan: COLORS[5],
  camel: COLORS[5],
  ivory: COLORS[6],
  maroon: COLORS[11],
  wine: COLORS[11],
  gold: COLORS[14],
  mustard: COLORS[14],
  lilac: COLORS[18],
  lavender: COLORS[18],
  violet: COLORS[18],
  turquoise: COLORS[16],
  mint: COLORS[15],
  coral: COLORS[13],
  silver: COLORS[2],
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

// Closest named colour to a hex value (weighted RGB distance).
export function nearestColorName(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  let best = COLORS[0];
  let bestDist = Infinity;
  for (const c of COLORS) {
    const [cr, cg, cb] = hexToRgb(c.hex);
    const rm = (r + cr) / 2;
    const d =
      (2 + rm / 256) * (r - cr) ** 2 + 4 * (g - cg) ** 2 + (2 + (255 - rm) / 256) * (b - cb) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best.name;
}

export type Harmony = 'great' | 'good' | 'clash';

// How well two colours go together.
export function harmony(a: string, b: string): Harmony {
  const ca = colorByName(a);
  const cb = colorByName(b);
  if (!ca || !cb || ca.neutral || cb.neutral) return 'great';
  if (ca.name === cb.name) return 'great';
  const diff = Math.abs((ca.hue ?? 0) - (cb.hue ?? 0));
  const d = Math.min(diff, 360 - diff);
  if (d <= 45) return 'good'; // analogous
  if (d >= 150) return 'good'; // complementary
  if (d >= 110 && d <= 130) return 'good'; // triadic
  return 'clash';
}
