import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Avatar, Button, Input, Screen } from '../src/components/ui';
import { useAuth } from '../src/lib/auth';
import { pickImage, prepareImage, removeImage, uploadImage } from '../src/lib/images';
import { friendlyError, supabase } from '../src/lib/supabase';
import { space, useTheme } from '../src/theme';

export default function EditProfile() {
  const t = useTheme();
  const { profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  if (!profile) return null;

  async function changePhoto() {
    const uri = await pickImage('library', [1, 1]);
    if (!uri) return;
    setUploading(true);
    try {
      const img = await prepareImage(uri, 400);
      const path = await uploadImage('avatars', profile!.id, img.base64);
      const { error } = await supabase.from('profiles').update({ avatar_path: path }).eq('id', profile!.id);
      if (error) throw error;
      await removeImage('avatars', profile!.avatar_path);
      await refreshProfile();
    } catch (e) {
      Alert.alert("Couldn't update photo", friendlyError(e));
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim() || null, bio: bio.trim() || null })
      .eq('id', profile!.id);
    setSaving(false);
    if (error) return Alert.alert("Couldn't save", friendlyError(error));
    await refreshProfile();
    router.back();
  }

  return (
    <Screen edges={['bottom']}>
      <View style={{ alignItems: 'center', gap: space.sm }}>
        <Avatar path={profile.avatar_path} size={96} />
        <Pressable onPress={changePhoto} disabled={uploading}>
          <Text style={{ color: t.accent, fontWeight: '700' }}>{uploading ? 'Uploading…' : 'Change photo'}</Text>
        </Pressable>
      </View>
      <Input label="Username" value={`@${profile.username}`} editable={false} />
      <Input label="Display name" value={displayName} onChangeText={setDisplayName} maxLength={40} />
      <Input label="Bio" value={bio} onChangeText={setBio} maxLength={160} multiline />
      <Button title="Save" onPress={save} loading={saving} />
    </Screen>
  );
}
