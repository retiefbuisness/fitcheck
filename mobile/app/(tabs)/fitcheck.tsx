import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, Switch, Text, View } from 'react-native';
import { AiBanner, useAiStatus } from '../../src/components/AiBanner';
import { RatingCard, ratingToText } from '../../src/components/RatingCard';
import { Avatar, Body, Button, Card, Chip, ChipRow, Heading, Input, Screen, StorageImage } from '../../src/components/ui';
import { rateOutfitPhoto } from '../../src/lib/ai';
import { useUserId } from '../../src/lib/auth';
import { pickImage, prepareImage, uploadImage } from '../../src/lib/images';
import { OCCASIONS, label, occasionById, rateOutfitWithRules, weatherById } from '../../src/lib/styleRules';
import { friendlyError, supabase } from '../../src/lib/supabase';
import { space, useTheme } from '../../src/theme';
import { ClosetItem, Profile, RatingResult } from '../../src/types';

type Tagged = Pick<Profile, 'id' | 'username' | 'avatar_path'>;

export default function FitCheckTab() {
  const t = useTheme();
  const userId = useUserId();
  const { status, refresh } = useAiStatus();
  const [photo, setPhoto] = useState<{ uri: string; base64: string } | null>(null);
  const [occasion, setOccasion] = useState('casual');
  const [rating, setRating] = useState<RatingResult | null>(null);
  const [rating_busy, setRatingBusy] = useState(false);
  const [closet, setCloset] = useState<ClosetItem[]>([]);
  const [wearing, setWearing] = useState<Set<string>>(new Set());
  const [showPicker, setShowPicker] = useState(false);
  const [caption, setCaption] = useState('');
  const [includeRating, setIncludeRating] = useState(true);
  const [tagQuery, setTagQuery] = useState('');
  const [tagResults, setTagResults] = useState<Tagged[]>([]);
  const [tagged, setTagged] = useState<Tagged[]>([]);
  const [posting, setPosting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      supabase
        .from('closet_items')
        .select('*')
        .eq('user_id', userId)
        .order('category')
        .then(({ data }) => setCloset((data ?? []) as ClosetItem[]));
    }, [userId]),
  );

  function reset() {
    setPhoto(null);
    setRating(null);
    setWearing(new Set());
    setShowPicker(false);
    setCaption('');
    setTagged([]);
    setTagQuery('');
    setTagResults([]);
  }

  async function choose(source: 'camera' | 'library') {
    const uri = await pickImage(source);
    if (!uri) return;
    setRating(null);
    setPhoto(await prepareImage(uri));
  }

  async function rate() {
    if (!photo) return;
    setRatingBusy(true);
    try {
      const result = await rateOutfitPhoto(photo.uri, occasionById(occasion).label);
      if (result) setRating(result);
      else setShowPicker(true);
    } catch (e: any) {
      Alert.alert('Hmm', e?.message ?? "Couldn't rate that photo.");
    } finally {
      setRatingBusy(false);
    }
  }

  function rateFromCloset() {
    const items = closet.filter((c) => wearing.has(c.id));
    if (items.length === 0) return Alert.alert('Pick what you are wearing', 'Tap the items from your closet in this outfit.');
    setRating(rateOutfitWithRules(items, { occasion: occasionById(occasion), weather: weatherById('mild'), rain: false }));
    setShowPicker(false);
  }

  async function searchPeople(q: string) {
    setTagQuery(q);
    const clean = q.trim().toLowerCase().replace(/^@/, '');
    if (clean.length < 2) return setTagResults([]);
    const { data } = await supabase
      .from('profiles')
      .select('id, username, avatar_path')
      .ilike('username', `${clean.replace(/[%_]/g, '')}%`)
      .neq('id', userId)
      .limit(6);
    setTagResults(((data ?? []) as Tagged[]).filter((p) => !tagged.some((x) => x.id === p.id)));
  }

  async function post() {
    if (!photo || !userId) return;
    setPosting(true);
    try {
      const image_path = await uploadImage('posts', userId, photo.base64);
      const withRating = includeRating && rating;
      const { data, error } = await supabase
        .from('posts')
        .insert({
          user_id: userId,
          image_path,
          caption: caption.trim() || null,
          occasion: occasionById(occasion).label,
          ai_rating: withRating ? rating!.rating : null,
          ai_feedback: withRating ? ratingToText(rating!).slice(0, 2000) : null,
          ai_source: withRating ? rating!.source : null,
        })
        .select('id')
        .single();
      if (error) throw error;
      if (tagged.length) {
        const { error: tagError } = await supabase
          .from('post_tags')
          .insert(tagged.map((p) => ({ post_id: data.id, tagged_user_id: p.id })));
        if (tagError) Alert.alert('Posted', "Your fit is up, but some tags couldn't be added.");
      }
      reset();
      router.push(`/post/${data.id}`);
    } catch (e) {
      Alert.alert("Couldn't post", friendlyError(e));
    } finally {
      setPosting(false);
    }
  }

  return (
    <Screen>
      <AiBanner status={status} onChange={refresh} />

      {photo ? (
        <View>
          <Image source={{ uri: photo.uri }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 16 }} contentFit="cover" />
          <Pressable
            onPress={reset}
            accessibilityLabel="Remove photo"
            style={{ position: 'absolute', top: 10, right: 10, backgroundColor: '#0008', borderRadius: 16, padding: 6 }}
          >
            <Ionicons name="close" size={20} color="#fff" />
          </Pressable>
        </View>
      ) : (
        <Card style={{ alignItems: 'center', paddingVertical: space.xl }}>
          <Ionicons name="camera-outline" size={40} color={t.accent} />
          <Text style={{ color: t.text, fontSize: 18, fontWeight: '800' }}>What are you wearing today?</Text>
          <Body muted style={{ textAlign: 'center' }}>
            Snap a full-length photo of your outfit to get it rated and share it.
          </Body>
        </Card>
      )}

      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button title="Camera" icon="camera-outline" variant="secondary" onPress={() => choose('camera')} style={{ flex: 1 }} />
        <Button title="Gallery" icon="images-outline" variant="secondary" onPress={() => choose('library')} style={{ flex: 1 }} />
      </View>

      {photo ? (
        <>
          <Heading>What’s it for?</Heading>
          <ChipRow>
            {OCCASIONS.map((o) => (
              <Chip key={o.id} label={o.label} selected={occasion === o.id} onPress={() => { setOccasion(o.id); setRating(null); }} />
            ))}
          </ChipRow>

          {!rating ? <Button title="Rate my fit" icon="star" onPress={rate} loading={rating_busy} /> : <RatingCard result={rating} />}

          {showPicker && !rating ? (
            <Card>
              <Text style={{ color: t.text, fontWeight: '700' }}>
                {status === 'available' ? "The AI couldn't rate this photo." : 'On-device AI isn’t available on this phone.'}
              </Text>
              <Body muted>
                Tap the closet items you’re wearing to get a style rating instead, or just post it and let the community rate it.
              </Body>
              {closet.length === 0 ? (
                <Body muted>Your closet is empty. Add clothes from the Closet tab.</Body>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                  {closet.map((it) => {
                    const on = wearing.has(it.id);
                    return (
                      <Pressable
                        key={it.id}
                        onPress={() =>
                          setWearing((s) => {
                            const n = new Set(s);
                            if (on) n.delete(it.id);
                            else n.add(it.id);
                            return n;
                          })
                        }
                        accessibilityState={{ selected: on }}
                        accessibilityLabel={label(it)}
                        style={{ width: '22%', opacity: on ? 1 : 0.55 }}
                      >
                        <StorageImage bucket="closet" path={it.image_path} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 8, borderWidth: on ? 3 : 0, borderColor: t.accent }} />
                      </Pressable>
                    );
                  })}
                </View>
              )}
              <Button title="Rate from my closet" variant="secondary" onPress={rateFromCloset} disabled={wearing.size === 0} />
            </Card>
          ) : null}

          <Heading>Share it</Heading>
          <Input placeholder="Write a caption…" value={caption} onChangeText={setCaption} maxLength={500} multiline />

          <Input placeholder="Tag people: type a username" value={tagQuery} onChangeText={searchPeople} autoCapitalize="none" />
          {tagResults.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => {
                setTagged((x) => [...x, p]);
                setTagResults([]);
                setTagQuery('');
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}
            >
              <Avatar path={p.avatar_path} size={28} />
              <Text style={{ color: t.text }}>@{p.username}</Text>
            </Pressable>
          ))}
          {tagged.length ? (
            <ChipRow>
              {tagged.map((p) => (
                <Chip key={p.id} label={`@${p.username} ✕`} selected onPress={() => setTagged((x) => x.filter((y) => y.id !== p.id))} />
              ))}
            </ChipRow>
          ) : null}

          {rating ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Body>Show my rating on the post</Body>
              <Switch value={includeRating} onValueChange={setIncludeRating} trackColor={{ true: t.accent }} />
            </View>
          ) : null}

          <Button title="Post fit" icon="send" onPress={post} loading={posting} />
          <Body muted style={{ fontSize: 12 }}>
            Only post photos of yourself or people who agreed, and never anyone under 18.
          </Body>
        </>
      ) : null}
    </Screen>
  );
}
