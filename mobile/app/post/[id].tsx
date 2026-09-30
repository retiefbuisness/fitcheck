import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { PostCard, timeAgo } from '../../src/components/PostCard';
import { Avatar, Body, Button, Card, Heading, Input, Loading, Screen, Stars } from '../../src/components/ui';
import { useUserId } from '../../src/lib/auth';
import { removeImage } from '../../src/lib/images';
import { ratePost } from '../../src/lib/social';
import { friendlyError, supabase } from '../../src/lib/supabase';
import { space, useTheme } from '../../src/theme';
import { CommentRow, FeedPost } from '../../src/types';

interface TagRow {
  tagged_user_id: string;
  profiles: { username: string } | null;
}

export default function PostScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useUserId();
  const [post, setPost] = useState<FeedPost | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [tags, setTags] = useState<TagRow[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    const [p, c, tg] = await Promise.all([
      supabase.from('post_feed').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('comments')
        .select('id, post_id, user_id, body, created_at, profiles(username, display_name, avatar_path)')
        .eq('post_id', id)
        .order('created_at'),
      supabase.from('post_tags').select('tagged_user_id, profiles(username)').eq('post_id', id),
    ]);
    if (!p.data) return setMissing(true);
    setPost(p.data as FeedPost);
    setComments((c.data ?? []) as unknown as CommentRow[]);
    setTags((tg.data ?? []) as unknown as TagRow[]);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (missing) {
    return (
      <Screen>
        <Body muted>This fit isn’t available. It may have been deleted or hidden.</Body>
      </Screen>
    );
  }
  if (!post || !me) return <Loading />;
  const mine = post.user_id === me;

  async function send() {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    const { error } = await supabase.from('comments').insert({ post_id: id, user_id: me, body });
    setSending(false);
    if (error) return Alert.alert("Couldn't comment", friendlyError(error));
    setText('');
    load();
  }

  async function rate(stars: number) {
    setPost((p) => (p ? { ...p, my_rating: stars } : p));
    try {
      await ratePost(id, me!, stars);
      load();
    } catch (e) {
      Alert.alert("Couldn't rate", friendlyError(e));
    }
  }

  function postMenu() {
    if (mine) {
      Alert.alert('Delete this fit?', 'This removes the post, its photo, comments and ratings.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('posts').delete().eq('id', id);
            if (error) return Alert.alert("Couldn't delete", friendlyError(error));
            await removeImage('posts', post!.image_path);
            router.back();
          },
        },
      ]);
    } else {
      Alert.alert('Options', undefined, [
        { text: 'Report post', onPress: () => router.push({ pathname: '/report', params: { type: 'post', id } }) },
        { text: `View @${post!.username}`, onPress: () => router.push(`/user/${post!.user_id}`) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }

  function commentMenu(c: CommentRow) {
    const canDelete = c.user_id === me || mine;
    Alert.alert('Comment', undefined, [
      ...(c.user_id !== me
        ? [{ text: 'Report comment', onPress: () => router.push({ pathname: '/report', params: { type: 'comment', id: c.id } }) }]
        : []),
      ...(canDelete
        ? [
            {
              text: 'Delete comment',
              style: 'destructive' as const,
              onPress: async () => {
                await supabase.from('comments').delete().eq('id', c.id);
                load();
              },
            },
          ]
        : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }

  async function removeMyTag() {
    await supabase.from('post_tags').delete().eq('post_id', id).eq('tagged_user_id', me!);
    load();
  }

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={postMenu} hitSlop={10} accessibilityLabel="Post options">
              <Ionicons name="ellipsis-horizontal" size={24} color={t.text} />
            </Pressable>
          ),
        }}
      />
      <PostCard post={post} onChange={setPost} />

      {tags.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' }}>
          <Ionicons name="pricetag-outline" size={16} color={t.muted} />
          {tags.map((tg) => (
            <Pressable key={tg.tagged_user_id} onPress={() => router.push(`/user/${tg.tagged_user_id}`)}>
              <Text style={{ color: t.accent, fontWeight: '600' }}>@{tg.profiles?.username}</Text>
            </Pressable>
          ))}
          {tags.some((tg) => tg.tagged_user_id === me) ? (
            <Pressable onPress={removeMyTag}>
              <Text style={{ color: t.muted, textDecorationLine: 'underline', fontSize: 13 }}>Remove my tag</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {post.ai_feedback ? (
        <Card>
          <Text style={{ color: t.text, fontWeight: '700' }}>
            {post.ai_source === 'gemini_nano' ? '✨ AI' : 'Style'} rating: {post.ai_rating}/5
          </Text>
          <Text style={{ color: t.text, lineHeight: 20 }}>{post.ai_feedback}</Text>
          {post.ai_source === 'gemini_nano' ? (
            <Pressable
              onPress={() => router.push({ pathname: '/report', params: { type: 'ai_response', id, details: post.ai_feedback ?? '' } })}
              hitSlop={8}
            >
              <Text style={{ color: t.muted, fontSize: 13, textDecorationLine: 'underline' }}>Report this AI response</Text>
            </Pressable>
          ) : null}
        </Card>
      ) : null}

      {!mine ? (
        <Card>
          <Text style={{ color: t.text, fontWeight: '700' }}>{post.my_rating ? 'Your rating' : 'Rate this fit'}</Text>
          <Stars value={post.my_rating} size={32} onChange={rate} />
        </Card>
      ) : null}

      <Heading>Comments</Heading>
      {comments.length === 0 ? <Body muted>No comments yet. Share a kind tip!</Body> : null}
      {comments.map((c) => (
        <Pressable key={c.id} onLongPress={() => commentMenu(c)} style={{ flexDirection: 'row', gap: space.sm }}>
          <Pressable onPress={() => router.push(`/user/${c.user_id}`)}>
            <Avatar path={c.profiles?.avatar_path} size={32} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, lineHeight: 20 }}>
              <Text style={{ fontWeight: '700' }}>{c.profiles?.username} </Text>
              {c.body}
            </Text>
            <Text style={{ color: t.muted, fontSize: 12 }}>
              {timeAgo(c.created_at)} · hold for options
            </Text>
          </View>
        </Pressable>
      ))}

      <Input placeholder="Add a comment…" value={text} onChangeText={setText} maxLength={500} multiline />
      <Button title="Post comment" onPress={send} loading={sending} disabled={!text.trim()} />
    </Screen>
  );
}
