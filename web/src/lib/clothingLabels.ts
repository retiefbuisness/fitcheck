// Labels the photo AI chooses between. Their CLIP text embeddings are
// pre-computed (see LABEL_EMBEDDINGS in clothingEmbeddings.ts) so the phone only
// has to download the image half of the model. If you change, add or reorder
// labels here, the embeddings must be generated again in the same order.
import type { Category } from '../shared/types';

export interface GarmentLabel {
  prompt: string;
  category: Category;
  name: string;
  formality: number; // 1 very casual … 5 black tie
  warmth: number; // 1 very light … 5 very warm
}

export const GARMENTS: GarmentLabel[] = [
  { prompt: 'a t-shirt', category: 'top', name: 'T-shirt', formality: 1, warmth: 1 },
  { prompt: 'a long-sleeve t-shirt', category: 'top', name: 'Long-sleeve tee', formality: 1, warmth: 2 },
  { prompt: 'a polo shirt', category: 'top', name: 'Polo shirt', formality: 2, warmth: 1 },
  { prompt: 'a button-up shirt', category: 'top', name: 'Button-up shirt', formality: 3, warmth: 2 },
  { prompt: 'a blouse', category: 'top', name: 'Blouse', formality: 3, warmth: 1 },
  { prompt: 'a tank top', category: 'top', name: 'Tank top', formality: 1, warmth: 1 },
  { prompt: 'a crop top', category: 'top', name: 'Crop top', formality: 1, warmth: 1 },
  { prompt: 'a hoodie', category: 'top', name: 'Hoodie', formality: 1, warmth: 4 },
  { prompt: 'a sweatshirt', category: 'top', name: 'Sweatshirt', formality: 1, warmth: 3 },
  { prompt: 'a knitted sweater', category: 'top', name: 'Sweater', formality: 2, warmth: 4 },
  { prompt: 'a cardigan', category: 'top', name: 'Cardigan', formality: 2, warmth: 3 },
  { prompt: 'a pair of jeans', category: 'bottom', name: 'Jeans', formality: 2, warmth: 3 },
  { prompt: 'a pair of chino trousers', category: 'bottom', name: 'Chinos', formality: 3, warmth: 3 },
  { prompt: 'a pair of formal suit trousers', category: 'bottom', name: 'Trousers', formality: 4, warmth: 3 },
  { prompt: 'a pair of sweatpants', category: 'bottom', name: 'Sweatpants', formality: 1, warmth: 3 },
  { prompt: 'a pair of cargo pants', category: 'bottom', name: 'Cargo pants', formality: 1, warmth: 3 },
  { prompt: 'a pair of shorts', category: 'bottom', name: 'Shorts', formality: 1, warmth: 1 },
  { prompt: 'a skirt', category: 'bottom', name: 'Skirt', formality: 2, warmth: 1 },
  { prompt: 'a pair of leggings', category: 'activewear', name: 'Leggings', formality: 1, warmth: 2 },
  { prompt: 'a dress', category: 'dress', name: 'Dress', formality: 3, warmth: 1 },
  { prompt: 'a long evening gown', category: 'dress', name: 'Evening gown', formality: 5, warmth: 1 },
  { prompt: 'a blazer suit jacket', category: 'outerwear', name: 'Blazer', formality: 4, warmth: 3 },
  { prompt: 'a denim jacket', category: 'outerwear', name: 'Denim jacket', formality: 2, warmth: 3 },
  { prompt: 'a leather jacket', category: 'outerwear', name: 'Leather jacket', formality: 2, warmth: 3 },
  { prompt: 'a puffer jacket', category: 'outerwear', name: 'Puffer jacket', formality: 1, warmth: 5 },
  { prompt: 'a long winter coat', category: 'outerwear', name: 'Coat', formality: 3, warmth: 5 },
  { prompt: 'a windbreaker rain jacket', category: 'outerwear', name: 'Rain jacket', formality: 1, warmth: 3 },
  { prompt: 'a pair of sneakers', category: 'shoes', name: 'Sneakers', formality: 1, warmth: 2 },
  { prompt: 'a pair of boots', category: 'shoes', name: 'Boots', formality: 2, warmth: 4 },
  { prompt: 'a pair of high heels', category: 'shoes', name: 'Heels', formality: 4, warmth: 1 },
  { prompt: 'a pair of leather dress shoes', category: 'shoes', name: 'Dress shoes', formality: 4, warmth: 2 },
  { prompt: 'a pair of sandals', category: 'shoes', name: 'Sandals', formality: 1, warmth: 1 },
  { prompt: 'a pair of flip-flops or slides', category: 'shoes', name: 'Slides', formality: 1, warmth: 1 },
  { prompt: 'a baseball cap', category: 'accessory', name: 'Cap', formality: 1, warmth: 1 },
  { prompt: 'a beanie hat', category: 'accessory', name: 'Beanie', formality: 1, warmth: 4 },
  { prompt: 'a scarf', category: 'accessory', name: 'Scarf', formality: 2, warmth: 4 },
  { prompt: 'a leather belt', category: 'accessory', name: 'Belt', formality: 3, warmth: 2 },
  { prompt: 'a necklace or jewellery', category: 'accessory', name: 'Jewellery', formality: 3, warmth: 1 },
  { prompt: 'a wrist watch', category: 'accessory', name: 'Watch', formality: 3, warmth: 1 },
  { prompt: 'a pair of sunglasses', category: 'accessory', name: 'Sunglasses', formality: 2, warmth: 1 },
  { prompt: 'a necktie', category: 'accessory', name: 'Tie', formality: 4, warmth: 2 },
  { prompt: 'a handbag', category: 'bag', name: 'Handbag', formality: 3, warmth: 2 },
  { prompt: 'a backpack', category: 'bag', name: 'Backpack', formality: 1, warmth: 2 },
  { prompt: 'a tote bag', category: 'bag', name: 'Tote bag', formality: 2, warmth: 2 },
  { prompt: 'a sports jersey', category: 'activewear', name: 'Sports jersey', formality: 1, warmth: 1 },
  { prompt: 'a sports bra', category: 'activewear', name: 'Sports bra', formality: 1, warmth: 1 },
  { prompt: 'a tracksuit', category: 'activewear', name: 'Tracksuit', formality: 1, warmth: 3 },
  { prompt: 'a swimsuit or bikini', category: 'swimwear', name: 'Swimsuit', formality: 1, warmth: 1 },
  { prompt: 'a pair of swim shorts', category: 'swimwear', name: 'Swim shorts', formality: 1, warmth: 1 },
];

// Keys match PATTERNS in shared/types.ts.
export const PATTERN_LABELS: { prompt: string; pattern: string }[] = [
  { prompt: 'a plain solid colour piece of clothing with no pattern', pattern: 'solid' },
  { prompt: 'a striped piece of clothing', pattern: 'striped' },
  { prompt: 'a plaid checked piece of clothing', pattern: 'checked' },
  { prompt: 'a floral print piece of clothing', pattern: 'floral' },
  { prompt: 'a piece of clothing with a graphic print, logo or writing on it', pattern: 'graphic' },
  { prompt: 'a piece of clothing with an all-over pattern like polka dots, camo or animal print', pattern: 'print' },
];

// Keys match the colour names in shared/colors.ts.
export const COLOR_LABELS: { prompt: string; color: string }[] = [
  { prompt: 'black', color: 'black' },
  { prompt: 'white', color: 'white' },
  { prompt: 'grey', color: 'grey' },
  { prompt: 'navy blue', color: 'navy' },
  { prompt: 'light blue denim', color: 'denim' },
  { prompt: 'beige', color: 'beige' },
  { prompt: 'cream off-white', color: 'cream' },
  { prompt: 'brown', color: 'brown' },
  { prompt: 'khaki', color: 'khaki' },
  { prompt: 'olive green', color: 'olive' },
  { prompt: 'red', color: 'red' },
  { prompt: 'burgundy', color: 'burgundy' },
  { prompt: 'pink', color: 'pink' },
  { prompt: 'orange', color: 'orange' },
  { prompt: 'yellow', color: 'yellow' },
  { prompt: 'green', color: 'green' },
  { prompt: 'teal', color: 'teal' },
  { prompt: 'bright blue', color: 'blue' },
  { prompt: 'purple', color: 'purple' },
];

// The exact sentences given to the text model, in the order the embeddings are stored.
export const LABEL_TEXTS: string[] = [
  ...GARMENTS.map((g) => `a photo of ${g.prompt}.`),
  ...PATTERN_LABELS.map((p) => `a photo of ${p.prompt}.`),
  ...COLOR_LABELS.map((c) => `a photo of a ${c.prompt} piece of clothing.`),
];
