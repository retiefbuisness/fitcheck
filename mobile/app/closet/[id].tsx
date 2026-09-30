import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { ItemDraft, ItemForm } from '../../src/components/ItemForm';
import { Button, Loading, Screen, StorageImage } from '../../src/components/ui';
import { removeImage } from '../../src/lib/images';
import { friendlyError, supabase } from '../../src/lib/supabase';
import { ClosetItem } from '../../src/types';

export default function ClosetItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<ClosetItem | null>(null);
  const [draft, setDraft] = useState<ItemDraft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from('closet_items')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return router.back();
        const it = data as ClosetItem;
        setItem(it);
        setDraft({
          name: it.name ?? '',
          category: it.category,
          color: it.color,
          secondary_color: it.secondary_color,
          pattern: it.pattern,
          formality: it.formality,
          warmth: it.warmth,
          notes: it.notes ?? '',
        });
      });
  }, [id]);

  if (!item || !draft) return <Loading />;

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from('closet_items')
      .update({
        name: draft!.name.trim() || null,
        category: draft!.category,
        color: draft!.color,
        secondary_color: draft!.secondary_color,
        pattern: draft!.pattern,
        formality: draft!.formality,
        warmth: draft!.warmth,
        notes: draft!.notes.trim() || null,
      })
      .eq('id', id);
    setSaving(false);
    if (error) Alert.alert("Couldn't save", friendlyError(error));
    else router.back();
  }

  function remove() {
    Alert.alert('Remove from closet?', 'This deletes the item and its photo.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('closet_items').delete().eq('id', id);
          if (error) return Alert.alert("Couldn't remove", friendlyError(error));
          await removeImage('closet', item!.image_path);
          router.back();
        },
      },
    ]);
  }

  return (
    <Screen edges={['bottom']}>
      <StorageImage bucket="closet" path={item.image_path} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 16 }} />
      <ItemForm draft={draft} onChange={setDraft} />
      <Button title="Save changes" onPress={save} loading={saving} />
      <Button title="Remove from closet" variant="danger" onPress={remove} />
    </Screen>
  );
}
