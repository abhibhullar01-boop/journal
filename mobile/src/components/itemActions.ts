import { ActionSheetIOS, Alert, Platform } from 'react-native';
import { ALL_KINDS, InsightKind, KIND_LABEL } from '../brain';
import type { TrackedItem } from '../store/types';

interface Actions {
  toggleDone(id: string): void;
  recategorize(id: string, kind: InsightKind): void;
  confirm(id: string): void;
  removeItem(id: string): void;
}

function sheet(title: string, message: string | undefined, options: { text: string; destructive?: boolean; onPress: () => void }[]) {
  if (Platform.OS === 'ios') {
    const destructive = options.findIndex((o) => o.destructive);
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        message,
        options: [...options.map((o) => o.text), 'Cancel'],
        cancelButtonIndex: options.length,
        destructiveButtonIndex: destructive >= 0 ? destructive : undefined,
      },
      (index) => index < options.length && options[index].onPress(),
    );
  } else {
    Alert.alert(title, message, [
      ...options.map((o) => ({ text: o.text, style: o.destructive ? ('destructive' as const) : undefined, onPress: o.onPress })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }
}

/** "This is a…" picker. Each choice teaches the on-phone model. */
export function pickCategory(item: TrackedItem, actions: Actions) {
  sheet(
    'This is a…',
    item.sentence,
    ALL_KINDS.map((k) => ({
      text: (k === 'none' ? 'Not something to track' : KIND_LABEL[k]) + (k === item.kind ? '  ✓' : ''),
      onPress: () => (k === item.kind ? actions.confirm(item.id) : actions.recategorize(item.id, k)),
    })),
  );
}

/** Everything you can do with a saved item. */
export function showItemActions(item: TrackedItem, actions: Actions) {
  sheet(item.title, `${KIND_LABEL[item.kind]}${item.sentence !== item.title ? ` · from “${item.sentence}”` : ''}`, [
    { text: item.done ? 'Mark not done' : item.kind === 'shopping' ? 'Mark bought' : 'Mark done', onPress: () => actions.toggleDone(item.id) },
    { text: 'Put it in a different list', onPress: () => pickCategory(item, actions) },
    { text: 'Remove', destructive: true, onPress: () => actions.removeItem(item.id) },
  ]);
}

export { sheet as showSheet };
