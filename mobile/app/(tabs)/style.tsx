import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { AiBanner, useAiStatus } from '../../src/components/AiBanner';
import { OutfitCard } from '../../src/components/OutfitCard';
import { Body, Button, Card, Chip, ChipRow, Heading, Screen } from '../../src/components/ui';
import { suggestOutfits } from '../../src/lib/ai';
import { useUserId } from '../../src/lib/auth';
import { OCCASIONS, WEATHER, closetGaps, occasionById, weatherById } from '../../src/lib/styleRules';
import { friendlyError, supabase } from '../../src/lib/supabase';
import { space, useTheme } from '../../src/theme';
import { ClosetItem, OutfitIdea } from '../../src/types';

export default function StyleMe() {
  const t = useTheme();
  const userId = useUserId();
  const { status, refresh } = useAiStatus();
  const [closet, setCloset] = useState<ClosetItem[]>([]);
  const [occasion, setOccasion] = useState('casual');
  const [weather, setWeather] = useState('mild');
  const [rain, setRain] = useState(false);
  const [ideas, setIdeas] = useState<OutfitIdea[]>([]);
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [seed, setSeed] = useState(1);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      supabase
        .from('closet_items')
        .select('*')
        .eq('user_id', userId)
        .then(({ data }) => setCloset((data ?? []) as ClosetItem[]));
    }, [userId]),
  );

  const gaps = closetGaps(closet);
  const ctx = { occasion: occasionById(occasion), weather: weatherById(weather), rain };

  async function generate(nextSeed = seed) {
    setBusy(true);
    setSaved(new Set());
    try {
      const { ideas: result } = await suggestOutfits(closet, ctx, nextSeed);
      setIdeas(result);
      if (result.length === 0) Alert.alert('No outfits found', 'Add a few more items to your closet and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function save(i: number) {
    const idea = ideas[i];
    const { error } = await supabase.from('saved_outfits').insert({
      user_id: userId,
      item_ids: idea.itemIds,
      occasion: ctx.occasion.label,
      explanation: idea.explanation,
      source: idea.source,
    });
    if (error) return Alert.alert("Couldn't save", friendlyError(error));
    setSaved((s) => new Set(s).add(i));
  }

  return (
    <Screen>
      <AiBanner status={status} onChange={refresh} />

      <Heading>What’s the occasion?</Heading>
      <ChipRow>
        {OCCASIONS.map((o) => (
          <Chip key={o.id} label={o.label} selected={occasion === o.id} onPress={() => setOccasion(o.id)} />
        ))}
      </ChipRow>

      <Heading>What’s the weather like?</Heading>
      <ChipRow>
        {WEATHER.map((w) => (
          <Chip key={w.id} label={w.label} selected={weather === w.id} onPress={() => setWeather(w.id)} />
        ))}
      </ChipRow>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Body>Rain expected</Body>
        <Switch value={rain} onValueChange={setRain} trackColor={{ true: t.accent }} />
      </View>

      {gaps.length > 0 ? (
        <Card>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Ionicons name="shirt-outline" size={20} color={t.accent} />
            <Text style={{ color: t.text, flex: 1, lineHeight: 20 }}>
              To get outfit ideas, add {gaps.join(' and ')} to your closet.
            </Text>
          </View>
          <Button title="Add clothes" variant="secondary" onPress={() => router.push('/closet/add')} />
        </Card>
      ) : (
        <Button
          title={ideas.length ? 'Shuffle ideas' : 'Get outfit ideas'}
          icon={ideas.length ? 'shuffle' : 'sparkles'}
          loading={busy}
          onPress={() => {
            const next = ideas.length ? seed + 1 : seed;
            setSeed(next);
            generate(next);
          }}
        />
      )}

      {ideas.map((idea, i) => (
        <OutfitCard key={`${seed}-${i}`} idea={idea} items={closet} index={i} onSave={() => save(i)} saved={saved.has(i)} />
      ))}
    </Screen>
  );
}
