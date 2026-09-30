import { useColorScheme } from 'react-native';

const light = {
  bg: '#fbf8f5',
  card: '#ffffff',
  text: '#1d1a17',
  muted: '#6b635b',
  border: '#e9e2da',
  accent: '#c2410c',
  accentText: '#ffffff',
  soft: '#f3ece5',
  danger: '#b91c1c',
  star: '#f59e0b',
  success: '#15803d',
};

const dark: typeof light = {
  bg: '#151311',
  card: '#1f1c19',
  text: '#f3eee8',
  muted: '#b3a99f',
  border: '#35302b',
  accent: '#fb923c',
  accentText: '#1d1a17',
  soft: '#2a2622',
  danger: '#f87171',
  star: '#fbbf24',
  success: '#4ade80',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export const radius = { sm: 8, md: 12, lg: 18, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
