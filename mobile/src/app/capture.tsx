import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ItemRow } from '../components/ItemRow';
import { usePalette } from '../components/theme';
import { BigButton, Card, SectionTitle } from '../components/ui';
import { useJournal } from '../store/JournalContext';
import type { CaptureMode, TrackedItem } from '../store/types';

/** The quick-capture screen: speak (keyboard dictation) or type, then save. */
export default function CaptureScreen() {
  const p = usePalette();
  const { mode: rawMode } = useLocalSearchParams<{ mode?: string }>();
  const mode: CaptureMode = rawMode === 'text' ? 'text' : 'voice';
  const { addEntry } = useJournal();
  const [text, setText] = useState('');
  const [saved, setSaved] = useState<TrackedItem[] | null>(null);

  const canSave = text.trim().length > 0;
  const save = () => {
    if (!canSave) return;
    setSaved(addEntry(text, mode));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  if (saved) {
    return (
      <ScrollView style={{ backgroundColor: p.background }} contentContainerStyle={{ paddingBottom: 40 }}>
        <Stack.Screen options={{ title: 'Saved', headerLeft: () => null, headerRight: () => null }} />
        {saved.length === 0 ? (
          <Card style={{ marginTop: 16 }}>
            <Text style={{ color: p.secondary, fontSize: 15 }}>
              Saved as a reflection. No tasks, skills or goals in this one.
            </Text>
          </Card>
        ) : (
          <>
            <SectionTitle>Found in your entry</SectionTitle>
            <Card>
              {saved.map((item) => (
                <ItemRow key={item.id} item={item} showCheckbox={false} showCategory />
              ))}
            </Card>
            <Text style={[styles.footnote, { color: p.secondary }]}>
              Something in the wrong place? Tap its label to fix it. The app learns from every fix.
            </Text>
          </>
        )}
        <View style={styles.doneRow}>
          <BigButton title="Done" icon="checkmark" onPress={() => router.back()} />
        </View>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: p.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <Stack.Screen
        options={{
          title: mode === 'voice' ? 'Speak' : 'Write',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={10}>
              <Text style={{ color: p.accent, fontSize: 17 }}>Cancel</Text>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={save} disabled={!canSave} hitSlop={10}>
              <Text style={{ color: canSave ? p.accent : p.secondary, fontSize: 17, fontWeight: '600' }}>Save</Text>
            </Pressable>
          ),
        }}
      />
      {mode === 'voice' ? (
        <View style={[styles.hint, { backgroundColor: `${p.accent}18` }]}>
          <Ionicons name="mic" size={22} color={p.accent} />
          <Text style={[styles.hintText, { color: p.text }]}>
            Tap the <Text style={{ fontWeight: '700' }}>microphone on your keyboard</Text> (bottom right) and talk.
            Tap it again when you're done, then Save.
          </Text>
        </View>
      ) : null}
      <TextInput
        value={text}
        onChangeText={setText}
        autoFocus
        multiline
        placeholder="What's on your mind?"
        placeholderTextColor={p.secondary}
        style={[styles.input, { color: p.text, backgroundColor: p.card }]}
        textAlignVertical="top"
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hint: { flexDirection: 'row', gap: 10, alignItems: 'center', margin: 16, marginBottom: 0, padding: 12, borderRadius: 12 },
  hintText: { flex: 1, fontSize: 14, lineHeight: 19 },
  input: { flex: 1, margin: 16, padding: 14, borderRadius: 14, fontSize: 17, lineHeight: 24 },
  footnote: { marginHorizontal: 20, fontSize: 13, lineHeight: 18 },
  doneRow: { flexDirection: 'row', margin: 16, marginTop: 24 },
});
