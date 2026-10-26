import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { memo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { KIND_LABEL } from '../../brain';
import { formatDue } from '../../store/format';
import { useJournalActions } from '../../store/JournalContext';
import type { TrackedItem } from '../../store/types';
import { showItemActions } from '../itemActions';
import { KIND_COLOR, KIND_ICON, RADIUS, SPACE, tint, TYPE, usePalette } from '../theme';

function SavedRow({ item, last }: { item: TrackedItem; last: boolean }) {
  const p = usePalette();
  const actions = useJournalActions();
  const color = KIND_COLOR[item.kind];
  const hasTime = (item.kind === 'task' || item.kind === 'shopping') && item.dueDate && !item.done;
  return (
    <Pressable
      onPress={() => showItemActions(item, actions)}
      style={({ pressed }) => [styles.row, !last && { borderBottomColor: p.hairline, borderBottomWidth: StyleSheet.hairlineWidth }, pressed && { opacity: 0.6 }]}
      accessibilityHint="Opens options for this item"
    >
      <View style={[styles.icon, { backgroundColor: tint(color, 0.1) }]}>
        <Ionicons name={KIND_ICON[item.kind]} size={14} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[TYPE.callout, { color: item.done ? p.tertiary : p.text, fontWeight: '500' }, item.done && styles.strike]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={[TYPE.caption, { color: p.secondary, marginTop: 1 }]} numberOfLines={1}>
          <Text style={{ color, fontWeight: '600' }}>{KIND_LABEL[item.kind]}</Text>
          {hasTime ? `  ·  ${formatDue(item.dueDate!)}` : ''}
        </Text>
      </View>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          actions.toggleDone(item.id);
        }}
        hitSlop={12}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.done }}
        accessibilityLabel={item.done ? 'Mark not done' : 'Mark done'}
      >
        {item.done ? <Ionicons name="checkmark-circle" size={22} color={p.accent} /> : <View style={[styles.box, { borderColor: p.border }]} />}
      </Pressable>
    </Pressable>
  );
}

/** Under each of your messages: what was saved from it, live while Claude double-checks. */
export const SavedCard = memo(function SavedCard({ items, checking }: { items: TrackedItem[]; checking: boolean }) {
  const p = usePalette();
  if (!items.length && !checking) return null;
  const reminders = items.filter((i) => i.dueDate && !i.done).length;
  return (
    <View style={[styles.card, { backgroundColor: p.card, borderColor: p.hairline }]}>
      <View style={styles.header}>
        {checking ? <ActivityIndicator size="small" color={p.tertiary} style={styles.spinner} /> : <Ionicons name="checkmark" size={13} color={p.accent} />}
        <Text style={[TYPE.caption, { color: p.secondary, fontWeight: '600' }]}>
          {checking
            ? items.length
              ? 'Saved · double-checking'
              : 'Sorting…'
            : `Saved to your lists${reminders ? ` · ${reminders === 1 ? 'reminder set' : `${reminders} reminders`}` : ''}`}
        </Text>
      </View>
      {items.map((item, i) => (
        <SavedRow key={item.id} item={item} last={i === items.length - 1} />
      ))}
    </View>
  );
});

/** Items the companion added from its reply. */
export const AddedChips = memo(function AddedChips({ items }: { items: TrackedItem[] }) {
  const actions = useJournalActions();
  if (!items.length) return null;
  return (
    <View style={styles.chips}>
      {items.map((item) => {
        const color = KIND_COLOR[item.kind];
        return (
          <Pressable
            key={item.id}
            onPress={() => showItemActions(item, actions)}
            style={({ pressed }) => [styles.chip, { backgroundColor: tint(color, 0.08), borderColor: tint(color, 0.25) }, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name={item.done ? 'checkmark-circle' : 'add-circle-outline'} size={15} color={color} />
            <Text style={[TYPE.footnote, { color, fontWeight: '600', flexShrink: 1 }]} numberOfLines={1}>
              {item.title}
              {item.dueDate && !item.done ? `  ·  ${formatDue(item.dueDate)}` : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    alignSelf: 'flex-end',
    width: '86%',
    borderRadius: RADIUS.l,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SPACE.m,
    paddingTop: SPACE.s,
    paddingBottom: 2,
    marginTop: SPACE.s,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 2 },
  spinner: { transform: [{ scale: 0.7 }], width: 13, height: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  icon: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  strike: { textDecorationLine: 'line-through' },
  box: { width: 21, height: 21, borderRadius: 11, borderWidth: 1.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACE.s },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: RADIUS.pill, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, paddingVertical: 6, maxWidth: '100%' },
});
