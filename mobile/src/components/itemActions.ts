import { router } from 'expo-router';
import { ActionSheetIOS, Alert, Platform } from 'react-native';
import { ALL_KINDS, dueDateIn, InsightKind, KIND_LABEL } from '../brain';
import { formatDue } from '../store/format';
import type { TrackedItem } from '../store/types';

interface Actions {
  toggleDone(id: string): void;
  recategorize(id: string, kind: InsightKind): void;
  confirm(id: string): void;
  removeItem(id: string): void;
  renameItem(id: string, title: string): void;
  setDue(id: string, due: Date | null): void;
}

export interface SheetOption {
  text: string;
  destructive?: boolean;
  onPress: () => void;
}

/** A native action sheet on iPhone; a simple alert elsewhere. */
function sheet(title: string, message: string | undefined, options: SheetOption[]) {
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

/** Asks for a line of text. iPhone shows a prompt; the web preview uses the browser's. */
export function askText(title: string, message?: string, initial = ''): Promise<string | null> {
  if (Platform.OS === 'ios') {
    return new Promise((resolve) =>
      Alert.prompt(
        title,
        message,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
          { text: 'Save', onPress: (value?: string) => resolve(value ?? '') },
        ],
        'plain-text',
        initial,
      ),
    );
  }
  const ask = (globalThis as { prompt?: (message: string, value: string) => string | null }).prompt;
  return Promise.resolve(ask ? ask(message ? `${title}\n${message}` : title, initial) : null);
}

/** "Remind me when?" in plain words: "tomorrow 6 pm", "Friday morning", "in 2 hours". */
export async function askReminder(item: TrackedItem, actions: Actions) {
  const answer = await askText(
    item.dueDate ? 'Change the reminder' : 'Remind me when?',
    'For example: tomorrow 6 pm, Friday morning, in 2 hours',
  );
  if (!answer?.trim()) return;
  const due = dueDateIn(answer);
  if (!due) {
    Alert.alert("I couldn't read a time from that", 'Try something like “tomorrow 9 am” or “in 30 minutes”.');
    return;
  }
  actions.setDue(item.id, due);
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
  const timed = item.kind === 'task' || item.kind === 'shopping';
  const options: SheetOption[] = [
    { text: item.done ? 'Mark not done' : item.kind === 'shopping' ? 'Mark bought' : 'Mark done', onPress: () => actions.toggleDone(item.id) },
  ];
  if (!item.done && (item.kind === 'skill' || item.kind === 'goal')) {
    options.push({
      text: 'Ask for a next step',
      onPress: () => router.navigate({ pathname: '/', params: { ask: `What's one small next step for “${item.title}”?` } }),
    });
  }
  options.push({
    text: 'Edit',
    onPress: async () => {
      const title = await askText('Edit', undefined, item.title);
      if (title?.trim()) actions.renameItem(item.id, title);
    },
  });
  if (timed && !item.done) options.push({ text: item.dueDate ? 'Change reminder' : 'Set a reminder', onPress: () => askReminder(item, actions) });
  if (timed && item.dueDate && !item.done) options.push({ text: 'Remove reminder', onPress: () => actions.setDue(item.id, null) });
  options.push({ text: 'Move to another list', onPress: () => pickCategory(item, actions) });
  options.push({ text: 'Delete', destructive: true, onPress: () => actions.removeItem(item.id) });

  const where = item.sentence !== item.title ? `From “${item.sentence}”` : KIND_LABEL[item.kind];
  sheet(item.title, item.dueDate && !item.done ? `${where}\nReminder: ${formatDue(item.dueDate)}` : where, options);
}

export { sheet as showSheet };
