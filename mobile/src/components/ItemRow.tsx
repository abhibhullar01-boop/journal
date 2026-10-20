import { Ionicons } from '@expo/vector-icons';
import { ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { ALL_KINDS, InsightKind, KIND_LABEL } from '../brain';
import { useJournal } from '../store/JournalContext';
import type { TrackedItem } from '../store/types';
import { KIND_COLOR, KIND_ICON, usePalette } from './theme';
import { KindBadge } from './ui';

function formatDue(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay(date, now)) return `Today ${time}`;
  if (sameDay(date, tomorrow)) return `Tomorrow ${time}`;
  return `${date.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })} ${time}`;
}

/** One task, skill or goal, with a check-off button and a category picker. */
export function ItemRow({
  item,
  showCheckbox = true,
  showCategory = false,
  trailing,
}: {
  item: TrackedItem;
  showCheckbox?: boolean;
  showCategory?: boolean;
  trailing?: string;
}) {
  const p = usePalette();
  const { toggleDone, recategorize, confirm } = useJournal();
  const color = KIND_COLOR[item.kind];
  const overdue = !!item.dueDate && !item.done && new Date(item.dueDate).getTime() < Date.now();

  const pickCategory = () => {
    const options = ALL_KINDS.map((k) => (k === 'none' ? 'Not trackable' : KIND_LABEL[k]) + (k === item.kind ? ' ✓' : ''));
    const choose = (kind: InsightKind) => (kind === item.kind ? confirm(item.id) : recategorize(item.id, kind));
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: 'This is a…', message: item.sentence, options: [...options, 'Cancel'], cancelButtonIndex: options.length },
        (index) => index < ALL_KINDS.length && choose(ALL_KINDS[index]),
      );
    } else {
      Alert.alert('This is a…', item.sentence, [
        ...ALL_KINDS.map((k, i) => ({ text: options[i], onPress: () => choose(k) })),
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    }
  };

  return (
    <Pressable onLongPress={pickCategory} style={styles.row}>
      {showCheckbox ? (
        <Pressable onPress={() => toggleDone(item.id)} hitSlop={10} accessibilityLabel={item.done ? 'Mark not done' : 'Mark done'}>
          <Ionicons name={item.done ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={item.done ? p.secondary : color} />
        </Pressable>
      ) : (
        <Ionicons name={KIND_ICON[item.kind]} size={24} color={color} />
      )}
      <View style={styles.text}>
        <Text
          style={[styles.title, { color: item.done ? p.secondary : p.text }, item.done && styles.strike]}
          numberOfLines={3}
        >
          {item.title}
        </Text>
        {item.kind === 'task' && item.dueDate ? (
          <View style={styles.dueRow}>
            <Ionicons name="notifications-outline" size={12} color={overdue ? p.danger : p.secondary} />
            <Text style={[styles.due, { color: overdue ? p.danger : p.secondary }]}>{formatDue(item.dueDate)}</Text>
          </View>
        ) : null}
      </View>
      {trailing ? <Text style={[styles.trailing, { color: p.secondary }]}>{trailing}</Text> : null}
      {showCategory ? <KindBadge kind={item.kind} onPress={pickCategory} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 16 },
  strike: { textDecorationLine: 'line-through' },
  dueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  due: { fontSize: 12 },
  trailing: { fontSize: 12 },
});
