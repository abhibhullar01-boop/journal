import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ALL_KINDS, dueDateIn, evaluate, KIND_LABEL, KIND_PLURAL, SEED_EVALUATION, SEED_TRAINING, titleFor } from '../../brain';
import { KIND_COLOR, usePalette } from '../../components/theme';
import { Card, SectionTitle } from '../../components/ui';
import { useJournal } from '../../store/JournalContext';

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Shows how the on-device model is doing and lets you try sentences on it. */
export default function BrainScreen() {
  const p = usePalette();
  const { analyzer, modelVersion, resetModel } = useJournal();
  const [sample, setSample] = useState('I need to call the dentist tomorrow at 4 pm');

  const report = useMemo(() => evaluate(analyzer, SEED_EVALUATION), [analyzer, modelVersion]);
  const result = sample.trim() ? analyzer.classify(sample) : null;
  const due = result?.kind === 'task' ? dueDateIn(sample) : null;

  const confirmReset = () =>
    Alert.alert('Forget everything the model learned from you?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: resetModel },
    ]);

  return (
    <ScrollView style={{ backgroundColor: p.background }} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <SectionTitle>Try it</SectionTitle>
      <Card>
        <TextInput
          value={sample}
          onChangeText={setSample}
          multiline
          placeholder="Type a sentence"
          placeholderTextColor={p.secondary}
          style={[styles.input, { color: p.text, borderColor: p.border }]}
        />
        {result
          ? ALL_KINDS.map((kind) => (
              <View key={kind} style={styles.barRow}>
                <Text style={[styles.barLabel, { color: KIND_COLOR[kind], fontWeight: kind === result.kind ? '700' : '400' }]}>
                  {KIND_LABEL[kind]}
                </Text>
                <View style={[styles.barTrack, { backgroundColor: p.border }]}>
                  <View style={[styles.barFill, { width: pct(result.scores[kind]) as `${number}%`, backgroundColor: KIND_COLOR[kind] }]} />
                </View>
                <Text style={[styles.barValue, { color: p.secondary }]}>{pct(result.scores[kind])}</Text>
              </View>
            ))
          : null}
        {result && result.kind !== 'none' ? <Row label="Title" value={titleFor(sample)} /> : null}
        {due ? <Row label="Reminder" value={due.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })} /> : null}
      </Card>

      <SectionTitle>Test sentences it has never seen</SectionTitle>
      <Card>
        <Row label="Accuracy" value={pct(report.accuracy)} bold />
        {ALL_KINDS.map((kind) => (
          <Row key={kind} label={KIND_PLURAL[kind]} value={`${report.perKind[kind].correct} of ${report.perKind[kind].total}`} />
        ))}
      </Card>

      <SectionTitle>Personalisation</SectionTitle>
      <Card>
        <Row label="Your corrections" value={String(analyzer.personalExamples)} />
        <Row label="Words and phrases known" value={String(analyzer.model.vocabularySize)} />
        <Pressable onPress={confirmReset} disabled={analyzer.personalExamples === 0} style={{ paddingTop: 10 }}>
          <Text style={{ color: analyzer.personalExamples === 0 ? p.secondary : p.danger, fontSize: 16 }}>
            Reset to the built-in model
          </Text>
        </Pressable>
      </Card>
      <Text style={[styles.footnote, { color: p.secondary }]}>
        The model started from {SEED_TRAINING.length} example sentences. Every time you fix or confirm a category, it learns
        from your own words, and your fixes count three times as much as the examples. Everything stays on your phone.
      </Text>
    </ScrollView>
  );

  function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
    return (
      <View style={styles.row}>
        <Text style={{ color: p.text, fontSize: 16 }}>{label}</Text>
        <Text style={{ color: bold ? p.text : p.secondary, fontSize: 16, fontWeight: bold ? '700' : '400', flexShrink: 1, textAlign: 'right' }}>
          {value}
        </Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  input: { fontSize: 16, borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 10, minHeight: 44 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  barLabel: { width: 80, fontSize: 14 },
  barTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  barValue: { width: 40, textAlign: 'right', fontSize: 13 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 6 },
  footnote: { marginHorizontal: 20, fontSize: 13, lineHeight: 18 },
});
