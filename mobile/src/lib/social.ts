import { Alert } from 'react-native';
import { ReportTarget } from '../types';
import { supabase } from './supabase';

export async function setLiked(postId: string, userId: string, liked: boolean) {
  if (liked) {
    const { error } = await supabase.from('likes').insert({ post_id: postId, user_id: userId });
    if (error && error.code !== '23505') throw error;
  } else {
    const { error } = await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', userId);
    if (error) throw error;
  }
}

export async function ratePost(postId: string, userId: string, stars: number) {
  const { error } = await supabase
    .from('post_ratings')
    .upsert({ post_id: postId, user_id: userId, stars }, { onConflict: 'post_id,user_id' });
  if (error) throw error;
}

export async function setFollowing(targetId: string, userId: string, follow: boolean) {
  if (follow) {
    const { error } = await supabase.from('follows').insert({ follower_id: userId, following_id: targetId });
    if (error && error.code !== '23505') throw error;
  } else {
    const { error } = await supabase.from('follows').delete().eq('follower_id', userId).eq('following_id', targetId);
    if (error) throw error;
  }
}

export async function blockUser(targetId: string, userId: string) {
  const { error } = await supabase.from('blocks').insert({ blocker_id: userId, blocked_id: targetId });
  if (error && error.code !== '23505') throw error;
}

export async function unblockUser(targetId: string, userId: string) {
  const { error } = await supabase.from('blocks').delete().eq('blocker_id', userId).eq('blocked_id', targetId);
  if (error) throw error;
}

export const REPORT_REASONS: { id: string; label: string }[] = [
  { id: 'minor_safety', label: 'Child safety concern' },
  { id: 'nudity', label: 'Nudity or sexual content' },
  { id: 'harassment', label: 'Bullying or harassment' },
  { id: 'hate', label: 'Hate speech' },
  { id: 'violence', label: 'Violence or threats' },
  { id: 'self_harm', label: 'Self-harm' },
  { id: 'spam', label: 'Spam or scam' },
  { id: 'offensive_ai', label: 'Offensive or harmful AI response' },
  { id: 'other', label: 'Something else' },
];

export async function submitReport(params: {
  userId: string;
  targetType: ReportTarget;
  targetId?: string | null;
  reason: string;
  details?: string;
}) {
  const { error } = await supabase.from('reports').insert({
    reporter_id: params.userId,
    target_type: params.targetType,
    target_id: params.targetId ?? null,
    reason: params.reason,
    details: params.details?.slice(0, 2000) || null,
  });
  if (error && error.code === '23505') {
    Alert.alert('Already reported', "You've already reported this. Thanks, we're on it.");
    return;
  }
  if (error) throw error;
}
