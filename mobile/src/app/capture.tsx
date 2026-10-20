import { Ionicons } from '@expo/vector-icons';
import {
  RecordingOptions,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useKeys } from '../ai/keys';
import { transcribe } from '../ai/transcribe';
import { journalVocabulary } from '../ai/vocabulary';
import { ItemRow } from '../components/ItemRow';
import { usePalette } from '../components/theme';
import { BigButton, Card, SectionTitle } from '../components/ui';
import { useJournal } from '../store/JournalContext';
import type { CaptureMode } from '../store/types';

const RECORDING: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: 96000,
  isMeteringEnabled: true,
};

type Phase = 'starting' | 'recording' | 'transcribing' | 'editing';

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Shows what was found in a saved entry, updating live while Claude double-checks it. */
function SavedView({ entryId }: { entryId: string }) {
  const p = usePalette();
  const { items, refining } = useJournal();
  const found = items.filter((i) => i.entryId === entryId);
  const checking = refining.includes(entryId);
  return (
    <ScrollView style={{ backgroundColor: p.background }} contentContainerStyle={{ paddingBottom: 40 }}>
      <Stack.Screen options={{ title: 'Saved', headerLeft: () => null, headerRight: () => null }} />
      {checking ? (
        <View style={styles.checking}>
          <ActivityIndicator color={p.accent} />
          <Text style={{ color: p.secondary, fontSize: 14 }}>Claude is double-checking…</Text>
        </View>
      ) : null}
      {found.length === 0 ? (
        <Card style={{ marginTop: 16 }}>
          <Text style={{ color: p.secondary, fontSize: 15 }}>
            {checking ? 'Looking for tasks, shopping, skills and goals…' : 'Saved to your journal. Nothing to track in this one.'}
          </Text>
        </Card>
      ) : (
        <>
          <SectionTitle>Found in your entry</SectionTitle>
          <Card>
            {found.map((item) => (
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

/** Quick capture: record and transcribe (or type), check the text, save. */
export default function CaptureScreen() {
  const p = usePalette();
  const keys = useKeys();
  const { addEntry, entries, facts } = useJournal();
  const { mode: rawMode } = useLocalSearchParams<{ mode?: string }>();
  const wantsVoice = rawMode !== 'text';
  const canRecord = wantsVoice && !!keys.openai;
  const source: CaptureMode = wantsVoice ? 'voice' : 'text';

  const recorder = useAudioRecorder(RECORDING);
  const state = useAudioRecorderState(recorder, 100);
  const [phase, setPhase] = useState<Phase>(canRecord ? 'starting' : 'editing');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const started = useRef(false);

  const startRecording = async () => {
    setError(null);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError('Microphone access is off. Turn it on in iPhone Settings > Expo Go, or type instead.');
        setPhase('editing');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setPhase('recording');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch (e) {
      console.warn(e);
      setError("Couldn't start the microphone. You can type instead.");
      setPhase('editing');
    }
  };

  const stopRecording = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setPhase('transcribing');
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
      const uri = recorder.uri;
      if (!uri) throw new Error('No recording');
      const vocabulary = journalVocabulary(entries.slice(0, 40).map((e) => e.text), facts);
      const heard = await transcribe(uri, keys.openai!, vocabulary);
      setText((t) => (t.trim() ? `${t.trim()} ${heard}` : heard));
      if (!heard) setError("I didn't catch anything. Try again, a little closer to the phone.");
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transcription failed. You can type instead.');
    } finally {
      setPhase('editing');
    }
  };

  useEffect(() => {
    if (canRecord && !started.current) {
      started.current = true;
      startRecording();
    }
    return () => {
      setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    };
  }, []);

  const canSave = text.trim().length > 0 && phase === 'editing';
  const save = () => {
    if (!canSave) return;
    setSavedId(addEntry(text, source));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  if (savedId) return <SavedView entryId={savedId} />;

  // A level between 0 and 1 from the mic meter (dB, about -60 quiet to 0 loud).
  const level = Math.max(0, Math.min(1, ((state.metering ?? -60) + 60) / 60));

  const header = (
    <Stack.Screen
      options={{
        title: wantsVoice ? 'Talk' : 'Write',
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
  );

  if (phase === 'starting' || phase === 'recording' || phase === 'transcribing') {
    const recording = phase === 'recording';
    return (
      <View style={[styles.recordScreen, { backgroundColor: p.background }]}>
        {header}
        {text ? (
          <Text style={[styles.soFar, { color: p.secondary }]} numberOfLines={3}>
            {text}
          </Text>
        ) : null}
        <Text style={[styles.status, { color: p.text }]}>
          {phase === 'transcribing' ? 'Writing it down…' : recording ? "I'm listening" : 'Getting the mic ready…'}
        </Text>
        <Text style={[styles.timer, { color: p.secondary }]}>{recording ? clock(state.durationMillis) : ' '}</Text>
        <View style={styles.micWrap}>
          <View
            style={[
              styles.pulse,
              { backgroundColor: `${p.accent}22`, transform: [{ scale: recording ? 1 + level * 0.6 : 1 }] },
            ]}
          />
          <Pressable
            onPress={recording ? stopRecording : undefined}
            disabled={!recording}
            style={[styles.bigMic, { backgroundColor: recording ? p.danger : p.accent }]}
            accessibilityLabel="Stop recording"
          >
            {phase === 'transcribing' ? (
              <ActivityIndicator size="large" color="#fff" />
            ) : (
              <Ionicons name={recording ? 'stop' : 'mic'} size={48} color="#fff" />
            )}
          </Pressable>
        </View>
        <Text style={[styles.tip, { color: p.secondary }]}>
          {recording ? 'Talk naturally. Tap the button when you are done.' : ' '}
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: p.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {header}
      {error ? (
        <View style={[styles.banner, { backgroundColor: `${p.danger}15` }]}>
          <Ionicons name="alert-circle-outline" size={20} color={p.danger} />
          <Text style={[styles.bannerText, { color: p.text }]}>{error}</Text>
        </View>
      ) : null}
      {wantsVoice && !keys.openai ? (
        <Pressable onPress={() => router.push('/settings')} style={[styles.banner, { backgroundColor: `${p.accent}15` }]}>
          <Ionicons name="mic" size={20} color={p.accent} />
          <Text style={[styles.bannerText, { color: p.text }]}>
            For now, tap the <Text style={{ fontWeight: '700' }}>mic on your keyboard</Text> and talk. For much better
            speech recognition, <Text style={{ color: p.accent, fontWeight: '700' }}>add an OpenAI key in Settings</Text>.
          </Text>
        </Pressable>
      ) : null}
      {canRecord && text ? (
        <Text style={[styles.checkHint, { color: p.secondary }]}>Check it reads right, fix anything, then Save.</Text>
      ) : null}
      <TextInput
        value={text}
        onChangeText={setText}
        autoFocus={!canRecord}
        multiline
        placeholder="What's on your mind?"
        placeholderTextColor={p.secondary}
        style={[styles.input, { color: p.text, backgroundColor: p.card }]}
        textAlignVertical="top"
      />
      <View style={styles.actions}>
        {canRecord ? <BigButton title={text ? 'Add more' : 'Record'} icon="mic" filled={false} onPress={startRecording} /> : null}
        <BigButton title="Save" icon="checkmark" onPress={save} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  recordScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  soFar: { fontSize: 15, textAlign: 'center', marginBottom: 12 },
  status: { fontSize: 24, fontWeight: '700' },
  timer: { fontSize: 17, fontVariant: ['tabular-nums'] },
  micWrap: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center', marginVertical: 24 },
  pulse: { position: 'absolute', width: 180, height: 180, borderRadius: 90 },
  bigMic: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center' },
  tip: { fontSize: 15, textAlign: 'center' },
  banner: { flexDirection: 'row', gap: 10, alignItems: 'center', margin: 16, marginBottom: 0, padding: 12, borderRadius: 12 },
  bannerText: { flex: 1, fontSize: 14, lineHeight: 19 },
  checkHint: { marginHorizontal: 20, marginTop: 14, fontSize: 14 },
  input: { flex: 1, margin: 16, padding: 14, borderRadius: 14, fontSize: 17, lineHeight: 24 },
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  checking: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  footnote: { marginHorizontal: 20, fontSize: 13, lineHeight: 18 },
  doneRow: { flexDirection: 'row', margin: 16, marginTop: 24 },
});
