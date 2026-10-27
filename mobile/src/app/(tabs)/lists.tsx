import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { InsightKind, KIND_LABEL, KIND_PLURAL, TRACKABLE_KINDS } from '../../brain';
import { ItemRow } from '../../components/ItemRow';
import { endOfDay, useNow } from '../../components/clock';
import { KIND_COLOR, KIND_ICON, KIND_SHORT, RADIUS, SCREEN_PADDING, SPACE, TYPE, usePalette } from '../../components/theme';
import { EmptyState, ScreenHeader, Section, Segmented } from '../../components/ui';
import { useJournal, useJournalActions } from '../../store/JournalContext';
import type { TrackedItem } from '../../store/types';

const HINTS: Record<string, string> = {
  task: 'Say something like “I need to call mom tomorrow at 6”, or type one above.',
  shopping: 'Say something like “We’re out of milk and eggs”, or type them above.',
  skill: 'Say something like “I want to get better at public speaking.”',
  goal: 'Say something like “Someday I want to run a marathon.”',
};

const PLACEHOLDER: Record<string, string> = {
  task: 'Add a task, like “pay rent on Friday”',
  shopping: 'Add things, like “milk, eggs and bread”',
  skill: 'Add a skill you’re working on',
  goal: 'Add a goal',
};

const byDue = (a: TrackedItem, b: TrackedItem) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '');
const newest = (a: TrackedItem, b: TrackedItem) => b.createdAt.localeCompare(a.createdAt);
const lastDone = (a: TrackedItem, b: TrackedItem) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '');

function Group({ title, items, trailing }: { title: string; items: TrackedItem[]; trailing?: (i: TrackedItem) => string }) {
  if (!items.length) return null;
  return (
    <Section title={title} count={items.length}>
      {items.map((item, k) => (
        <ItemRow key={item.id} item={item} trailing={trailing?.(item)} last={k === items.length - 1} />
      ))}
    </Section>
  );
}

/** Finished items, folded away until you want them. */
function DoneGroup({ title, items, onClear }: { title: string; items: TrackedItem[]; onClear(): void }) {
  const p = usePalette();
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <Section title={title} count={items.length} action={open ? 'Hide' : 'Show'} onAction={() => setOpen((o) => !o)}>
      {open ? (
        <>
          {items.slice(0, 40).map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
          <Pressable onPress={onClear} style={({ pressed }) => [styles.clear, pressed && { opacity: 0.6 }]} accessibilityRole="button">
            <Ionicons name="trash-outline" size={16} color={p.danger} />
            <Text style={[TYPE.callout, { color: p.danger }]}>Clear {title.toLowerCase()}</Text>
          </Pressable>
        </>
      ) : (
        <Pressable onPress={() => setOpen(true)} style={styles.folded}>
          <Text style={[TYPE.callout, { color: p.secondary }]} numberOfLines={1}>
            {items
              .slice(0, 3)
              .map((i) => i.title)
              .join(', ')}
            {items.length > 3 ? ` and ${items.length - 3} more` : ''}
          </Text>
        </Pressable>
      )}
    </Section>
  );
}

/** Type straight into a list: "call mom tomorrow at 6", or "milk, eggs and bread". */
function QuickAdd({ kind }: { kind: InsightKind }) {
  const p = usePalette();
  const actions = useJournalActions();
  const [text, setText] = useState('');
  const [added, setAdded] = useState<string | null>(null);
  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(null), 2500);
    return () => clearTimeout(timer);
  }, [added]);

  const add = () => {
    const n = actions.quickAdd(kind, text);
    if (!n) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setText('');
    setAdded(n === 1 ? 'Added' : `Added ${n} things`);
  };

  return (
    <View>
      <View style={[styles.add, { backgroundColor: p.card, borderColor: p.hairline }]}>
        <Ionicons name="add" size={20} color={KIND_COLOR[kind]} />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={PLACEHOLDER[kind]}
          placeholderTextColor={p.tertiary}
          style={[TYPE.body, styles.addInput, { color: p.text }]}
          returnKeyType="done"
          submitBehavior="submit"
          onSubmitEditing={add}
          accessibilityLabel={`Add to ${KIND_PLURAL[kind]}`}
        />
        {text.trim() ? (
          <Pressable onPress={add} hitSlop={8} style={[styles.addButton, { backgroundColor: p.accent }]} accessibilityLabel="Add">
            <Ionicons name="arrow-up" size={17} color="#fff" />
          </Pressable>
        ) : null}
      </View>
      {added ? <Text style={[TYPE.caption, styles.added, { color: p.accent }]}>{added}</Text> : null}
    </View>
  );
}

/** Everything pulled out of the journal: tasks to check off, things to buy, skills being built, goals. */
export default function ListsScreen() {
  const p = usePalette();
  const { items } = useJournal();
  const actions = useJournalActions();
  const params = useLocalSearchParams<{ kind?: string }>();
  const [kind, setKind] = useState<InsightKind>('task');
  const now = useNow();

  useEffect(() => {
    if (params.kind && TRACKABLE_KINDS.includes(params.kind as InsightKind)) setKind(params.kind as InsightKind);
  }, [params.kind]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const i of items) if (!i.done) c[i.kind] = (c[i.kind] ?? 0) + 1;
    return c;
  }, [items]);
  const ofKind = useMemo(() => items.filter((i) => i.kind === kind), [items, kind]);

  let content: ReactNode;
  if (!ofKind.length) {
    content = <EmptyState icon={KIND_ICON[kind]} title={`No ${KIND_PLURAL[kind].toLowerCase()} yet`} message={HINTS[kind]} />;
  } else if (kind === 'task') {
    const end = endOfDay(now);
    const open = ofKind.filter((i) => !i.done);
    const overdue = open.filter((i) => i.dueDate && new Date(i.dueDate) < now).sort(byDue);
    const today = open.filter((i) => i.dueDate && new Date(i.dueDate) >= now && new Date(i.dueDate) <= end).sort(byDue);
    const later = open.filter((i) => i.dueDate && new Date(i.dueDate) > end).sort(byDue);
    const someday = open.filter((i) => !i.dueDate).sort(newest);
    content = (
      <>
        <Group title="Overdue" items={overdue} />
        <Group title="Today" items={today} />
        <Group title="Coming up" items={later} />
        <Group title="Any time" items={someday} />
        {!open.length ? <EmptyState icon="checkmark-done-outline" title="All done" message="Nothing left to do. Nice." /> : null}
        <DoneGroup title="Done" items={ofKind.filter((i) => i.done).sort(lastDone)} onClear={() => actions.clearDone('task')} />
      </>
    );
  } else if (kind === 'shopping') {
    const open = ofKind.filter((i) => !i.done).sort(newest);
    content = (
      <>
        <Group title="To buy" items={open} />
        {!open.length ? <EmptyState icon="bag-check-outline" title="Nothing to buy" message="Everything on the list is bought." /> : null}
        <DoneGroup title="Bought" items={ofKind.filter((i) => i.done).sort(lastDone)} onClear={() => actions.clearDone('shopping')} />
      </>
    );
  } else if (kind === 'skill') {
    // One row per skill, with how often it has come up.
    const groups = new Map<string, TrackedItem[]>();
    for (const item of [...ofKind].sort(newest)) {
      const key = item.title.toLowerCase();
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    const sorted = [...groups.values()].sort((a, b) => b.length - a.length);
    const mentions = new Map(sorted.map((g) => [g[0].id, g.length]));
    const trailing = (i: TrackedItem) => {
      const n = mentions.get(i.id) ?? 1;
      return n === 1 ? '' : `${n} mentions`;
    };
    content = (
      <>
        <Group title="Working on" items={sorted.map((g) => g[0]).filter((i) => !i.done)} trailing={trailing} />
        <Group title="Got it" items={sorted.map((g) => g[0]).filter((i) => i.done)} trailing={trailing} />
      </>
    );
  } else {
    content = (
      <>
        <Group title="Working towards" items={ofKind.filter((i) => !i.done).sort(newest)} />
        <Group title="Reached" items={ofKind.filter((i) => i.done).sort(lastDone)} />
      </>
    );
  }

  const openCount = counts[kind] ?? 0;
  const subtitle =
    kind === 'task'
      ? openCount
        ? `${openCount} to do`
        : 'Nothing to do'
      : kind === 'shopping'
        ? openCount
          ? `${openCount} to buy`
          : 'Nothing to buy'
        : openCount === 1
          ? `1 ${KIND_LABEL[kind].toLowerCase()}`
          : `${openCount} ${KIND_PLURAL[kind].toLowerCase()}`;

  return (
    <View style={[styles.screen, { backgroundColor: p.background }]}>
      <ScreenHeader title="Lists" subtitle={subtitle} />
      <Segmented
        options={TRACKABLE_KINDS.map((k) => ({ value: k, label: KIND_SHORT[k], badge: counts[k] || undefined }))}
        value={kind}
        onChange={setKind}
      />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        <QuickAdd kind={kind} />
        {content}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingTop: SPACE.l, paddingBottom: SPACE.xxxl },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.s,
    marginHorizontal: SCREEN_PADDING,
    borderRadius: RADIUS.m,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: SPACE.m,
    paddingRight: 6,
    minHeight: 48,
  },
  addInput: { flex: 1, paddingVertical: 12 },
  addButton: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  added: { marginHorizontal: SCREEN_PADDING + 4, marginTop: 6 },
  folded: { paddingVertical: SPACE.m },
  clear: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14 },
});
