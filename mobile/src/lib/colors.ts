// Named clothing colours, with a hue for the colour-harmony rules.
// Neutrals go with everything. `family` is the broad colour each shade belongs to.
export interface NamedColor {
  name: string;
  hex: string;
  neutral: boolean;
  hue?: number;
  family: string;
}

export const COLORS: NamedColor[] = [
  { name: 'black', hex: '#1a1a1a', neutral: true, family: 'black' },
  { name: 'charcoal', hex: '#3a3f44', neutral: true, family: 'grey' },
  { name: 'grey', hex: '#8c8c8c', neutral: true, family: 'grey' },
  { name: 'light grey', hex: '#c9c9c9', neutral: true, family: 'grey' },
  { name: 'silver', hex: '#bfc2c7', neutral: true, family: 'grey' },
  { name: 'white', hex: '#f5f5f5', neutral: true, family: 'white' },
  { name: 'cream', hex: '#f3ead3', neutral: true, family: 'cream' },
  { name: 'beige', hex: '#d9c7a7', neutral: true, family: 'beige' },
  { name: 'tan', hex: '#c4a27a', neutral: true, family: 'beige' },
  { name: 'camel', hex: '#b98a55', neutral: true, family: 'brown' },
  { name: 'brown', hex: '#6b4423', neutral: true, family: 'brown' },
  { name: 'dark brown', hex: '#3f2a1d', neutral: true, family: 'brown' },
  { name: 'khaki', hex: '#a89f6b', neutral: true, family: 'khaki' },
  { name: 'olive', hex: '#6b6b2a', neutral: true, family: 'olive' },
  { name: 'navy', hex: '#1f2a4d', neutral: true, family: 'navy' },
  { name: 'denim', hex: '#4a6a93', neutral: true, family: 'denim' },
  { name: 'light blue', hex: '#9cc2e5', neutral: false, hue: 210, family: 'denim' },
  { name: 'blue', hex: '#1e63d6', neutral: false, hue: 215, family: 'blue' },
  { name: 'teal', hex: '#00838f', neutral: false, hue: 185, family: 'teal' },
  { name: 'turquoise', hex: '#2ec4c0', neutral: false, hue: 178, family: 'teal' },
  { name: 'mint', hex: '#a8e0c2', neutral: false, hue: 150, family: 'green' },
  { name: 'green', hex: '#2e7d32', neutral: false, hue: 120, family: 'green' },
  { name: 'forest green', hex: '#1e4d2b', neutral: false, hue: 140, family: 'green' },
  { name: 'lime', hex: '#a3d14a', neutral: false, hue: 85, family: 'green' },
  { name: 'yellow', hex: '#f9c80e', neutral: false, hue: 50, family: 'yellow' },
  { name: 'mustard', hex: '#c99a1e', neutral: false, hue: 45, family: 'yellow' },
  { name: 'gold', hex: '#c9a43a', neutral: true, family: 'yellow' },
  { name: 'orange', hex: '#ef6c00', neutral: false, hue: 30, family: 'orange' },
  { name: 'rust', hex: '#a8471f', neutral: false, hue: 18, family: 'orange' },
  { name: 'coral', hex: '#f2775f', neutral: false, hue: 10, family: 'orange' },
  { name: 'red', hex: '#c62828', neutral: false, hue: 0, family: 'red' },
  { name: 'burgundy', hex: '#6d1a2c', neutral: false, hue: 345, family: 'burgundy' },
  { name: 'pink', hex: '#ec6fa0', neutral: false, hue: 335, family: 'pink' },
  { name: 'light pink', hex: '#f5c2d0', neutral: false, hue: 340, family: 'pink' },
  { name: 'hot pink', hex: '#e0338a', neutral: false, hue: 330, family: 'pink' },
  { name: 'purple', hex: '#6a1b9a', neutral: false, hue: 280, family: 'purple' },
  { name: 'lavender', hex: '#b9a5dc', neutral: false, hue: 265, family: 'purple' },
];

const byName = (n: string) => COLORS.find((c) => c.name === n);

const ALIASES: Record<string, string> = {
  gray: 'grey',
  'light gray': 'light grey',
  'dark grey': 'charcoal',
  'dark gray': 'charcoal',
  ivory: 'cream',
  'off-white': 'cream',
  'off white': 'cream',
  maroon: 'burgundy',
  wine: 'burgundy',
  lilac: 'lavender',
  violet: 'purple',
  'sky blue': 'light blue',
  'baby blue': 'light blue',
  'royal blue': 'blue',
  'dark blue': 'navy',
  'dark green': 'forest green',
  'army green': 'olive',
  sage: 'mint',
  'mustard yellow': 'mustard',
  'rose': 'pink',
  'blush': 'light pink',
  magenta: 'hot pink',
  fuchsia: 'hot pink',
  peach: 'coral',
  'chocolate': 'dark brown',
  'sand': 'tan',
};

export function colorByName(name: string | null | undefined): NamedColor | undefined {
  if (!name) return undefined;
  const n = name.trim().toLowerCase();
  if (byName(n)) return byName(n);
  if (ALIASES[n]) return byName(ALIASES[n]);
  // Longest colour name contained in the text, e.g. "dark navy blue" -> navy.
  return [...COLORS].sort((a, b) => b.name.length - a.name.length).find((c) => n.includes(c.name));
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

// sRGB -> CIELAB, so colour distances match how different colours look to people.
function toLab([r, g, b]: [number, number, number]): [number, number, number] {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
  const y = f(R * 0.2126 + G * 0.7152 + B * 0.0722);
  const z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

const LABS = COLORS.map((c) => toLab(hexToRgb(c.hex)));

// How different two colours look (CIE76 distance in Lab; under ~10 is hard to tell apart).
export function colorDistance(a: string, b: string): number {
  const la = toLab(hexToRgb(colorByName(a)?.hex ?? a));
  const lb = toLab(hexToRgb(colorByName(b)?.hex ?? b));
  return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
}

// Closest named colour to a hex value.
export function nearestColorName(hex: string): string {
  const lab = toLab(hexToRgb(hex));
  let best = 0;
  let bestDist = Infinity;
  LABS.forEach((c, i) => {
    const d = (lab[0] - c[0]) ** 2 + (lab[1] - c[1]) ** 2 + (lab[2] - c[2]) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return COLORS[best].name;
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
