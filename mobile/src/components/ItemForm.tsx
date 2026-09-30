import { Pressable, Text, View } from 'react-native';
import { COLORS } from '../lib/colors';
import { space, useTheme } from '../theme';
import { CATEGORIES, Category, PATTERNS } from '../types';
import { Chip, ChipRow, Heading, Input } from './ui';

export interface ItemDraft {
  name: string;
  category: Category;
  color: string;
  secondary_color: string | null;
  pattern: string;
  formality: number;
  warmth: number;
  notes: string;
}

export const EMPTY_DRAFT: ItemDraft = {
  name: '',
  category: 'top',
  color: 'black',
  secondary_color: null,
  pattern: 'solid',
  formality: 2,
  warmth: 2,
  notes: '',
};

const FORMALITY = ['Very casual', 'Casual', 'Smart casual', 'Dressy', 'Formal'];
const WARMTH = ['Very light', 'Light', 'Medium', 'Warm', 'Very warm'];

function Scale({ value, labels, onChange }: { value: number; labels: string[]; onChange: (v: number) => void }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {labels.map((l, i) => (
          <Pressable
            key={l}
            onPress={() => onChange(i + 1)}
            accessibilityLabel={l}
            accessibilityState={{ selected: value === i + 1 }}
            style={{ flex: 1, height: 34, borderRadius: 8, backgroundColor: i + 1 <= value ? t.accent : t.soft }}
          />
        ))}
      </View>
      <Text style={{ color: t.muted, fontSize: 13 }}>{labels[value - 1]}</Text>
    </View>
  );
}

function Swatches({ value, onChange, allowNone }: { value: string | null; onChange: (v: string | null) => void; allowNone?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {allowNone ? (
        <Pressable
          onPress={() => onChange(null)}
          accessibilityLabel="No second colour"
          style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: value == null ? t.accent : t.border, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: t.muted }}>–</Text>
        </Pressable>
      ) : null}
      {COLORS.map((c) => (
        <Pressable
          key={c.name}
          onPress={() => onChange(c.name)}
          accessibilityLabel={c.name}
          accessibilityState={{ selected: value === c.name }}
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: c.hex,
            borderWidth: value === c.name ? 3 : 1,
            borderColor: value === c.name ? t.accent : t.border,
          }}
        />
      ))}
    </View>
  );
}

export function ItemForm({ draft, onChange }: { draft: ItemDraft; onChange: (d: ItemDraft) => void }) {
  const t = useTheme();
  const set = <K extends keyof ItemDraft>(k: K, v: ItemDraft[K]) => onChange({ ...draft, [k]: v });
  return (
    <View style={{ gap: space.md }}>
      <Input label="Name" placeholder="e.g. white linen shirt" value={draft.name} onChangeText={(v) => set('name', v)} maxLength={60} />

      <Heading>Type</Heading>
      <ChipRow>
        {CATEGORIES.map((c) => (
          <Chip key={c.id} label={c.label} selected={draft.category === c.id} onPress={() => set('category', c.id)} />
        ))}
      </ChipRow>

      <Heading>Main colour: {draft.color}</Heading>
      <Swatches value={draft.color} onChange={(v) => set('color', v ?? 'black')} />

      <Heading>Second colour{draft.secondary_color ? `: ${draft.secondary_color}` : ' (optional)'}</Heading>
      <Swatches value={draft.secondary_color} onChange={(v) => set('secondary_color', v)} allowNone />

      <Heading>Pattern</Heading>
      <ChipRow>
        {PATTERNS.map((p) => (
          <Chip key={p} label={p} selected={draft.pattern === p} onPress={() => set('pattern', p)} />
        ))}
      </ChipRow>

      <Heading>How dressy is it?</Heading>
      <Scale value={draft.formality} labels={FORMALITY} onChange={(v) => set('formality', v)} />

      <Heading>How warm is it?</Heading>
      <Scale value={draft.warmth} labels={WARMTH} onChange={(v) => set('warmth', v)} />

      <Input label="Notes (optional)" value={draft.notes} onChangeText={(v) => set('notes', v)} maxLength={300} multiline />
      <Text style={{ color: t.muted, fontSize: 12 }}>Your closet is private. Only you can see it.</Text>
    </View>
  );
}
