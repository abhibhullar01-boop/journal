import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { pickCategory, showItemActions } from './itemActions';
import { formatDue } from '../store/format';
import { useJournal } from '../store/JournalContext';
import type { TrackedItem } from '../store/types';
import { KIND_COLOR, KIND_ICON, usePalette } from './theme';
import { KindBadge } from './ui';

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
  const { toggleDone } = useJournal();
  const color = KIND_COLOR[item.kind];
  const overdue = !!item.dueDate && !item.done && new Date(item.dueDate).getTime() < Date.now();

  const journal = useJournal();
  const openCategory = () => pickCategory(item, journal);

  return (
    <Pressable onPress={() => showItemActions(item, journal)} onLongPress={openCategory} style={styles.row}>
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
        {(item.kind === 'task' || item.kind === 'shopping') && item.dueDate ? (
          <View style={styles.dueRow}>
            <Ionicons name="notifications-outline" size={12} color={overdue ? p.danger : p.secondary} />
            <Text style={[styles.due, { color: overdue ? p.danger : p.secondary }]}>{formatDue(item.dueDate)}</Text>
          </View>
        ) : null}
      </View>
      {trailing ? <Text style={[styles.trailing, { color: p.secondary }]}>{trailing}</Text> : null}
      {showCategory ? <KindBadge kind={item.kind} onPress={openCategory} /> : null}
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
