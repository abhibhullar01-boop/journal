import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { InsightKind, KIND_PLURAL, TRACKABLE_KINDS } from '../../brain';
import { ItemRow } from '../../components/ItemRow';
import { KIND_COLOR, KIND_ICON, usePalette } from '../../components/theme';
import { Card, EmptyState, SectionTitle } from '../../components/ui';
import { useJournal } from '../../store/JournalContext';
import type { TrackedItem } from '../../store/types';

const HINTS: Record<string, string> = {
  task: 'Try saying “I need to call mom tomorrow.”',
  shopping: 'Try saying “We’re out of milk and eggs.”',
  skill: 'Try saying “I want to get better at public speaking.”',
  goal: 'Try saying “Someday I want to run a marathon.”',
};

/** Dated tasks first (soonest first), then undated ones (newest first). */
function dueOrder(a: TrackedItem, b: TrackedItem): number {
  if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
  if (a.dueDate) return -1;
  if (b.dueDate) return 1;
  return b.createdAt.localeCompare(a.createdAt);
}

function List({ title, items, trailing }: { title: string; items: TrackedItem[]; trailing?: (i: TrackedItem) => string }) {
  if (!items.length) return null;
  return (
    <>
      <SectionTitle>{title}</SectionTitle>
      <Card>
        {items.map((item) => (
          <ItemRow key={item.id} item={item} trailing={trailing?.(item)} />
        ))}
      </Card>
    </>
  );
}

/** Everything pulled out of the journal: tasks to check off, things to buy, skills being built, goals. */
export default function ListsScreen() {
  const p = usePalette();
  const { items } = useJournal();
  const params = useLocalSearchParams<{ kind?: string }>();
  const [kind, setKind] = useState<InsightKind>('task');
  useEffect(() => {
    if (params.kind && TRACKABLE_KINDS.includes(params.kind as InsightKind)) setKind(params.kind as InsightKind);
  }, [params.kind]);
  const ofKind = items.filter((i) => i.kind === kind);

  let content;
  if (!ofKind.length) {
    content = <EmptyState icon={KIND_ICON[kind]} title={`No ${KIND_PLURAL[kind].toLowerCase()} yet`} message={HINTS[kind]} />;
  } else if (kind === 'task') {
    const open = ofKind.filter((i) => !i.done).sort(dueOrder);
    const done = ofKind
      .filter((i) => i.done)
      .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
      .slice(0, 30);
    content = (
      <>
        <List title="To do" items={open} />
        <List title="Done" items={done} />
      </>
    );
  } else if (kind === 'shopping') {
    const open = ofKind.filter((i) => !i.done).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const bought = ofKind
      .filter((i) => i.done)
      .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
      .slice(0, 20);
    content = (
      <>
        <List title="To buy" items={open} />
        <List title="Bought" items={bought} />
      </>
    );
  } else if (kind === 'skill') {
    // Skills grouped by title, with how often they come up.
    const groups = new Map<string, TrackedItem[]>();
    for (const item of [...ofKind].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
      const key = item.title.toLowerCase();
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    const sorted = [...groups.values()].sort((a, b) => b.length - a.length);
    const counts = new Map(sorted.map((g) => [g[0].id, g.length]));
    content = (
      <List
        title="Skills you're building"
        items={sorted.map((g) => g[0])}
        trailing={(i) => {
          const n = counts.get(i.id) ?? 1;
          return n === 1 ? '1 mention' : `${n} mentions`;
        }}
      />
    );
  } else {
    content = (
      <>
        <List title="Working towards" items={ofKind.filter((i) => !i.done)} />
        <List title="Reached" items={ofKind.filter((i) => i.done)} />
      </>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: p.background }} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={[styles.segments, { backgroundColor: p.card }]}>
        {TRACKABLE_KINDS.map((k) => {
          const active = k === kind;
          return (
            <Pressable
              key={k}
              onPress={() => setKind(k)}
              style={[styles.segment, active && { backgroundColor: KIND_COLOR[k] }]}
            >
              <Text style={[styles.segmentText, { color: active ? '#fff' : p.text }]}>{KIND_PLURAL[k]}</Text>
            </Pressable>
          );
        })}
      </View>
      {content}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  segments: { flexDirection: 'row', margin: 16, marginBottom: 0, borderRadius: 12, padding: 3 },
  segment: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  segmentText: { fontSize: 14, fontWeight: '600' },
});
