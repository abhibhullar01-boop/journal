import { Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { ItemRow } from '../../components/ItemRow';
import { usePalette } from '../../components/theme';
import { Card, SectionTitle } from '../../components/ui';
import { useJournal } from '../../store/JournalContext';

export default function EntryScreen() {
  const p = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { entries, items, reanalyze } = useJournal();
  const entry = entries.find((e) => e.id === id);
  const entryItems = items.filter((i) => i.entryId === id);

  if (!entry) {
    return <Text style={{ padding: 20, color: p.secondary }}>This entry was deleted.</Text>;
  }

  return (
    <ScrollView style={{ backgroundColor: p.background }} contentContainerStyle={{ paddingBottom: 40 }}>
      <Stack.Screen
        options={{
          title: new Date(entry.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }),
          headerRight: () => (
            <Pressable onPress={() => reanalyze(entry.id)} hitSlop={10}>
              <Text style={{ color: p.accent, fontSize: 16 }}>Re-analyze</Text>
            </Pressable>
          ),
        }}
      />
      <SectionTitle>{entry.source === 'voice' ? 'Spoken' : 'Written'}</SectionTitle>
      <Card>
        <Text selectable style={[styles.body, { color: p.text }]}>
          {entry.text}
        </Text>
      </Card>
      <SectionTitle>Found in this entry</SectionTitle>
      <Card>
        {entryItems.length === 0 ? (
          <Text style={{ color: p.secondary }}>Nothing to track in this entry.</Text>
        ) : (
          entryItems.map((item) => <ItemRow key={item.id} item={item} showCategory />)
        )}
      </Card>
      <Text style={[styles.footnote, { color: p.secondary }]}>
        Tap a label to fix its category. Each fix teaches the model on your phone.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 16, lineHeight: 23 },
  footnote: { marginHorizontal: 20, fontSize: 13, lineHeight: 18 },
});
