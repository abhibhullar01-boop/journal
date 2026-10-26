import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { Platform, TextStyle } from 'react-native';
import type { InsightKind } from '../brain';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** One calm colour per list. Muted, so they read as labels rather than decoration. */
export const KIND_COLOR: Record<InsightKind, string> = {
  task: '#3B6290',
  shopping: '#A0476A',
  skill: '#98631C',
  goal: '#6A519E',
  none: '#7A766D',
};

export const KIND_ICON: Record<InsightKind, IconName> = {
  task: 'checkbox-outline',
  shopping: 'bag-handle-outline',
  skill: 'trending-up-outline',
  goal: 'flag-outline',
  none: 'document-text-outline',
};

/** Short names for chips and tabs. */
export const KIND_SHORT: Record<InsightKind, string> = {
  task: 'Tasks',
  shopping: 'To buy',
  skill: 'Skills',
  goal: 'Goals',
  none: 'Notes',
};

/**
 * Warm paper and ink, with one deep green accent. Light only, on purpose: the journal is meant
 * to feel like a notebook, so it keeps this look even when the phone is in dark mode.
 */
const palette = {
  background: '#F6F4EF',
  /** Cards, the composer and sheets. */
  card: '#FFFFFF',
  /** Recessed areas: segmented control tracks, input wells, pressed rows. */
  sunken: '#EEEBE4',
  text: '#1C1B18',
  secondary: '#6B675F',
  tertiary: '#9C978D',
  border: '#E2DDD3',
  hairline: '#EAE6DE',
  accent: '#2D5E50',
  /** A pale wash of the accent, for highlights. */
  accentSoft: '#E3ECE7',
  danger: '#B4442F',
  dangerSoft: '#F6E5E0',
  /** Your own chat messages. */
  mine: '#E9E4D9',
  mineText: '#1C1B18',
  shadow: '#2A2217',
};

export type Palette = typeof palette;

export function usePalette(): Palette {
  return palette;
}

export const PALETTE = palette;

/** A book serif for titles and the day's headline; the system font for everything else. */
export const SERIF = Platform.select({
  ios: 'Iowan Old Style',
  android: 'serif',
  default: 'Iowan Old Style, Charter, Georgia, "Times New Roman", serif',
});

export const TYPE = {
  largeTitle: { fontFamily: SERIF, fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.2 },
  title: { fontFamily: SERIF, fontSize: 23, lineHeight: 29, fontWeight: '700' },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 23 },
  callout: { fontSize: 15, lineHeight: 21 },
  subhead: { fontSize: 14, lineHeight: 19 },
  footnote: { fontSize: 13, lineHeight: 18 },
  caption: { fontSize: 12, lineHeight: 16 },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.7, textTransform: 'uppercase' },
} satisfies Record<string, TextStyle>;

/** Spacing steps. Screens use 20 at the sides. */
export const SPACE = { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 28, xxxl: 36 };
export const RADIUS = { s: 8, m: 12, l: 16, xl: 20, pill: 999 };
export const SCREEN_PADDING = 20;

/** A soft shadow for cards that float (link cards, sheets). Flat cards use a hairline instead. */
export const LIFT = {
  shadowColor: palette.shadow,
  shadowOpacity: 0.07,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
};

/** `#RRGGBB` plus an alpha from 0 to 1. */
export function tint(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}
