import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { useColorScheme } from 'react-native';
import type { InsightKind } from '../brain';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export const KIND_COLOR: Record<InsightKind, string> = {
  task: '#2F7CF6',
  skill: '#F28C28',
  goal: '#2EA44F',
  none: '#8E8E93',
};

export const KIND_ICON: Record<InsightKind, IconName> = {
  task: 'list-outline',
  skill: 'barbell-outline',
  goal: 'flag-outline',
  none: 'chatbubble-outline',
};

const light = {
  background: '#F2F2F7',
  card: '#FFFFFF',
  text: '#1C1C1E',
  secondary: '#6C6C70',
  border: '#E5E5EA',
  accent: '#5B5BD6',
  danger: '#E5484D',
};

const dark: typeof light = {
  background: '#000000',
  card: '#1C1C1E',
  text: '#F2F2F7',
  secondary: '#9A9AA0',
  border: '#2C2C2E',
  accent: '#8B8BF5',
  danger: '#FF6369',
};

export type Palette = typeof light;

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}
