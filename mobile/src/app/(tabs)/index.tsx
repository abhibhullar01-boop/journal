import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeys } from '../../ai/keys';
import { linksIn } from '../../ai/markdown';
import { journalVocabulary } from '../../ai/vocabulary';
import { Composer, ComposerHandle } from '../../components/chat/Composer';
import { LinkCards } from '../../components/chat/LinkCards';
import { RichText } from '../../components/chat/RichText';
import { AddedChips, SavedCard } from '../../components/chat/SavedCard';
import { TypingDots } from '../../components/chat/TypingDots';
import { endOfDay, greeting, useNow, useToday } from '../../components/clock';
import { SheetOption, showSheet } from '../../components/itemActions';
import { IconName, KIND_COLOR, LIFT, RADIUS, SCREEN_PADDING, SERIF, SPACE, tint, TYPE, usePalette } from '../../components/theme';
import { Button, IconButton } from '../../components/ui';
import { clockLabel, dayLabel } from '../../store/format';
import { useDraft, useJournal, useJournalActions, useJournalStatus } from '../../store/JournalContext';
import type { ThreadMessage, TrackedItem } from '../../store/types';

type Row =
  | { type: 'day'; key: string; label: string }
  | { type: 'time'; key: string; label: string }
  | { type: 'message'; key: string; message: ThreadMessage; gap: number }
  | { type: 'draft'; key: string; gap: number }
  | { type: 'start'; key: string };

/** A time stamp goes between messages more than this far apart. */
const GAP_FOR_TIME = 45 * 60_000;
/** Space above a message: small when the same side keeps talking, larger when the other side answers. */
const SAME_SPEAKER = 6;
const NEW_SPEAKER = 22;
const NONE: TrackedItem[] = [];

function buildRows(thread: ThreadMessage[], replying: boolean, now: Date): Row[] {
  const rows: Row[] = [];
  let lastDay = '';
  let lastAt = 0;
  let lastRole: ThreadMessage['role'] | null = null;
  for (const m of thread) {
    const day = new Date(m.at).toDateString();
    const at = new Date(m.at).getTime();
    let gap = lastRole === m.role ? SAME_SPEAKER : NEW_SPEAKER;
    if (day !== lastDay) {
      rows.push({ type: 'day', key: `day-${day}`, label: `${dayLabel(m.at, now)} · ${clockLabel(m.at)}` });
      gap = 0;
    } else if (at - lastAt > GAP_FOR_TIME) {
      rows.push({ type: 'time', key: `time-${m.id}`, label: clockLabel(m.at) });
      gap = 0;
    }
    rows.push({ type: 'message', key: m.id, message: m, gap });
    lastDay = day;
    lastAt = at;
    lastRole = m.role;
  }
  if (replying) rows.push({ type: 'draft', key: 'draft', gap: lastRole === 'assistant' ? SAME_SPEAKER : NEW_SPEAKER });
  else if (lastDay !== now.toDateString()) rows.push({ type: 'start', key: 'start' });
  return rows;
}

/** Reuses last time's arrays where nothing changed, so only the messages whose items changed redraw. */
function reuse(previous: Map<string, TrackedItem[]>, next: Map<string, TrackedItem[]>): Map<string, TrackedItem[]> {
  for (const [key, list] of next) {
    const old = previous.get(key);
    if (old && old.length === list.length && old.every((item, k) => item === list[k])) next.set(key, old);
  }
  return next;
}

/** Things to say that fit the time of day. The first time, things that show what the app does. */
function suggestions(now: Date, first: boolean): string[] {
  if (first) return ['What can you do?', 'Remind me to call mom tomorrow at 6', "We're out of milk, eggs and bread"];
  const h = now.getHours();
  if (h >= 5 && h < 12) return ['Plan my day', "What's due today?", 'What do I need to buy?'];
  if (h >= 12 && h < 17) return ["What's left for today?", 'What do I need to buy?', 'A five minute break idea'];
  if (h >= 17 && h < 23) return ['Help me wrap up the day', "What's on tomorrow?", 'How am I doing on my goals?'];
  return ['Help me wind down', "What's on tomorrow?", "I can't sleep"];
}

/** The main screen: one ongoing conversation that is also your journal. */
export default function ChatScreen() {
  const p = usePalette();
  const keys = useKeys();
  const { ready, thread, items, entries, facts } = useJournal();
  const actions = useJournalActions();
  const { replying, refining } = useJournalStatus();
  const params = useLocalSearchParams<{ ask?: string; record?: string }>();
  const composer = useRef<ComposerHandle>(null);
  const list = useRef<FlatList<Row>>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [away, setAway] = useState(false);
  const today = useToday();

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  const toLatest = useCallback(() => list.current?.scrollToOffset({ offset: 0, animated: true }), []);

  const send = useCallback(
    (text: string, source: 'voice' | 'text') => {
      actions.send(text, source);
      toLatest();
    },
    [actions, toLatest],
  );

  // Other tabs can open the chat with a question (?ask=) or straight into recording (?record=1).
  useEffect(() => {
    if (!ready) return;
    if (params.ask) {
      send(params.ask, 'text');
      router.setParams({ ask: undefined });
    }
    if (params.record) {
      router.setParams({ record: undefined });
      setTimeout(() => composer.current?.startRecording(), 300);
    }
  }, [params.ask, params.record, ready, send]);

  // What was saved from each of your messages, and what the companion added in each reply.
  const savedRef = useRef(new Map<string, TrackedItem[]>());
  const savedBy = useMemo(() => {
    const next = new Map<string, TrackedItem[]>();
    for (const i of items) {
      const group = next.get(i.entryId);
      if (group) group.push(i);
      else next.set(i.entryId, [i]);
    }
    savedRef.current = reuse(savedRef.current, next);
    return savedRef.current;
  }, [items]);
  const addedRef = useRef(new Map<string, TrackedItem[]>());
  const addedBy = useMemo(() => {
    const byId = new Map(items.map((i) => [i.id, i]));
    const next = new Map<string, TrackedItem[]>();
    for (const m of thread) {
      if (!m.addedItemIds?.length) continue;
      const found = m.addedItemIds.map((id) => byId.get(id)).filter((i): i is TrackedItem => !!i);
      if (found.length) next.set(m.id, found);
    }
    addedRef.current = reuse(addedRef.current, next);
    return addedRef.current;
  }, [items, thread]);

  const rows = useMemo(() => (ready ? buildRows(thread, replying, new Date()).reverse() : []), [thread, replying, ready, today]);
  const talkedToday = useMemo(() => {
    for (let k = thread.length - 1; k >= 0; k--) if (thread[k].role === 'user') return new Date(thread[k].at).toDateString() === today;
    return false;
  }, [thread, today]);

  const vocabulary = useCallback(() => journalVocabulary(entries.slice(0, 40).map((e) => e.text), facts), [entries, facts]);

  const openMenu = useCallback(
    (m: ThreadMessage) => {
      const options: SheetOption[] = [];
      if (m.role === 'user') {
        options.push({ text: 'Edit', onPress: () => setEditing({ id: m.id, text: m.text }) });
        if (m.entryId) options.push({ text: 'Sort it again', onPress: () => actions.reanalyze(m.entryId!) });
      }
      options.push({ text: 'Copy or share', onPress: () => Share.share({ message: m.text }).catch(() => {}) });
      options.push({
        text: m.entryId ? 'Delete, with what was saved from it' : 'Delete',
        destructive: true,
        onPress: () => actions.deleteMessage(m.id),
      });
      showSheet(m.role === 'user' ? 'Your message' : 'Reply', m.text.length > 140 ? `${m.text.slice(0, 140)}…` : m.text, options);
    },
    [actions],
  );

  const renderRow = useCallback(
    ({ item: row }: { item: Row }) => {
      switch (row.type) {
        case 'day':
          return <DayDivider label={row.label} />;
        case 'time':
          return <TimeStamp label={row.label} />;
        case 'draft':
          return <DraftRow gap={row.gap} />;
        case 'start':
          return <Briefing first={thread.length === 0} />;
        default: {
          const m = row.message;
          return (
            <MessageRow
              message={m}
              gap={row.gap}
              saved={m.entryId ? savedBy.get(m.entryId) ?? NONE : NONE}
              added={addedBy.get(m.id) ?? NONE}
              checking={!!m.entryId && refining.includes(m.entryId)}
              onMenu={openMenu}
            />
          );
        }
      }
    },
    [savedBy, addedBy, refining, openMenu, thread.length],
  );

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => setAway(e.nativeEvent.contentOffset.y > 600), []);

  return (
    <View style={[styles.screen, { backgroundColor: p.background }]}>
      <Header />
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.screen}>
          <FlatList
            ref={list}
            inverted
            data={rows}
            keyExtractor={(r) => r.key}
            renderItem={renderRow}
            contentContainerStyle={styles.list}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={100}
            initialNumToRender={12}
            maxToRenderPerBatch={8}
            windowSize={9}
            ListEmptyComponent={ready ? undefined : <ActivityIndicator color={p.tertiary} style={{ marginTop: 40 }} />}
          />
          {away ? (
            <Pressable
              onPress={toLatest}
              style={({ pressed }) => [styles.toLatest, LIFT, { backgroundColor: p.card, borderColor: p.hairline }, pressed && { backgroundColor: p.sunken }]}
              accessibilityLabel="Go to the latest message"
            >
              <Ionicons name="arrow-down" size={18} color={p.text} />
            </Pressable>
          ) : null}
        </View>
        {notice ? (
          <Pressable onPress={() => setNotice(null)} style={[styles.toast, { backgroundColor: p.dangerSoft }]} accessibilityRole="alert">
            <Ionicons name="alert-circle-outline" size={17} color={p.danger} />
            <Text style={[TYPE.footnote, { color: p.text, flex: 1 }]}>{notice}</Text>
            <Ionicons name="close" size={15} color={p.secondary} />
          </Pressable>
        ) : null}
        {ready && !talkedToday && !replying && !editing ? <Suggestions first={thread.length === 0} onPick={(q) => send(q, 'text')} /> : null}
        <Composer
          ref={composer}
          onSend={send}
          openaiKey={keys.openai}
          vocabulary={vocabulary}
          keyboardOpen={keyboardOpen}
          onError={setNotice}
          onStart={actions.warmUp}
          editing={editing}
          onSaveEdit={(id, text) => {
            actions.editMessage(id, text);
            setEditing(null);
          }}
          onCancelEdit={() => setEditing(null)}
        />
      </KeyboardAvoidingView>
    </View>
  );
}

/** "Companion", with what it's doing right now, or what's waiting for you today. */
function Header() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 6, borderBottomColor: p.hairline }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: p.text }]} accessibilityRole="header">
          Companion
        </Text>
        <HeaderStatus />
      </View>
      <IconButton icon="settings-outline" label="Settings" color={p.secondary} onPress={() => router.push('/settings')} />
    </View>
  );
}

function HeaderStatus() {
  const p = usePalette();
  const { replying } = useJournalStatus();
  const draft = useDraft();
  const { items } = useJournal();
  const now = useNow();
  if (replying) {
    return (
      <View style={styles.statusRow}>
        <View style={[styles.liveDot, { backgroundColor: p.accent }]} />
        <Text style={[TYPE.footnote, { color: p.accent }]} numberOfLines={1}>
          {draft?.status ?? (draft?.text ? 'Writing…' : 'Thinking…')}
        </Text>
      </View>
    );
  }
  const end = endOfDay(now);
  let laterToday = 0;
  let overdue = 0;
  let toBuy = 0;
  for (const i of items) {
    if (i.done) continue;
    if (i.kind === 'shopping') toBuy++;
    if ((i.kind === 'task' || i.kind === 'shopping') && i.dueDate) {
      const at = new Date(i.dueDate);
      if (at < now) overdue++;
      else if (at <= end) laterToday++;
    }
  }
  const rest = [laterToday ? `${laterToday} due today` : '', toBuy ? `${toBuy} to buy` : ''].filter(Boolean).join(' · ');
  return (
    <Pressable onPress={() => router.navigate('/today')} hitSlop={6} accessibilityHint="Opens Today">
      <Text style={[TYPE.footnote, { color: p.secondary }]} numberOfLines={1}>
        {overdue ? <Text style={{ color: p.danger }}>{`${overdue} overdue`}</Text> : null}
        {overdue && rest ? ' · ' : ''}
        {rest || (overdue ? '' : 'Here whenever you need me')}
      </Text>
    </Pressable>
  );
}

const DayDivider = memo(function DayDivider({ label }: { label: string }) {
  const p = usePalette();
  return (
    <View style={styles.dayRow}>
      <View style={[styles.dayLine, { backgroundColor: p.border }]} />
      <Text style={[TYPE.caption, { color: p.tertiary, fontWeight: '600' }]}>{label}</Text>
      <View style={[styles.dayLine, { backgroundColor: p.border }]} />
    </View>
  );
});

const TimeStamp = memo(function TimeStamp({ label }: { label: string }) {
  const p = usePalette();
  return <Text style={[TYPE.caption, styles.time, { color: p.tertiary }]}>{label}</Text>;
});

const MessageRow = memo(function MessageRow({
  message: m,
  gap,
  saved,
  added,
  checking,
  onMenu,
}: {
  message: ThreadMessage;
  gap: number;
  saved: TrackedItem[];
  added: TrackedItem[];
  checking: boolean;
  onMenu(m: ThreadMessage): void;
}) {
  const p = usePalette();
  if (m.role === 'user') {
    return (
      <View style={[styles.mineWrap, { paddingTop: gap }]}>
        <Pressable
          onLongPress={() => onMenu(m)}
          delayLongPress={300}
          style={({ pressed }) => [styles.mine, { backgroundColor: pressed ? '#E1DBCE' : p.mine }]}
          accessibilityHint="Long press for options"
        >
          <Text style={[TYPE.body, { color: p.mineText }]}>{m.text}</Text>
        </Pressable>
        {m.source === 'voice' || m.edited ? (
          <View style={styles.meta}>
            {m.source === 'voice' ? <Ionicons name="mic-outline" size={12} color={p.tertiary} accessibilityLabel="Spoken" /> : null}
            {m.edited ? <Text style={[TYPE.caption, { color: p.tertiary }]}>Edited</Text> : null}
          </View>
        ) : null}
        <SavedCard items={saved} checking={checking} />
      </View>
    );
  }
  if (m.error) return <Notice message={m} gap={gap} />;
  return <Reply message={m} gap={gap} added={added} onMenu={onMenu} />;
});

function Reply({ message: m, gap, added, onMenu }: { message: ThreadMessage; gap: number; added: TrackedItem[]; onMenu(m: ThreadMessage): void }) {
  const p = usePalette();
  const links = useMemo(() => linksIn(m.text), [m.text]);
  return (
    <View style={[styles.theirsWrap, { paddingTop: gap }]}>
      <Pressable onLongPress={() => onMenu(m)} delayLongPress={300} accessibilityHint="Long press for options">
        <RichText text={m.text} color={p.text} linkColor={p.accent} markerColor={p.tertiary} selectable={false} />
      </Pressable>
      <LinkCards links={links} />
      <AddedChips items={added} />
    </View>
  );
}

/** A reply that didn't happen: no key yet, or Claude couldn't be reached. */
function Notice({ message: m, gap }: { message: ThreadMessage; gap: number }) {
  const p = usePalette();
  const actions = useJournalActions();
  const noKey = /Claude key in Settings/.test(m.text);
  return (
    <View style={[styles.theirsWrap, { paddingTop: gap }]}>
      <View style={[styles.notice, { backgroundColor: noKey ? p.sunken : p.dangerSoft }]}>
        <View style={styles.noticeHead}>
          <Ionicons name={noKey ? 'phone-portrait-outline' : 'cloud-offline-outline'} size={15} color={noKey ? p.secondary : p.danger} />
          <Text style={[TYPE.footnote, { color: noKey ? p.secondary : p.danger, fontWeight: '600' }]}>
            {noKey ? 'Saved on your phone' : "Couldn't reply"}
          </Text>
        </View>
        <Text style={[TYPE.callout, { color: p.text }]}>{m.text}</Text>
        <Button
          compact
          variant="secondary"
          icon={noKey ? 'key-outline' : 'refresh'}
          title={noKey ? 'Add a key' : 'Try again'}
          onPress={() => (noKey ? router.push('/settings') : actions.retry())}
          style={styles.noticeButton}
        />
      </View>
    </View>
  );
}

/** The reply as it's written, word by word, and what the companion is doing meanwhile. */
function DraftRow({ gap }: { gap: number }) {
  const p = usePalette();
  const draft = useDraft();
  return (
    <View style={[styles.theirsWrap, { paddingTop: gap }]}>
      {draft?.text ? <RichText text={draft.text} color={p.text} linkColor={p.accent} markerColor={p.tertiary} selectable={false} /> : <TypingDots color={p.tertiary} />}
      {draft?.status ? (
        <View style={styles.working}>
          <ActivityIndicator size="small" color={p.tertiary} style={styles.workingSpinner} />
          <Text style={[TYPE.footnote, { color: p.secondary, flex: 1 }]} numberOfLines={2}>
            {draft.status}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const HOW_IT_WORKS: { icon: IconName; text: string }[] = [
  { icon: 'mic-outline', text: 'Talk or type, any time. Each message is saved as a journal entry.' },
  { icon: 'albums-outline', text: 'To-dos, shopping, skills and goals go into Lists by themselves.' },
  { icon: 'notifications-outline', text: 'Say a time, like “tomorrow at 6”, and you’ll get a reminder.' },
];

/** The top of a new day: the date, a greeting, and what's waiting. */
function Briefing({ first }: { first: boolean }) {
  const p = usePalette();
  const { items } = useJournal();
  const now = useNow();
  const end = endOfDay(now);
  const open = items.filter((i) => !i.done);
  const due = open.filter((i) => (i.kind === 'task' || i.kind === 'shopping') && i.dueDate && new Date(i.dueDate) <= end);
  const overdue = due.filter((i) => new Date(i.dueDate!) < now).length;
  const stats = [
    { label: 'Due today', value: due.length, color: overdue ? p.danger : p.text, go: () => router.navigate('/today') },
    { label: 'To buy', value: open.filter((i) => i.kind === 'shopping').length, color: p.text, go: () => router.navigate({ pathname: '/lists', params: { kind: 'shopping' } }) },
    { label: 'Open tasks', value: open.filter((i) => i.kind === 'task').length, color: p.text, go: () => router.navigate({ pathname: '/lists', params: { kind: 'task' } }) },
    {
      label: 'Goals & skills',
      value: open.filter((i) => i.kind === 'goal' || i.kind === 'skill').length,
      color: p.text,
      go: () => router.navigate({ pathname: '/lists', params: { kind: 'goal' } }),
    },
  ];
  const line = first
    ? "I'm your journal and companion. Tell me what's on your mind, and I'll keep track of it for you."
    : due.length
      ? `${due.length === 1 ? 'One thing is' : `${due.length} things are`} due today${overdue ? `, ${overdue} overdue` : ''}. What's on your mind?`
      : "Nothing is due today. What's on your mind?";

  return (
    <View style={styles.briefing}>
      <Text style={[TYPE.label, { color: p.tertiary }]}>{now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
      <Text style={[styles.hello, { color: p.text }]}>{first ? 'Hello.' : greeting(now)}</Text>
      <Text style={[TYPE.body, { color: p.secondary }]}>{line}</Text>
      {first ? (
        <View style={[styles.howCard, { backgroundColor: p.card, borderColor: p.hairline }]}>
          {HOW_IT_WORKS.map((h, k) => (
            <View key={h.icon} style={[styles.howRow, k < HOW_IT_WORKS.length - 1 && { borderBottomColor: p.hairline, borderBottomWidth: StyleSheet.hairlineWidth }]}>
              <Ionicons name={h.icon} size={18} color={p.accent} />
              <Text style={[TYPE.subhead, { color: p.text, flex: 1 }]}>{h.text}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={[styles.stats, { backgroundColor: p.card, borderColor: p.hairline }]}>
          {stats.map((s, k) => (
            <Pressable
              key={s.label}
              onPress={s.go}
              style={({ pressed }) => [styles.stat, k > 0 && { borderLeftColor: p.hairline, borderLeftWidth: StyleSheet.hairlineWidth }, pressed && { backgroundColor: p.sunken }]}
              accessibilityLabel={`${s.value} ${s.label}`}
            >
              <Text style={[styles.statValue, { color: s.value ? s.color : p.tertiary }]}>{s.value}</Text>
              <Text style={[TYPE.caption, { color: p.secondary, textAlign: 'center' }]} numberOfLines={2}>
                {s.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function Suggestions({ first, onPick }: { first: boolean; onPick(q: string): void }) {
  const p = usePalette();
  const now = useNow(5 * 60_000);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={styles.suggestionBar}
      contentContainerStyle={styles.suggestions}
    >
      {suggestions(now, first).map((q) => (
        <Pressable
          key={q}
          onPress={() => onPick(q)}
          style={({ pressed }) => [styles.suggestion, { backgroundColor: pressed ? p.sunken : p.card, borderColor: p.border }]}
        >
          <Text style={[TYPE.subhead, { color: p.text }]}>{q}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SCREEN_PADDING, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontFamily: SERIF, fontSize: 24, lineHeight: 30, fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 3.5 },
  list: { paddingHorizontal: SCREEN_PADDING, paddingTop: SPACE.m, paddingBottom: SPACE.l },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: SPACE.xxl, marginBottom: SPACE.m },
  dayLine: { flex: 1, height: StyleSheet.hairlineWidth },
  time: { textAlign: 'center', marginTop: SPACE.xl, marginBottom: SPACE.s },
  mineWrap: { alignItems: 'flex-end', paddingLeft: 40 },
  mine: { borderRadius: RADIUS.xl, borderBottomRightRadius: 6, paddingHorizontal: 14, paddingVertical: 9, maxWidth: '100%' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, marginRight: 4 },
  theirsWrap: { paddingRight: 8 },
  notice: { borderRadius: RADIUS.l, padding: SPACE.m + 2, gap: 6 },
  noticeHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noticeButton: { alignSelf: 'flex-start', marginTop: 4 },
  working: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACE.s },
  workingSpinner: { transform: [{ scale: 0.75 }] },
  toLatest: {
    position: 'absolute',
    right: 16,
    bottom: 12,
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginBottom: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: RADIUS.m },
  briefing: { paddingTop: SPACE.xxl, paddingBottom: SPACE.s, gap: 6 },
  hello: { fontFamily: SERIF, fontSize: 30, lineHeight: 36, fontWeight: '700', marginBottom: 2 },
  stats: { flexDirection: 'row', borderRadius: RADIUS.l, borderWidth: StyleSheet.hairlineWidth, marginTop: SPACE.m, overflow: 'hidden' },
  stat: { flex: 1, alignItems: 'center', paddingVertical: SPACE.m, paddingHorizontal: 4, gap: 2 },
  statValue: { fontFamily: SERIF, fontSize: 24, lineHeight: 30, fontWeight: '700' },
  howCard: { borderRadius: RADIUS.l, borderWidth: StyleSheet.hairlineWidth, marginTop: SPACE.m, paddingHorizontal: SPACE.l },
  howRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.m, paddingVertical: SPACE.m },
  // A horizontal scroll view grows to fill the column unless told not to.
  suggestionBar: { flexGrow: 0, flexShrink: 0 },
  suggestions: { gap: 8, paddingHorizontal: 12, paddingBottom: 8, alignItems: 'center' },
  suggestion: { borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.pill, paddingHorizontal: 14, paddingVertical: 8 },
});
