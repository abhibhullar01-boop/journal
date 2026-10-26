import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Keyboard, Linking, Pressable, ScrollView, Share, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { webSearchStatus } from '../ai/claude';
import { KeyName, useKeys } from '../ai/keys';
import { KIND_LABEL } from '../brain';
import { IconName, RADIUS, SPACE, tint, TYPE, usePalette } from '../components/theme';
import { Button, Card, Footnote, Row, Section } from '../components/ui';
import { formatDue } from '../store/format';
import { useJournal } from '../store/JournalContext';
import type { JournalEntry, TrackedItem } from '../store/types';

const KEY_INFO: Record<KeyName, { title: string; icon: IconName; what: string; url: string; prefix: string }> = {
  anthropic: {
    title: 'Claude',
    icon: 'sparkles-outline',
    what: 'Powers the chat, and double-checks how each message is sorted. Usually a few cents a day.',
    url: 'https://platform.claude.com/settings/keys',
    prefix: 'sk-ant-',
  },
  openai: {
    title: 'OpenAI',
    icon: 'mic-outline',
    what: 'Writes down what you say, far more accurately than the keyboard mic. Under half a cent a minute.',
    url: 'https://platform.openai.com/api-keys',
    prefix: 'sk-',
  },
};

function KeyCard({ name }: { name: KeyName }) {
  const p = usePalette();
  const keys = useKeys();
  const saved = keys[name];
  const info = KEY_INFO[name];
  const [draft, setDraft] = useState('');

  const save = async () => {
    const value = draft.trim();
    if (!value) return;
    if (!value.startsWith(info.prefix)) {
      Alert.alert("That doesn't look like the right key", `${info.title} keys start with "${info.prefix}".`);
      return;
    }
    await keys.setKey(name, value);
    setDraft('');
    Keyboard.dismiss();
  };

  const remove = () =>
    Alert.alert(`Remove the ${info.title} key?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => keys.setKey(name, null) },
    ]);

  return (
    <Card style={styles.keyCard}>
      <View style={styles.keyHead}>
        <View style={[styles.keyIcon, { backgroundColor: p.accentSoft }]}>
          <Ionicons name={info.icon} size={17} color={p.accent} />
        </View>
        <Text style={[TYPE.headline, { color: p.text, flex: 1 }]}>{info.title}</Text>
        <View style={[styles.pill, { backgroundColor: saved ? p.accentSoft : p.sunken }]}>
          <Text style={[TYPE.caption, { color: saved ? p.accent : p.secondary, fontWeight: '600' }]}>{saved ? 'Connected' : 'Not set'}</Text>
        </View>
      </View>
      <Text style={[TYPE.footnote, { color: p.secondary }]}>{info.what}</Text>
      {saved ? (
        <View style={styles.keyRow}>
          <Text style={[TYPE.subhead, { color: p.text }]}>Key ending in …{saved.slice(-4)}</Text>
          <Pressable onPress={remove} hitSlop={10}>
            <Text style={[TYPE.subhead, { color: p.danger, fontWeight: '600' }]}>Remove</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={`Paste your key (${info.prefix}…)`}
            placeholderTextColor={p.tertiary}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={save}
            style={[TYPE.callout, styles.input, { color: p.text, backgroundColor: p.sunken }]}
          />
          <View style={styles.keyRow}>
            <Pressable onPress={() => Linking.openURL(info.url)} hitSlop={8} style={styles.link}>
              <Text style={[TYPE.subhead, { color: p.accent, fontWeight: '600' }]}>Get a key</Text>
              <Ionicons name="open-outline" size={13} color={p.accent} />
            </Pressable>
            <Button compact title="Save" onPress={save} disabled={!draft.trim()} />
          </View>
        </>
      )}
    </Card>
  );
}

/** Whether Claude's own web search works on this account. Without it the phone searches for links itself. */
function WebSearchNote() {
  const p = usePalette();
  const { working, problem } = webSearchStatus();
  if (working !== false) return null;
  return (
    <Card style={[styles.keyCard, { marginTop: SPACE.m }]}>
      <View style={styles.keyHead}>
        <Ionicons name="globe-outline" size={18} color={p.danger} />
        <Text style={[TYPE.headline, { color: p.text, flex: 1 }]}>Claude's web search is off</Text>
      </View>
      <Text style={[TYPE.footnote, { color: p.secondary }]}>
        Links still work through the phone's own search. For better results, turn on web search in your Claude account settings.
        {problem ? `\n\nWhat Claude said: ${problem}` : ''}
      </Text>
      <Pressable onPress={() => Linking.openURL('https://platform.claude.com/settings')} hitSlop={8} style={styles.link}>
        <Text style={[TYPE.subhead, { color: p.accent, fontWeight: '600' }]}>Open Claude settings</Text>
        <Ionicons name="open-outline" size={13} color={p.accent} />
      </Pressable>
    </Card>
  );
}

function SwitchRow({ title, subtitle, value, onChange, last }: { title: string; subtitle: string; value: boolean; onChange(v: boolean): void; last?: boolean }) {
  const p = usePalette();
  return (
    <View style={[styles.switchRow, !last && { borderBottomColor: p.hairline, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <View style={{ flex: 1 }}>
        <Text style={[TYPE.body, { color: p.text }]}>{title}</Text>
        <Text style={[TYPE.footnote, { color: p.secondary, marginTop: 2 }]}>{subtitle}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: p.accent, false: p.border }} accessibilityLabel={title} />
    </View>
  );
}

/** The whole journal as plain text, oldest first, with the open lists at the end. */
function journalText(entries: JournalEntry[], items: TrackedItem[]): string {
  const lines: string[] = ['My journal', ''];
  let day = '';
  for (const e of [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const date = new Date(e.createdAt);
    const label = date.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (label !== day) {
      lines.push('', label.toUpperCase());
      day = label;
    }
    lines.push(`${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}  ${e.text}`);
  }
  const open = items.filter((i) => !i.done);
  if (open.length) {
    lines.push('', '', 'OPEN ITEMS');
    for (const i of open) lines.push(`- [${KIND_LABEL[i.kind]}] ${i.title}${i.dueDate ? ` (${formatDue(i.dueDate)})` : ''}`);
  }
  return lines.join('\n');
}

export default function SettingsScreen() {
  const p = usePalette();
  const { facts, forgetFact, prefs, setPref, entries, items } = useJournal();

  const exportJournal = () => {
    if (!entries.length) {
      Alert.alert('Nothing to export yet', 'Your messages become journal entries. Once there are some, you can export them here.');
      return;
    }
    Share.share({ title: 'My journal', message: journalText(entries, items) }).catch(() => {});
  };

  return (
    <ScrollView
      style={{ backgroundColor: p.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
    >
      <View style={styles.firstSection}>
        <KeyCard name="anthropic" />
        <WebSearchNote />
        <View style={{ height: SPACE.m }} />
        <KeyCard name="openai" />
        <Footnote>
          Keys stay in your iPhone's keychain. Recordings go to OpenAI to be written down, and your messages go to Claude when you
          chat. Without keys, everything still works on the phone, just less smartly.
        </Footnote>
      </View>

      <Section title="Notifications">
        <SwitchRow
          title="When something is saved"
          subtitle="A quick note listing what went to your lists, and when you'll be reminded."
          value={prefs.savedNotifications}
          onChange={(v) => setPref('savedNotifications', v)}
        />
        <SwitchRow
          title="Morning plan and evening check"
          subtitle="At 8:30 am and 8:30 pm, plus a Sunday check-in on your goals."
          value={prefs.dailyDigests}
          onChange={(v) => setPref('dailyDigests', v)}
          last
        />
      </Section>
      <Footnote>Task reminders always come at their time. If none arrive, allow notifications for Expo Go in iPhone Settings.</Footnote>

      <Section title="What your companion remembers" count={facts.length || undefined}>
        {facts.length ? (
          facts.map((fact, i) => (
            <View key={`${fact}-${i}`} style={[styles.factRow, i < facts.length - 1 && { borderBottomColor: p.hairline, borderBottomWidth: StyleSheet.hairlineWidth }]}>
              <Text style={[TYPE.callout, { color: p.text, flex: 1 }]}>{fact}</Text>
              <Pressable onPress={() => forgetFact(i)} hitSlop={10} accessibilityLabel={`Forget: ${fact}`}>
                <Ionicons name="close-circle" size={20} color={tint(p.secondary, 0.5)} />
              </Pressable>
            </View>
          ))
        ) : (
          <Text style={[TYPE.callout, styles.quiet, { color: p.secondary }]}>
            Nothing yet. As you talk, it notes things like who people are, so its answers fit your life.
          </Text>
        )}
      </Section>

      <Section title="Your journal">
        <Row icon="hardware-chip-outline" title="On-phone brain" subtitle="How well it sorts, and what it has learned from you" onPress={() => router.push('/brain')} />
        <Row icon="share-outline" title="Export your journal" subtitle={`${entries.length} entries as plain text`} onPress={exportJournal} last />
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: SPACE.xxxl },
  firstSection: { marginTop: SPACE.l },
  keyCard: { paddingVertical: SPACE.l, gap: SPACE.s },
  keyHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s + 2 },
  keyIcon: { width: 30, height: 30, borderRadius: RADIUS.s, alignItems: 'center', justifyContent: 'center' },
  pill: { borderRadius: RADIUS.pill, paddingHorizontal: 9, paddingVertical: 3 },
  keyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  input: { borderRadius: RADIUS.s + 2, paddingHorizontal: 12, paddingVertical: 11, marginTop: 4 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.m, paddingVertical: SPACE.m },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.m, paddingVertical: SPACE.m },
  quiet: { paddingVertical: SPACE.s },
});
