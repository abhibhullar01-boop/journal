import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDue } from '../store/format';
import { useJournalActions } from '../store/JournalContext';
import type { TrackedItem } from '../store/types';
import { pickCategory, showItemActions } from './itemActions';
import { KIND_COLOR, SPACE, TYPE, usePalette } from './theme';
import { KindBadge } from './ui';

/** One task, thing to buy, skill or goal: a tick box, the title, and its reminder. */
export const ItemRow = memo(function ItemRow({
  item,
  showCategory = false,
  trailing,
  last = false,
}: {
  item: TrackedItem;
  showCategory?: boolean;
  trailing?: string;
  last?: boolean;
}) {
  const p = usePalette();
  const actions = useJournalActions();
  const color = KIND_COLOR[item.kind];
  const overdue = !!item.dueDate && !item.done && new Date(item.dueDate).getTime() < Date.now();
  const timed = (item.kind === 'task' || item.kind === 'shopping') && !!item.dueDate && !item.done;

  const toggle = () => {
    Haptics.impactAsync(item.done ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    actions.toggleDone(item.id);
  };

  return (
    <Pressable
      onPress={() => showItemActions(item, actions)}
      onLongPress={() => pickCategory(item, actions)}
      style={({ pressed }) => [styles.row, !last && { borderBottomColor: p.hairline, borderBottomWidth: StyleSheet.hairlineWidth }, pressed && { opacity: 0.6 }]}
      accessibilityHint="Opens options"
    >
      <Pressable onPress={toggle} hitSlop={12} accessibilityRole="checkbox" accessibilityState={{ checked: item.done }} accessibilityLabel={item.title}>
        {item.done ? (
          <Ionicons name="checkmark-circle" size={24} color={p.tertiary} />
        ) : (
          <View style={[styles.box, { borderColor: color }]} />
        )}
      </Pressable>
      <View style={styles.text}>
        <Text style={[TYPE.body, { color: item.done ? p.tertiary : p.text }, item.done && styles.strike]} numberOfLines={3}>
          {item.title}
        </Text>
        {timed ? (
          <View style={styles.meta}>
            <Ionicons name={overdue ? 'alarm-outline' : 'notifications-outline'} size={12} color={overdue ? p.danger : p.secondary} />
            <Text style={[TYPE.caption, { color: overdue ? p.danger : p.secondary }]}>{overdue ? `Overdue · ${formatDue(item.dueDate!)}` : formatDue(item.dueDate!)}</Text>
          </View>
        ) : null}
      </View>
      {trailing ? <Text style={[TYPE.caption, { color: p.tertiary }]}>{trailing}</Text> : null}
      {showCategory ? <KindBadge kind={item.kind} onPress={() => pickCategory(item, actions)} /> : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.m, paddingVertical: 12, minHeight: 52 },
  box: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.6, margin: 1 },
  text: { flex: 1, gap: 3 },
  strike: { textDecorationLine: 'line-through' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
