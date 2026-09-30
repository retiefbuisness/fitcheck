import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Alert, Linking } from 'react-native';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { supabase } from './supabase';

export type Bucket = 'closet' | 'posts' | 'avatars';

// Opens the camera or the system photo picker. The photo picker needs no
// storage permission, which keeps us within Google Play's photo policy.
export async function pickImage(source: 'camera' | 'library', aspect: [number, number] = [3, 4]) {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera access needed', 'Allow camera access in Settings to take photos.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]);
      return null;
    }
  }
  const opts: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect,
    quality: 1,
  };
  const result =
    source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0].uri;
}

// Shrinks and compresses a photo before upload (saves data and storage).
export async function prepareImage(uri: string, maxWidth = 1080) {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: maxWidth });
  const rendered = await ctx.renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.75, format: SaveFormat.JPEG, base64: true });
  return { uri: saved.uri, base64: saved.base64 ?? '' };
}

export async function uploadImage(bucket: Bucket, userId: string, base64: string) {
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, decode(base64), { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}

export async function removeImage(bucket: Bucket, path: string | null | undefined) {
  if (!path) return;
  await supabase.storage.from(bucket).remove([path]);
}

// Image source for a private storage file; the signed-in user's token is sent
// as a header. cacheKey keeps images cached across token refreshes.
export function storageSource(bucket: Bucket, path: string | null | undefined, token: string | undefined) {
  if (!path || !token) return null;
  return {
    uri: `${SUPABASE_URL}/storage/v1/object/authenticated/${bucket}/${path}`,
    headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY },
    cacheKey: `${bucket}/${path}`,
  };
}
