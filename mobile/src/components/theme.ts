import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import type { InsightKind } from '../brain';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export const KIND_COLOR: Record<InsightKind, string> = {
  task: '#2458C6',
  shopping: '#A23B72',
  skill: '#C2620A',
  goal: '#2F7D3A',
  none: '#7C776C',
};

export const KIND_ICON: Record<InsightKind, IconName> = {
  task: 'list-outline',
  shopping: 'cart-outline',
  skill: 'barbell-outline',
  goal: 'flag-outline',
  none: 'chatbubble-outline',
};

/** Warm cream palette with a deep teal accent. The app always uses it, even in dark mode. */
const palette = {
  background: '#F7F1E5',
  card: '#FFFDF8',
  text: '#2B2A26',
  secondary: '#6F6A5F',
  border: '#E6DDCB',
  accent: '#1F6F64',
  /** A pale wash of the accent, for chips and highlights. */
  accentSoft: '#E3EFEB',
  danger: '#B93A26',
  /** Your own chat bubbles. */
  mine: '#1F6F64',
  mineText: '#FFFFFF',
  shadow: '#5A4A2A',
};

export type Palette = typeof palette;

export function usePalette(): Palette {
  return palette;
}

export const PALETTE = palette;
