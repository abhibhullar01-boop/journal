import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeys } from '../../ai/keys';
import { linksIn } from '../../ai/markdown';
import { journalVocabulary } from '../../ai/vocabulary';
import { TRACKABLE_KINDS } from '../../brain';
import { Composer, ComposerHandle } from '../../components/chat/Composer';
import { LinkCards } from '../../components/chat/LinkCards';
import { RichText } from '../../components/chat/RichText';
import { AddedChips, SavedCard } from '../../components/chat/SavedCard';
import { TypingDots } from '../../components/chat/TypingDots';
import { showSheet } from '../../components/itemActions';
import { KIND_COLOR, KIND_ICON, usePalette } from '../../components/theme';
import { clockLabel, dayLabel } from '../../store/format';
import { useJournal } from '../../store/JournalContext';
import type { ThreadMessage, TrackedItem } from '../../store/types';

type Row =
  | { type: 'day'; key: string; label: string }
  | { type: 'time'; key: string; label: string }
  | { type: 'message'; key: string; message: ThreadMessage }
  | { type: 'typing'; key: string }
  | { type: 'start'; key: string };

const GAP_FOR_TIME = 45 * 60_000;

function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 5) return 'Still up?';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Things to say that fit the time of day. */
function suggestions(now: Date, hasItems: boolean): string[] {
  const h = now.getHours();
  if (h >= 5 && h < 12) return ['Help me plan my day', "What's due today?", 'What do I need to buy?'];
  if (h >= 12 && h < 17) return ["What's left for today?", 'What do I need to buy?', 'Give me a 5 minute break idea'];
  if (h >= 17 && h < 23) return ['Help me wrap up the day', "What's on tomorrow?", hasItems ? 'How am I doing on my goals?' : 'What should I cook tonight?'];
  return ['Help me wind down', "What's on tomorrow?", "I can't sleep"];
}

/** One day of the thread at a time, with a time stamp after a long gap. */
function buildRows(thread: ThreadMessage[], replying: boolean, now: Date): Row[] {
  const rows: Row[] = [];
  let lastDay = '';
  let lastAt = 0;
  for (const m of thread) {
    const day = new Date(m.at).toDateString();
    const at = new Date(m.at).getTime();
    if (day !== lastDay) rows.push({ type: 'day', key: `day-${day}`, label: `${dayLabel(m.at, now)} · ${clockLabel(m.at)}` });
    else if (at - lastAt > GAP_FOR_TIME) rows.push({ type: 'time', key: `time-${m.id}`, label: clockLabel(m.at) });
    rows.push({ type: 'message', key: m.id, message: m });
    lastDay = day;
    lastAt = at;
  }
  if (replying) rows.push({ type: 'typing', key: 'typing' });
  else if (lastDay !== now.toDateString()) rows.push({ type: 'start', key: 'start' });
  return rows;
}

/** The main screen: one ongoing conversation that is also your journal. */
export default function ChatScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const keys = useKeys();
  const journal = useJournal();
  const { thread, items, refining, replying, draft, entries, facts } = journal;
  const params = useLocalSearchParams<{ ask?: string; record?: string }>();
  const composer = useRef<ComposerHandle>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  // Keep "Today" and the greeting right if the app stays open past midnight.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

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

  // Other tabs can open the chat with a question (?ask=) or straight into recording (?record=1).
  useEffect(() => {
    if (!journal.ready) return;
    if (params.ask) {
      journal.send(params.ask, 'text');
      router.setParams({ ask: undefined });
    }
    if (params.record) {
      router.setParams({ record: undefined });
      setTimeout(() => composer.current?.startRecording(), 300);
    }
  }, [params.ask, params.record, journal.ready]);

  const byEntry = useMemo(() => {
    const map = new Map<string, TrackedItem[]>();
    for (const i of items) map.set(i.entryId, [...(map.get(i.entryId) ?? []), i]);
    return map;
  }, [items]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const rows = useMemo(() => buildRows(thread, replying, now).reverse(), [thread, replying, now]);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const dueToday = items.filter((i) => i.kind === 'task' && !i.done && i.dueDate && new Date(i.dueDate) <= endOfToday).length;
  const toBuy = items.filter((i) => i.kind === 'shopping' && !i.done).length;
  const status = replying
    ? draft?.status ?? 'typing…'
    : [dueToday ? `${dueToday} due today` : '', toBuy ? `${toBuy} to buy` : ''].filter(Boolean).join(' · ') || 'Here whenever you need me';

  const send = useCallback((text: string, source: 'voice' | 'text') => journal.send(text, source), [journal]);
  const vocabulary = useCallback(() => journalVocabulary(entries.slice(0, 40).map((e) => e.text), facts), [entries, facts]);

  const messageMenu = (m: ThreadMessage) => {
    const options = [];
    if (m.entryId) options.push({ text: 'Sort it again', onPress: () => journal.reanalyze(m.entryId!) });
    options.push({
      text: m.entryId ? 'Delete message and what was saved from it' : 'Delete message',
      destructive: true,
      onPress: () => journal.deleteMessage(m.id),
    });
    showSheet(m.role === 'user' ? 'Your message' : 'Reply', m.text.slice(0, 120), options);
  };

  const renderMessage = (m: ThreadMessage) => {
    if (m.role === 'user') {
      const found = m.entryId ? byEntry.get(m.entryId) ?? [] : [];
      return (
        <View style={styles.mineWrap}>
          <Pressable onLongPress={() => messageMenu(m)} delayLongPress={350} style={[styles.bubble, styles.mine, { backgroundColor: p.mine }]}>
            <Text style={[styles.text, { color: p.mineText }]}>{m.text}</Text>
            {m.source === 'voice' ? <Ionicons name="mic" size={12} color="#ffffffaa" style={styles.voiceIcon} /> : null}
          </Pressable>
          <SavedCard items={found} checking={!!m.entryId && refining.includes(m.entryId)} />
        </View>
      );
    }
    const added = (m.addedItemIds ?? []).map((id) => byId.get(id)).filter((i): i is TrackedItem => !!i);
    const noKey = m.error && /Claude key in Settings/.test(m.text);
    return (
      <View style={styles.theirsWrap}>
        <View style={[styles.avatar, { backgroundColor: m.error ? p.border : p.accent }]}>
          <Ionicons name={m.error ? 'alert' : 'sparkles'} size={14} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Pressable
            onLongPress={() => messageMenu(m)}
            delayLongPress={350}
            style={[styles.bubble, styles.theirs, { backgroundColor: p.card, borderColor: m.error ? `${p.danger}55` : p.border }]}
          >
            <RichText text={m.text} color={p.text} linkColor={p.accent} />
            {m.error ? (
              <Pressable onPress={() => (noKey ? router.push('/settings') : journal.retry())} style={[styles.retry, { borderColor: p.accent }]}>
                <Ionicons name={noKey ? 'key-outline' : 'refresh'} size={15} color={p.accent} />
                <Text style={{ color: p.accent, fontWeight: '600' }}>{noKey ? 'Open Settings' : 'Try again'}</Text>
              </Pressable>
            ) : null}
          </Pressable>
          {!m.error ? <LinkCards links={linksIn(m.text)} /> : null}
          <AddedChips items={added} />
        </View>
      </View>
    );
  };

  const renderRow = ({ item: row }: { item: Row }) => {
    switch (row.type) {
      case 'day':
        return (
          <View style={styles.dayRow}>
            <View style={[styles.dayLine, { backgroundColor: p.border }]} />
            <Text style={[styles.dayText, { color: p.secondary }]}>{row.label}</Text>
            <View style={[styles.dayLine, { backgroundColor: p.border }]} />
          </View>
        );
      case 'time':
        return <Text style={[styles.timeText, { color: p.secondary }]}>{row.label}</Text>;
      case 'typing':
        return (
          <View style={styles.theirsWrap}>
            <View style={[styles.avatar, { backgroundColor: p.accent }]}>
              <Ionicons name="sparkles" size={14} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              {draft?.text ? (
                <View style={[styles.bubble, styles.theirs, { backgroundColor: p.card, borderColor: p.border }]}>
                  <RichText text={draft.text} color={p.text} linkColor={p.accent} />
                </View>
              ) : (
                <View style={[styles.bubble, styles.typing, { backgroundColor: p.card, borderColor: p.border }]}>
                  <TypingDots color={p.accent} />
                </View>
              )}
              {draft?.status ? (
                <View style={styles.statusRow}>
                  <Ionicons name="search" size={13} color={p.accent} />
                  <Text style={[styles.statusText, { color: p.secondary }]}>{draft.status}</Text>
                </View>
              ) : null}
            </View>
          </View>
        );
      case 'start':
        return <DayStart now={now} first={!thread.length} onPick={(q) => journal.send(q, 'text')} />;
      default:
        return renderMessage(row.message);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: p.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 6, borderBottomColor: p.border, backgroundColor: p.background }]}>
        <View style={[styles.headerAvatar, { backgroundColor: p.accent }]}>
          <Ionicons name="sparkles" size={20} color="#fff" />
        </View>
        <Pressable style={{ flex: 1 }} onPress={() => router.navigate('/today')} accessibilityHint="Opens Today">
          <Text style={[styles.headerTitle, { color: p.text }]}>Companion</Text>
          <Text style={[styles.headerStatus, { color: replying ? p.accent : p.secondary }]} numberOfLines={1}>
            {status}
          </Text>
        </Pressable>
        <Pressable onPress={() => router.push('/settings')} hitSlop={10} style={styles.headerButton} accessibilityLabel="Settings">
          <Ionicons name="settings-outline" size={24} color={p.secondary} />
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          inverted
          data={rows}
          keyExtractor={(r) => r.key}
          renderItem={renderRow}
          contentContainerStyle={styles.list}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
        {notice ? (
          <Pressable onPress={() => setNotice(null)} style={[styles.notice, { backgroundColor: `${p.danger}14`, borderColor: `${p.danger}40` }]}>
            <Ionicons name="alert-circle-outline" size={18} color={p.danger} />
            <Text style={[styles.noticeText, { color: p.text }]}>{notice}</Text>
          </Pressable>
        ) : null}
        <Composer ref={composer} onSend={send} openaiKey={keys.openai} vocabulary={vocabulary} keyboardOpen={keyboardOpen} onError={setNotice} />
      </KeyboardAvoidingView>
    </View>
  );
}

const KIND_SHORT: Record<string, string> = { task: 'Tasks', shopping: 'To buy', skill: 'Skills', goal: 'Goals' };

/** The top of a new day: a greeting, what's waiting, and a few things to ask. */
function DayStart({ now, first, onPick }: { now: Date; first: boolean; onPick(q: string): void }) {
  const p = usePalette();
  const { items } = useJournal();
  const counts = TRACKABLE_KINDS.map((k) => ({ kind: k, n: items.filter((i) => i.kind === k && !i.done).length }));
  const night = now.getHours() >= 18 || now.getHours() < 5;
  return (
    <View style={styles.start}>
      <View style={[styles.startCard, { backgroundColor: p.card, borderColor: p.border, shadowColor: p.shadow }]}>
        <View style={styles.startArt}>
          <View style={[styles.orbBig, { backgroundColor: `${p.accent}18` }]} />
          <View style={[styles.orbSmall, { backgroundColor: `${KIND_COLOR.skill}26` }]} />
          <View style={[styles.orbTiny, { backgroundColor: `${KIND_COLOR.shopping}26` }]} />
          <View style={[styles.startIcon, { backgroundColor: night ? '#3B4A7A' : p.accent }]}>
            <Ionicons name={night ? 'moon' : 'sunny'} size={28} color="#fff" />
          </View>
        </View>
        <Text style={[styles.startTitle, { color: p.text }]}>{first ? "Hi, I'm your companion" : greeting(now)}</Text>
        <Text style={[styles.startText, { color: p.secondary }]}>
          {first
            ? 'Talk or type to me any time of day. I keep your journal, sort out what to do and buy, remind you, and help you think things through.'
            : "Tell me what's on your mind. I'll sort out anything to do or buy, and remind you."}
        </Text>
        <View style={styles.kindRow}>
          {counts.map(({ kind, n }) => (
            <Pressable
              key={kind}
              onPress={() => router.navigate({ pathname: '/lists', params: { kind } })}
              style={({ pressed }) => [styles.kindTile, { backgroundColor: `${KIND_COLOR[kind]}12` }, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name={KIND_ICON[kind]} size={18} color={KIND_COLOR[kind]} />
              {!first ? <Text style={[styles.kindCount, { color: KIND_COLOR[kind] }]}>{n}</Text> : null}
              <Text style={[styles.kindName, { color: KIND_COLOR[kind] }]}>{KIND_SHORT[kind]}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.suggestions}>
        {suggestions(now, items.length > 0).map((q) => (
          <Pressable
            key={q}
            onPress={() => onPick(q)}
            style={({ pressed }) => [styles.suggestion, { backgroundColor: p.card, borderColor: p.border }, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="sparkles-outline" size={14} color={p.accent} />
            <Text style={[styles.suggestionText, { color: p.text }]}>{q}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  headerAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  headerStatus: { fontSize: 13, marginTop: 1 },
  headerButton: { padding: 4 },
  list: { paddingHorizontal: 12, paddingVertical: 12 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12, paddingHorizontal: 8 },
  dayLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dayText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  timeText: { fontSize: 12, textAlign: 'center', marginVertical: 6 },
  mineWrap: { alignItems: 'flex-end', marginVertical: 4 },
  theirsWrap: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginVertical: 4, paddingRight: 20 },
  avatar: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  bubble: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  mine: { maxWidth: '84%', borderBottomRightRadius: 6 },
  theirs: { borderBottomLeftRadius: 6, borderWidth: StyleSheet.hairlineWidth, alignSelf: 'flex-start', maxWidth: '100%' },
  typing: { borderBottomLeftRadius: 6, borderWidth: StyleSheet.hairlineWidth, alignSelf: 'flex-start' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, marginLeft: 4 },
  statusText: { fontSize: 13 },
  text: { fontSize: 16, lineHeight: 22 },
  voiceIcon: { alignSelf: 'flex-end', marginTop: 2 },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginTop: 10 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginBottom: 6, padding: 10, borderRadius: 12, borderWidth: 1 },
  noticeText: { flex: 1, fontSize: 14, lineHeight: 19 },
  start: { marginVertical: 10, gap: 10 },
  startCard: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    alignItems: 'center',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  startArt: { width: 130, height: 88, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  orbBig: { position: 'absolute', width: 86, height: 86, borderRadius: 43, left: 6, top: 0 },
  orbSmall: { position: 'absolute', width: 44, height: 44, borderRadius: 22, right: 6, bottom: 2 },
  orbTiny: { position: 'absolute', width: 20, height: 20, borderRadius: 10, right: 22, top: 6 },
  startIcon: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  startTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  startText: { fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: 6 },
  kindRow: { flexDirection: 'row', gap: 8, marginTop: 14, alignSelf: 'stretch' },
  kindTile: { flex: 1, alignItems: 'center', borderRadius: 14, paddingVertical: 10, gap: 2 },
  kindCount: { fontSize: 17, fontWeight: '800' },
  kindName: { fontSize: 11, fontWeight: '700' },
  suggestions: { gap: 8 },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-end', borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  suggestionText: { fontSize: 15 },
});
