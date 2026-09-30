import { Ionicons } from '@expo/vector-icons';
import { Image, ImageStyle } from 'expo-image';
import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useToken } from '../lib/auth';
import { Bucket, storageSource } from '../lib/images';
import { radius, space, useTheme } from '../theme';

export function Screen({
  children,
  scroll = true,
  padded = true,
  edges = ['top'],
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: ('top' | 'bottom')[];
}) {
  const t = useTheme();
  const inner = padded ? { padding: space.lg, gap: space.md } : undefined;
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: t.bg }}>
      {scroll ? (
        <ScrollView contentContainerStyle={[inner, { paddingBottom: 48 }]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, inner]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Title({ children, style }: { children: ReactNode; style?: StyleProp<any> }) {
  const t = useTheme();
  return <Text style={[{ color: t.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }, style]}>{children}</Text>;
}

export function Heading({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={{ color: t.text, fontSize: 17, fontWeight: '700', marginTop: space.sm }}>{children}</Text>;
}

export function Body({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: StyleProp<any> }) {
  const t = useTheme();
  return <Text style={[{ color: muted ? t.muted : t.text, fontSize: 15, lineHeight: 21 }, style]}>{children}</Text>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const bg = variant === 'primary' ? t.accent : variant === 'secondary' ? t.soft : 'transparent';
  const fg =
    variant === 'primary' ? t.accentText : variant === 'danger' ? t.danger : variant === 'ghost' ? t.accent : t.text;
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: radius.md,
          paddingVertical: 13,
          paddingHorizontal: space.lg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.sm,
          opacity: off ? 0.5 : pressed ? 0.8 : 1,
          borderWidth: variant === 'danger' ? 1 : 0,
          borderColor: t.danger,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <Text style={{ color: fg, fontSize: 16, fontWeight: '700' }}>{title}</Text>
    </Pressable>
  );
}

export function Input({ label, error, style, ...props }: TextInputProps & { label?: string; error?: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={{ color: t.muted, fontSize: 13, fontWeight: '600' }}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={t.muted}
        style={[
          {
            backgroundColor: t.card,
            color: t.text,
            borderWidth: 1,
            borderColor: error ? t.danger : t.border,
            borderRadius: radius.md,
            paddingHorizontal: space.md,
            paddingVertical: 12,
            fontSize: 16,
          },
          style,
        ]}
        {...props}
      />
      {error ? <Text style={{ color: t.danger, fontSize: 13 }}>{error}</Text> : null}
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: radius.pill,
        backgroundColor: selected ? t.accent : t.soft,
      }}
    >
      <Text style={{ color: selected ? t.accentText : t.text, fontWeight: '600', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{children}</View>;
}

export function Stars({
  value,
  size = 18,
  onChange,
}: {
  value: number | null | undefined;
  size?: number;
  onChange?: (v: number) => void;
}) {
  const t = useTheme();
  const v = value ?? 0;
  return (
    <View style={{ flexDirection: 'row', gap: 2 }} accessibilityLabel={`${v} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const name = v >= n ? 'star' : v >= n - 0.5 ? 'star-half' : 'star-outline';
        const icon = <Ionicons name={name} size={size} color={t.star} />;
        return onChange ? (
          <Pressable key={n} onPress={() => onChange(n)} hitSlop={6} accessibilityLabel={`Rate ${n} stars`}>
            {icon}
          </Pressable>
        ) : (
          <View key={n}>{icon}</View>
        );
      })}
    </View>
  );
}

export function StorageImage({
  bucket,
  path,
  style,
  contentFit = 'cover',
}: {
  bucket: Bucket;
  path: string | null | undefined;
  style?: StyleProp<ImageStyle>;
  contentFit?: 'cover' | 'contain';
}) {
  const t = useTheme();
  const token = useToken();
  const source = storageSource(bucket, path, token);
  if (!source) {
    return (
      <View style={[{ backgroundColor: t.soft, alignItems: 'center', justifyContent: 'center' }, style as any]}>
        <Ionicons name="shirt-outline" size={28} color={t.muted} />
      </View>
    );
  }
  return (
    <Image
      source={source}
      style={[{ backgroundColor: t.soft }, style]}
      contentFit={contentFit}
      cachePolicy="disk"
      transition={150}
    />
  );
}

export function Avatar({ path, size = 36 }: { path: string | null | undefined; size?: number }) {
  const t = useTheme();
  if (!path) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: t.soft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="person" size={size * 0.5} color={t.muted} />
      </View>
    );
  }
  return <StorageImage bucket="avatars" path={path} style={{ width: size, height: size, borderRadius: size / 2 }} />;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View
      style={[
        { backgroundColor: t.card, borderRadius: radius.lg, borderWidth: 1, borderColor: t.border, padding: space.lg, gap: space.sm },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Empty({ icon, title, body }: { icon: keyof typeof Ionicons.glyphMap; title: string; body?: string }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: space.xl, gap: space.sm }}>
      <Ionicons name={icon} size={44} color={t.muted} />
      <Text style={{ color: t.text, fontSize: 17, fontWeight: '700', textAlign: 'center' }}>{title}</Text>
      {body ? <Text style={{ color: t.muted, textAlign: 'center', lineHeight: 20 }}>{body}</Text> : null}
    </View>
  );
}

export function Loading() {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: t.bg }}>
      <ActivityIndicator color={t.accent} />
    </View>
  );
}

export const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
