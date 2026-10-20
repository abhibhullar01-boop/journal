import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TRACKABLE_KINDS } from '../../brain';
import { ItemRow } from '../../components/ItemRow';
import { KIND_COLOR, usePalette } from '../../components/theme';
import { Card, KindBadge, SectionTitle } from '../../components/ui';
import { useJournal } from '../../store/JournalContext';
import type { JournalEntry } from '../../store/types';

function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 5) return 'Still up?';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const SUGGESTIONS = ['What should I focus on today?', 'What do I need to buy?', 'How am I doing on my goals?'];

/** Home: one big button to talk, what's due today, what to buy, and the journal. */
export default function TodayScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { entries, items, deleteEntry } = useJournal();
  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const dueToday = items
    .filter((i) => i.kind === 'task' && !i.done && i.dueDate && new Date(i.dueDate) <= endOfToday)
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
  const otherOpen = items.filter((i) => i.kind === 'task' && !i.done && !dueToday.includes(i));
  const toBuy = items.filter((i) => i.kind === 'shopping' && !i.done);

  const confirmDelete = (id: string) =>
    Alert.alert('Delete this entry?', 'Everything found in it is deleted too.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteEntry(id) },
    ]);

  const header = (
    <View>
      <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.hello, { color: p.text }]}>{greeting(now)}</Text>
          <Text style={[styles.date, { color: p.secondary }]}>
            {now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
        </View>
        <Pressable onPress={() => router.push('/settings')} hitSlop={12} accessibilityLabel="Settings">
          <Ionicons name="settings-outline" size={26} color={p.secondary} />
        </Pressable>
      </View>

      <View style={[styles.hero, { backgroundColor: p.card }]}>
        <Pressable
          onPress={() => router.push('/capture?mode=voice')}
          style={({ pressed }) => [styles.mic, { backgroundColor: p.accent }, pressed && { transform: [{ scale: 0.96 }] }]}
          accessibilityLabel="Talk"
        >
          <Ionicons name="mic" size={44} color="#fff" />
        </Pressable>
        <Text style={[styles.heroText, { color: p.text }]}>Tap and tell me about your day</Text>
        <Pressable onPress={() => router.push('/capture?mode=text')} hitSlop={10}>
          <Text style={[styles.typeLink, { color: p.accent }]}>or type instead</Text>
        </Pressable>
      </View>

      <SectionTitle>Today</SectionTitle>
      <Card>
        {dueToday.length ? (
          dueToday.map((item) => <ItemRow key={item.id} item={item} />)
        ) : (
          <Text style={[styles.quiet, { color: p.secondary }]}>
            {otherOpen.length ? `Nothing due today. ${otherOpen.length} other task${otherOpen.length === 1 ? '' : 's'} waiting in Lists.` : 'Nothing due today.'}
          </Text>
        )}
      </Card>

      {toBuy.length ? (
        <>
          <SectionTitle>To buy</SectionTitle>
          <Pressable onPress={() => router.navigate('/lists?kind=shopping')}>
            <Card style={styles.chips}>
              {toBuy.slice(0, 10).map((i) => (
                <View key={i.id} style={[styles.chip, { backgroundColor: `${KIND_COLOR.shopping}18` }]}>
                  <Text style={[styles.chipText, { color: KIND_COLOR.shopping }]}>{i.title}</Text>
                </View>
              ))}
              {toBuy.length > 10 ? <Text style={{ color: p.secondary, alignSelf: 'center' }}>+{toBuy.length - 10} more</Text> : null}
            </Card>
          </Pressable>
        </>
      ) : null}

      <SectionTitle>Ask your companion</SectionTitle>
      <View style={styles.asks}>
        {SUGGESTIONS.map((q) => (
          <Pressable
            key={q}
            onPress={() => router.navigate({ pathname: '/chat', params: { ask: q } })}
            style={[styles.ask, { backgroundColor: p.card, borderColor: p.border }]}
          >
            <Ionicons name="sparkles-outline" size={15} color={p.accent} />
            <Text style={[styles.askText, { color: p.text }]}>{q}</Text>
          </Pressable>
        ))}
      </View>

      {entries.length ? <SectionTitle>Your journal</SectionTitle> : null}
    </View>
  );

  const renderEntry = ({ item: entry }: { item: JournalEntry }) => {
    const entryItems = items.filter((i) => i.entryId === entry.id);
    return (
      <Pressable onPress={() => router.push(`/entry/${entry.id}`)} onLongPress={() => confirmDelete(entry.id)}>
        <Card>
          <View style={styles.entryHeader}>
            <Ionicons name={entry.source === 'voice' ? 'mic-outline' : 'create-outline'} size={14} color={p.secondary} />
            <Text style={[styles.entryDate, { color: p.text }]}>
              {new Date(entry.createdAt).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
            </Text>
          </View>
          <Text style={[styles.preview, { color: p.secondary }]} numberOfLines={2}>
            {entry.text}
          </Text>
          <View style={styles.badges}>
            {TRACKABLE_KINDS.map((kind) => {
              const count = entryItems.filter((i) => i.kind === kind).length;
              return count ? <KindBadge key={kind} kind={kind} count={count} /> : null;
            })}
          </View>
        </Card>
      </Pressable>
    );
  };

  return (
    <FlatList
      style={{ backgroundColor: p.background }}
      data={entries}
      keyExtractor={(e) => e.id}
      ListHeaderComponent={header}
      renderItem={renderEntry}
      contentContainerStyle={{ paddingBottom: 30 }}
    />
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingBottom: 8 },
  hello: { fontSize: 30, fontWeight: '800' },
  date: { fontSize: 15, marginTop: 2 },
  hero: { marginHorizontal: 16, marginTop: 8, borderRadius: 22, paddingVertical: 26, alignItems: 'center', gap: 12 },
  mic: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1F6F64',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  heroText: { fontSize: 17, fontWeight: '600' },
  typeLink: { fontSize: 15, fontWeight: '600' },
  quiet: { fontSize: 15, lineHeight: 21 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 14, fontWeight: '600' },
  asks: { marginHorizontal: 16, gap: 8 },
  ask: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  askText: { fontSize: 15 },
  entryHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  entryDate: { fontSize: 15, fontWeight: '600' },
  preview: { fontSize: 15, lineHeight: 20 },
  badges: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
});
