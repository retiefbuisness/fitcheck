import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { EMPTY_DRAFT, ItemDraft, ItemForm } from '../../src/components/ItemForm';
import { Button, Screen } from '../../src/components/ui';
import { describeClothing } from '../../src/lib/ai';
import { useUserId } from '../../src/lib/auth';
import { colorByName } from '../../src/lib/colors';
import { pickImage, prepareImage, uploadImage } from '../../src/lib/images';
import { friendlyError, supabase } from '../../src/lib/supabase';
import { space, useTheme } from '../../src/theme';

export default function AddItem() {
  const t = useTheme();
  const userId = useUserId();
  const [photo, setPhoto] = useState<{ uri: string; base64: string } | null>(null);
  const [draft, setDraft] = useState<ItemDraft>(EMPTY_DRAFT);
  const [tagging, setTagging] = useState(false);
  const [saving, setSaving] = useState(false);

  async function choose(source: 'camera' | 'library') {
    const uri = await pickImage(source);
    if (!uri) return;
    const prepared = await prepareImage(uri, 900);
    setPhoto(prepared);
    setTagging(true);
    try {
      const guess = await describeClothing(prepared.uri);
      setDraft((d) => ({
        ...d,
        ...(guess.category ? { category: guess.category } : {}),
        ...(guess.name ? { name: guess.name } : {}),
        ...(guess.color && colorByName(guess.color) ? { color: colorByName(guess.color)!.name } : {}),
        ...(guess.pattern ? { pattern: guess.pattern } : {}),
        ...(guess.formality ? { formality: guess.formality } : {}),
        ...(guess.warmth ? { warmth: guess.warmth } : {}),
      }));
    } finally {
      setTagging(false);
    }
  }

  async function save() {
    if (!userId) return;
    setSaving(true);
    try {
      const image_path = photo ? await uploadImage('closet', userId, photo.base64) : null;
      const { error } = await supabase.from('closet_items').insert({
        user_id: userId,
        image_path,
        name: draft.name.trim() || null,
        category: draft.category,
        color: draft.color,
        secondary_color: draft.secondary_color,
        pattern: draft.pattern,
        formality: draft.formality,
        warmth: draft.warmth,
        notes: draft.notes.trim() || null,
      });
      if (error) throw error;
      router.back();
    } catch (e) {
      Alert.alert("Couldn't save", friendlyError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen edges={['bottom']}>
      {photo ? (
        <Image source={{ uri: photo.uri }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 16 }} contentFit="cover" />
      ) : (
        <View style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 16, backgroundColor: t.soft, alignItems: 'center', justifyContent: 'center', padding: space.xl }}>
          <Text style={{ color: t.muted, textAlign: 'center', lineHeight: 20 }}>
            Lay the item flat or hang it up against a plain background for the best results.
          </Text>
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button title="Camera" icon="camera-outline" variant="secondary" onPress={() => choose('camera')} style={{ flex: 1 }} />
        <Button title="Gallery" icon="images-outline" variant="secondary" onPress={() => choose('library')} style={{ flex: 1 }} />
      </View>
      {tagging ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <ActivityIndicator color={t.accent} />
          <Text style={{ color: t.muted }}>Filling in the details for you…</Text>
        </View>
      ) : null}
      <ItemForm draft={draft} onChange={setDraft} />
      <Button title="Add to closet" onPress={save} loading={saving} disabled={tagging} />
    </Screen>
  );
}
