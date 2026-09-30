import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useUserId } from '../lib/auth';
import { setLiked } from '../lib/social';
import { radius, space, useTheme } from '../theme';
import { FeedPost } from '../types';
import { Avatar, Stars, StorageImage } from './ui';

export function timeAgo(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

// Controlled by the parent: likes update optimistically through onChange.
export function PostCard({ post: p, onChange }: { post: FeedPost; onChange: (p: FeedPost) => void }) {
  const t = useTheme();
  const userId = useUserId();

  async function toggleLike() {
    if (!userId) return;
    const next = { ...p, liked_by_me: !p.liked_by_me, like_count: p.like_count + (p.liked_by_me ? -1 : 1) };
    onChange(next);
    try {
      await setLiked(p.id, userId, next.liked_by_me);
    } catch {
      onChange(p);
    }
  }

  return (
    <View style={{ backgroundColor: t.card, borderRadius: radius.lg, borderWidth: 1, borderColor: t.border, overflow: 'hidden' }}>
      <Pressable
        onPress={() => router.push(`/user/${p.user_id}`)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md }}
        accessibilityLabel={`Open ${p.username}'s profile`}
      >
        <Avatar path={p.avatar_path} size={34} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontWeight: '700' }}>{p.display_name || p.username}</Text>
          <Text style={{ color: t.muted, fontSize: 12 }}>
            @{p.username} · {timeAgo(p.created_at)}
            {p.occasion ? ` · ${p.occasion}` : ''}
          </Text>
        </View>
      </Pressable>

      <Link href={`/post/${p.id}`} asChild>
        <Pressable accessibilityLabel="Open post">
          <StorageImage bucket="posts" path={p.image_path} style={{ width: '100%', aspectRatio: 3 / 4 }} />
        </Pressable>
      </Link>

      <View style={{ padding: space.md, gap: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
          <Pressable onPress={toggleLike} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} accessibilityLabel={p.liked_by_me ? 'Unlike' : 'Like'}>
            <Ionicons name={p.liked_by_me ? 'heart' : 'heart-outline'} size={24} color={p.liked_by_me ? t.danger : t.text} />
            <Text style={{ color: t.text, fontWeight: '600' }}>{p.like_count}</Text>
          </Pressable>
          <Pressable onPress={() => router.push(`/post/${p.id}`)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} accessibilityLabel="Comments">
            <Ionicons name="chatbubble-outline" size={22} color={t.text} />
            <Text style={{ color: t.text, fontWeight: '600' }}>{p.comment_count}</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          {p.avg_rating != null ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Stars value={Number(p.avg_rating)} size={15} />
              <Text style={{ color: t.muted, fontSize: 12 }}>({p.rating_count})</Text>
            </View>
          ) : null}
        </View>
        {p.ai_rating ? (
          <Text style={{ color: t.muted, fontSize: 13 }}>
            <Ionicons name="sparkles" size={12} color={t.accent} /> {p.ai_source === 'gemini_nano' ? 'AI' : 'Style'} rating: {p.ai_rating}/5
          </Text>
        ) : null}
        {p.caption ? (
          <Text style={{ color: t.text, lineHeight: 20 }}>
            <Text style={{ fontWeight: '700' }}>{p.username} </Text>
            {p.caption}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
