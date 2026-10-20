import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { TRACKABLE_KINDS } from '../../brain';
import { usePalette } from '../../components/theme';
import { BigButton, Card, EmptyState, KindBadge } from '../../components/ui';
import { useJournal } from '../../store/JournalContext';

export default function JournalScreen() {
  const p = usePalette();
  const { entries, items, deleteEntry } = useJournal();

  const confirmDelete = (id: string) =>
    Alert.alert('Delete this entry?', 'Its tasks, skills and goals are deleted too.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteEntry(id) },
    ]);

  return (
    <View style={[styles.screen, { backgroundColor: p.background }]}>
      <FlatList
        data={entries}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 110 }}
        ListEmptyComponent={
          <EmptyState
            icon="mic-outline"
            title="Say what's on your mind"
            message="Tap Speak and talk about your day. Tasks, skills and goals get pulled out automatically."
          />
        }
        renderItem={({ item: entry }) => {
          const entryItems = items.filter((i) => i.entryId === entry.id);
          return (
            <Pressable onPress={() => router.push(`/entry/${entry.id}`)} onLongPress={() => confirmDelete(entry.id)}>
              <Card>
                <View style={styles.header}>
                  <Ionicons name={entry.source === 'voice' ? 'mic-outline' : 'create-outline'} size={14} color={p.secondary} />
                  <Text style={[styles.date, { color: p.text }]}>
                    {new Date(entry.createdAt).toLocaleString([], {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'short',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
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
        }}
      />
      <View style={[styles.captureBar, { backgroundColor: p.background, borderTopColor: p.border }]}>
        <BigButton title="Speak" icon="mic" onPress={() => router.push('/capture?mode=voice')} />
        <BigButton title="Write" icon="create-outline" filled={false} onPress={() => router.push('/capture?mode=text')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  date: { fontSize: 15, fontWeight: '600' },
  preview: { fontSize: 15, lineHeight: 20 },
  badges: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  captureBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
