import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Keyboard, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { KeyName, useKeys } from '../ai/keys';
import { usePalette } from '../components/theme';
import { Card, SectionTitle } from '../components/ui';
import { useJournal } from '../store/JournalContext';

const KEY_INFO: Record<KeyName, { title: string; what: string; url: string; prefix: string }> = {
  openai: {
    title: 'OpenAI key (speech)',
    what: 'Turns your voice into text, much more accurately than the keyboard mic. Costs well under a cent per minute.',
    url: 'https://platform.openai.com/api-keys',
    prefix: 'sk-',
  },
  anthropic: {
    title: 'Claude key (companion)',
    what: 'Powers the chat, and double-checks how each entry is sorted. Usually a few cents a day.',
    url: 'https://platform.claude.com/settings/keys',
    prefix: 'sk-ant-',
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
      Alert.alert("That doesn't look like the right key", `${info.title.split(' (')[0]}s start with "${info.prefix}".`);
      return;
    }
    await keys.setKey(name, value);
    setDraft('');
    Keyboard.dismiss();
  };

  return (
    <Card>
      <View style={styles.keyHeader}>
        <Text style={[styles.keyTitle, { color: p.text }]}>{info.title}</Text>
        {saved ? <Ionicons name="checkmark-circle" size={22} color={p.accent} /> : null}
      </View>
      <Text style={[styles.what, { color: p.secondary }]}>{info.what}</Text>
      {saved ? (
        <View style={styles.savedRow}>
          <Text style={{ color: p.text, fontSize: 15 }}>Saved, ending in …{saved.slice(-4)}</Text>
          <Pressable
            hitSlop={10}
            onPress={() =>
              Alert.alert('Remove this key?', undefined, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => keys.setKey(name, null) },
              ])
            }
          >
            <Text style={{ color: p.danger, fontSize: 15 }}>Remove</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={`Paste key (${info.prefix}…)`}
            placeholderTextColor={p.secondary}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={save}
            style={[styles.input, { color: p.text, borderColor: p.border }]}
          />
          <View style={styles.savedRow}>
            <Pressable onPress={() => Linking.openURL(info.url)} hitSlop={8}>
              <Text style={{ color: p.accent, fontSize: 15 }}>Get a key</Text>
            </Pressable>
            <Pressable onPress={save} disabled={!draft.trim()} style={[styles.saveButton, { backgroundColor: draft.trim() ? p.accent : p.border }]}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>Save</Text>
            </Pressable>
          </View>
        </>
      )}
    </Card>
  );
}

export default function SettingsScreen() {
  const p = usePalette();
  const { facts, forgetFact, prefs, setPref } = useJournal();

  return (
    <ScrollView
      style={{ backgroundColor: p.background }}
      contentContainerStyle={{ paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
    >
      <SectionTitle>Notifications</SectionTitle>
      <Card style={styles.linkRow}>
        <Ionicons name="notifications-outline" size={20} color={p.accent} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.text, fontSize: 16 }}>Tell me when something is saved</Text>
          <Text style={[styles.what, { color: p.secondary }]}>A quick notification listing what went to your lists and when you'll be reminded.</Text>
        </View>
        <Switch value={prefs.savedNotifications} onValueChange={(v) => setPref('savedNotifications', v)} trackColor={{ true: p.accent }} />
      </Card>
      <Text style={[styles.note, { color: p.secondary }]}>
        Reminders for tasks always come at their time, plus a morning plan at 8:30 and an evening check at 8:30 pm.
        If none arrive, turn on notifications for Expo Go in iPhone Settings.
      </Text>

      <SectionTitle>Keys</SectionTitle>
      <KeyCard name="openai" />
      <KeyCard name="anthropic" />
      <Text style={[styles.note, { color: p.secondary }]}>
        Keys stay in your iPhone's keychain. Your recordings go to OpenAI to be written down, and your journal text goes
        to Claude when you chat or save an entry. Without keys, everything still works on the phone, just less smartly.
      </Text>

      <SectionTitle>What your companion remembers</SectionTitle>
      <Card>
        {facts.length ? (
          facts.map((fact, i) => (
            <View key={`${fact}-${i}`} style={[styles.factRow, { borderBottomColor: p.border }]}>
              <Text style={[styles.fact, { color: p.text }]}>{fact}</Text>
              <Pressable onPress={() => forgetFact(i)} hitSlop={10} accessibilityLabel="Forget this">
                <Ionicons name="close-circle-outline" size={20} color={p.secondary} />
              </Pressable>
            </View>
          ))
        ) : (
          <Text style={{ color: p.secondary, fontSize: 15, lineHeight: 21 }}>
            Nothing yet. As you journal, it notes things like who people are, so it can be more personal.
          </Text>
        )}
      </Card>

      <SectionTitle>On-phone brain</SectionTitle>
      <Pressable onPress={() => router.push('/brain')}>
        <Card style={styles.linkRow}>
          <Ionicons name="bulb-outline" size={20} color={p.accent} />
          <Text style={{ flex: 1, color: p.text, fontSize: 16 }}>How the brain is doing</Text>
          <Ionicons name="chevron-forward" size={18} color={p.secondary} />
        </Card>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  keyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  keyTitle: { fontSize: 17, fontWeight: '700' },
  what: { fontSize: 14, lineHeight: 19, marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginTop: 10 },
  savedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  saveButton: { borderRadius: 10, paddingHorizontal: 18, paddingVertical: 8 },
  note: { marginHorizontal: 20, fontSize: 13, lineHeight: 18 },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  fact: { flex: 1, fontSize: 15, lineHeight: 20 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
