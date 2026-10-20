import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { KIND_LABEL } from '../../brain';
import { formatDue } from '../../store/format';
import { useJournal } from '../../store/JournalContext';
import type { TrackedItem } from '../../store/types';
import { showItemActions } from '../itemActions';
import { KIND_COLOR, KIND_ICON, usePalette } from '../theme';

function SavedRow({ item }: { item: TrackedItem }) {
  const p = usePalette();
  const journal = useJournal();
  const color = KIND_COLOR[item.kind];
  const hasTime = (item.kind === 'task' || item.kind === 'shopping') && item.dueDate;
  return (
    <Pressable
      onPress={() => showItemActions(item, journal)}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
      accessibilityHint="Opens options for this item"
    >
      <View style={[styles.icon, { backgroundColor: `${color}1F` }]}>
        <Ionicons name={KIND_ICON[item.kind]} size={15} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: item.done ? p.secondary : p.text }, item.done && styles.strike]} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.meta}>
          <Text style={[styles.kind, { color }]}>{KIND_LABEL[item.kind]}</Text>
          {hasTime ? (
            <>
              <Ionicons name="notifications" size={11} color={p.secondary} />
              <Text style={[styles.due, { color: p.secondary }]}>{formatDue(item.dueDate!)}</Text>
            </>
          ) : null}
        </View>
      </View>
      <Pressable onPress={() => journal.toggleDone(item.id)} hitSlop={10} accessibilityLabel={item.done ? 'Mark not done' : 'Mark done'}>
        <Ionicons name={item.done ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={item.done ? p.accent : p.border} />
      </Pressable>
    </Pressable>
  );
}

/** Under each of your messages: what was saved from it, live while Claude double-checks. */
export function SavedCard({ items, checking }: { items: TrackedItem[]; checking: boolean }) {
  const p = usePalette();
  if (!items.length && !checking) return null;
  return (
    <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]}>
      <View style={styles.header}>
        {checking ? <ActivityIndicator size="small" color={p.accent} /> : <Ionicons name="checkmark-done" size={15} color={p.accent} />}
        <Text style={[styles.headerText, { color: p.secondary }]}>
          {checking ? (items.length ? 'Saved · double-checking' : 'Sorting…') : 'Saved to your lists'}
        </Text>
      </View>
      {items.map((item) => (
        <SavedRow key={item.id} item={item} />
      ))}
    </View>
  );
}

/** Items the companion added from its reply. */
export function AddedChips({ items }: { items: TrackedItem[] }) {
  const journal = useJournal();
  if (!items.length) return null;
  return (
    <View style={styles.chips}>
      {items.map((item) => {
        const color = KIND_COLOR[item.kind];
        return (
          <Pressable key={item.id} onPress={() => showItemActions(item, journal)} style={[styles.chip, { backgroundColor: `${color}16`, borderColor: `${color}40` }]}>
            <Ionicons name={item.done ? 'checkmark-circle' : 'add-circle'} size={15} color={color} />
            <Text style={[styles.chipText, { color }]} numberOfLines={1}>
              {item.title}
              {item.dueDate ? `  ·  ${formatDue(item.dueDate)}` : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: 'flex-end', width: '88%', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 8, marginTop: 6 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 4 },
  headerText: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  icon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '500' },
  strike: { textDecorationLine: 'line-through' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  kind: { fontSize: 12, fontWeight: '700', marginRight: 4 },
  due: { fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, maxWidth: '100%' },
  chipText: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
});
