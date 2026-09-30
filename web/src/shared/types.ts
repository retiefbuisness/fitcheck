// Shared with the mobile app (mobile/src). Keep the two copies in sync.
export type Category =
  | 'top'
  | 'bottom'
  | 'dress'
  | 'outerwear'
  | 'shoes'
  | 'accessory'
  | 'bag'
  | 'activewear'
  | 'swimwear'
  | 'other';

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'top', label: 'Tops' },
  { id: 'bottom', label: 'Bottoms' },
  { id: 'dress', label: 'Dresses' },
  { id: 'outerwear', label: 'Outerwear' },
  { id: 'shoes', label: 'Shoes' },
  { id: 'accessory', label: 'Accessories' },
  { id: 'bag', label: 'Bags' },
  { id: 'activewear', label: 'Activewear' },
  { id: 'swimwear', label: 'Swimwear' },
  { id: 'other', label: 'Other' },
];

export const PATTERNS = ['solid', 'striped', 'checked', 'floral', 'graphic', 'print', 'other'] as const;

export interface ClosetItem {
  id: string;
  user_id: string;
  image_path: string | null;
  name: string | null;
  category: Category;
  color: string;
  secondary_color: string | null;
  pattern: string;
  formality: number;
  warmth: number;
  notes: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_path: string | null;
  created_at: string;
}

export interface FeedPost {
  id: string;
  user_id: string;
  image_path: string;
  caption: string | null;
  occasion: string | null;
  ai_rating: number | null;
  ai_feedback: string | null;
  ai_source: 'gemini_nano' | 'rules' | null;
  is_hidden: boolean;
  created_at: string;
  username: string;
  display_name: string | null;
  avatar_path: string | null;
  like_count: number;
  comment_count: number;
  avg_rating: number | null;
  rating_count: number;
  liked_by_me: boolean;
  my_rating: number | null;
}

export interface CommentRow {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles: Pick<Profile, 'username' | 'display_name' | 'avatar_path'> | null;
}

export interface NotificationRow {
  id: string;
  type: 'like' | 'comment' | 'tag' | 'follow' | 'rating';
  post_id: string | null;
  actor_id: string;
  read_at: string | null;
  created_at: string;
  actor: Pick<Profile, 'username' | 'display_name' | 'avatar_path'> | null;
}

export interface OutfitIdea {
  itemIds: string[];
  explanation: string;
  source: 'ai' | 'rules';
}

export interface RatingResult {
  rating: number;
  summary: string;
  works: string[];
  improve: string[];
  source: 'gemini_nano' | 'rules';
}

export type ReportTarget = 'post' | 'comment' | 'user' | 'ai_response';
