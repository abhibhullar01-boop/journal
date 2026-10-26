import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ALL_KINDS, evaluate, KIND_LABEL, KIND_PLURAL, SEED_EVALUATION, SEED_SIZE } from '../brain';
import { KIND_COLOR, RADIUS, SERIF, SPACE, TYPE, usePalette } from '../components/theme';
import { Footnote, ProgressBar, Section } from '../components/ui';
import { formatDue } from '../store/format';
import { useJournal } from '../store/JournalContext';

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** How the on-phone model is doing, with a box to try sentences on it. */
export default function BrainScreen() {
  const p = usePalette();
  const { analyzer, modelVersion, resetModel } = useJournal();
  const [sample, setSample] = useState('I need to call the dentist tomorrow at 4 pm');

  const report = useMemo(() => evaluate(analyzer, SEED_EVALUATION), [analyzer, modelVersion]);
  const text = sample.trim();
  const result = useMemo(() => (text ? analyzer.classify(text) : null), [analyzer, text, modelVersion]);
  const found = useMemo(() => (text ? analyzer.analyze(text) : []), [analyzer, text, modelVersion]);

  const confirmReset = () =>
    Alert.alert('Forget what it learned from you?', 'The model goes back to how it came.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: resetModel },
    ]);

  return (
    <ScrollView
      style={{ backgroundColor: p.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
    >
      <Section title="Try it">
        <TextInput
          value={sample}
          onChangeText={setSample}
          multiline
          placeholder="Type something you might say"
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          placeholderTextColor={p.tertiary}
          style={[TYPE.body, styles.input, { color: p.text, backgroundColor: p.sunken }]}
        />
        {result ? (
          <View style={styles.bars}>
            {ALL_KINDS.map((kind) => (
              <View key={kind} style={styles.barRow}>
                <Text style={[TYPE.subhead, styles.barLabel, { color: kind === result.kind ? KIND_COLOR[kind] : p.secondary, fontWeight: kind === result.kind ? '700' : '500' }]}>
                  {KIND_LABEL[kind]}
                </Text>
                <View style={{ flex: 1 }}>
                  <ProgressBar value={result.scores[kind]} color={KIND_COLOR[kind]} height={7} />
                </View>
                <Text style={[TYPE.caption, styles.barValue, { color: p.secondary }]}>{pct(result.scores[kind])}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {found.length ? (
          <View style={[styles.found, { borderTopColor: p.hairline }]}>
            <Text style={[TYPE.label, { color: p.tertiary }]}>It would save</Text>
            {found.map((f, k) => (
              <Text key={k} style={[TYPE.callout, { color: p.text }]}>
                <Text style={{ color: KIND_COLOR[f.kind], fontWeight: '600' }}>{KIND_LABEL[f.kind]}</Text>
                {`  ${f.title}`}
                {f.dueDate ? <Text style={{ color: p.secondary }}>{`  ·  ${formatDue(f.dueDate)}`}</Text> : null}
              </Text>
            ))}
          </View>
        ) : text ? (
          <Text style={[TYPE.footnote, styles.nothing, { color: p.secondary }]}>Nothing to save here: it reads as a note.</Text>
        ) : null}
      </Section>

      <Section title="On sentences it never saw">
        <View style={styles.scoreRow}>
          <Text style={[styles.score, { color: p.text }]}>{pct(report.accuracy)}</Text>
          <Text style={[TYPE.footnote, { color: p.secondary, flex: 1 }]}>sorted into the right list, out of {SEED_EVALUATION.length} test sentences</Text>
        </View>
        {ALL_KINDS.map((kind) => (
          <View key={kind} style={[styles.kindRow, styles.ruled, { borderTopColor: p.hairline }]}>
            <View style={[styles.dot, { backgroundColor: KIND_COLOR[kind] }]} />
            <Text style={[TYPE.callout, { color: p.text, flex: 1 }]}>{KIND_PLURAL[kind]}</Text>
            <Text style={[TYPE.callout, { color: p.secondary }]}>
              {report.perKind[kind].correct} of {report.perKind[kind].total}
            </Text>
          </View>
        ))}
      </Section>

      <Section title="Learned from you">
        <View style={styles.kindRow}>
          <Text style={[TYPE.callout, { color: p.text, flex: 1 }]}>Your fixes and Claude's double-checks</Text>
          <Text style={[TYPE.callout, { color: p.secondary }]}>{analyzer.personalExamples}</Text>
        </View>
        <View style={[styles.kindRow, { borderTopColor: p.hairline, borderTopWidth: StyleSheet.hairlineWidth }]}>
          <Text style={[TYPE.callout, { color: p.text, flex: 1 }]}>Words and phrases it knows</Text>
          <Text style={[TYPE.callout, { color: p.secondary }]}>{analyzer.model.vocabularySize.toLocaleString()}</Text>
        </View>
        <Pressable
          onPress={confirmReset}
          disabled={analyzer.personalExamples === 0}
          style={({ pressed }) => [styles.kindRow, { borderTopColor: p.hairline, borderTopWidth: StyleSheet.hairlineWidth }, pressed && { opacity: 0.6 }]}
        >
          <Text style={[TYPE.callout, { color: analyzer.personalExamples === 0 ? p.tertiary : p.danger }]}>Reset to the built-in model</Text>
        </Pressable>
      </Section>
      <Footnote>
        It started from {SEED_SIZE.toLocaleString()} example sentences of everyday life. Each time you fix a category, or Claude
        double-checks a message, it learns from your own words. Your fixes count three times as much. It all stays on your phone.
      </Footnote>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: SPACE.xxxl },
  input: { borderRadius: RADIUS.s + 2, padding: 12, marginTop: SPACE.s, minHeight: 48 },
  bars: { gap: 8, marginTop: SPACE.m, marginBottom: SPACE.s },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s },
  barLabel: { width: 76 },
  barValue: { width: 36, textAlign: 'right' },
  found: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: SPACE.m, paddingBottom: SPACE.s, gap: 4, marginTop: SPACE.s },
  nothing: { paddingVertical: SPACE.s },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.m, paddingVertical: SPACE.m },
  score: { fontFamily: SERIF, fontSize: 36, lineHeight: 42, fontWeight: '700' },
  kindRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s + 2, paddingVertical: 12 },
  ruled: { borderTopWidth: StyleSheet.hairlineWidth },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
