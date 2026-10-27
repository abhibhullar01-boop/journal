import { Platform, useWindowDimensions } from 'react-native';

/** From this width the website shows a sidebar and a centred column. Phones never do. */
export const WIDE_MIN = 900;
/** The reading column on a wide screen. */
export const COLUMN_WIDTH = 760;

export function useWide(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= WIDE_MIN;
}

/** A mouse and a real keyboard: Enter sends, menus open on hover. */
export function hasFinePointer(): boolean {
  if (Platform.OS !== 'web') return false;
  try {
    return globalThis.matchMedia?.('(hover: hover) and (pointer: fine)').matches ?? false;
  } catch {
    return false;
  }
}
