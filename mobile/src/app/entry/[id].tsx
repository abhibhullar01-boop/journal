import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ItemRow } from '../../components/ItemRow';
import { SERIF, SPACE, TYPE, usePalette } from '../../components/theme';
import { Card, EmptyState, Footnote, IconButton, Section } from '../../components/ui';
import { clockLabel, dayLabel } from '../../store/format';
import { useJournal } from '../../store/JournalContext';

/** One journal entry: what you said, and what was saved from it. */
export default function EntryScreen() {
  const p = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { entries, items, reanalyze, deleteEntry } = useJournal();
  const entry = entries.find((e) => e.id === id);
  const found = items.filter((i) => i.entryId === id);

  if (!entry) {
    return (
      <View style={{ flex: 1, backgroundColor: p.background }}>
        <EmptyState icon="trash-outline" title="This entry was deleted" message="It's no longer in your journal." />
      </View>
    );
  }

  const remove = () =>
    Alert.alert('Delete this entry?', 'It goes from the chat too, with everything saved from it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteEntry(entry.id);
          router.back();
        },
      },
    ]);

  return (
    <ScrollView style={{ backgroundColor: p.background }} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: dayLabel(entry.createdAt),
          headerRight: () => (
            <View style={styles.headerButtons}>
              <IconButton icon="refresh" label="Sort it again" color={p.accent} onPress={() => reanalyze(entry.id)} />
              <IconButton icon="trash-outline" label="Delete entry" color={p.danger} onPress={remove} />
            </View>
          ),
        }}
      />
      <View style={styles.meta}>
        <Ionicons name={entry.source === 'voice' ? 'mic-outline' : 'create-outline'} size={14} color={p.tertiary} />
        <Text style={[TYPE.footnote, { color: p.secondary }]}>
          {entry.source === 'voice' ? 'Spoken' : 'Written'} at {clockLabel(entry.createdAt)}
        </Text>
      </View>
      <Card style={styles.card}>
        <Text selectable style={[styles.body, { color: p.text }]}>
          {entry.text}
        </Text>
      </Card>
      <Section title="Saved from it" count={found.length || undefined}>
        {found.length ? (
          found.map((item, k) => <ItemRow key={item.id} item={item} showCategory last={k === found.length - 1} />)
        ) : (
          <Text style={[TYPE.callout, styles.quiet, { color: p.secondary }]}>Nothing to track. It's kept as a note.</Text>
        )}
      </Section>
      <Footnote>Tap a label to move an item to another list. Each fix teaches the brain on your phone.</Footnote>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: SPACE.xxxl },
  headerButtons: { flexDirection: 'row', alignItems: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 24, marginTop: SPACE.m, marginBottom: SPACE.s },
  card: { paddingVertical: SPACE.l },
  body: { fontFamily: SERIF, fontSize: 18, lineHeight: 27 },
  quiet: { paddingVertical: SPACE.m },
});
