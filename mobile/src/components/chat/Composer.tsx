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
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { transcribe } from '../../ai/transcribe';
import { usePalette } from '../theme';

const RECORDING: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: 96000,
  isMeteringEnabled: true,
};

const BARS = 28;
const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export interface ComposerHandle {
  startRecording(): void;
}

interface Props {
  /** Sends the message. Return false to keep the text (e.g. while busy). */
  onSend(text: string, source: 'voice' | 'text'): void;
  openaiKey: string | null;
  vocabulary: () => string[];
  keyboardOpen: boolean;
  onError(message: string): void;
}

/** The message bar: type, or tap the mic and talk. A button puts the keyboard away. */
export const Composer = forwardRef<ComposerHandle, Props>(function Composer({ onSend, openaiKey, vocabulary, keyboardOpen, onError }, ref) {
  const p = usePalette();
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<'idle' | 'recording' | 'transcribing'>('idle');
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0));
  const [dictationTip, setDictationTip] = useState(false);
  // Remembers whether the text came from the mic, so the entry is marked as spoken.
  const spoken = useRef(false);
  const input = useRef<TextInput>(null);
  const recorder = useAudioRecorder(RECORDING);
  const state = useAudioRecorderState(recorder, 80);
  const pulse = useRef(new Animated.Value(0)).current;

  // Mic level (dB, about -60 quiet to 0 loud) feeds the moving bars.
  useEffect(() => {
    if (phase !== 'recording') return;
    const level = Math.max(0.04, Math.min(1, ((state.metering ?? -60) + 55) / 50));
    setLevels((l) => [...l.slice(1), level]);
  }, [state.metering, state.durationMillis, phase]);

  useEffect(() => {
    if (phase !== 'recording') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [phase, pulse]);

  useEffect(
    () => () => {
      setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    },
    [],
  );

  const start = async () => {
    if (!openaiKey) {
      // No speech key: the keyboard's own mic does the talking.
      setDictationTip(true);
      input.current?.focus();
      return;
    }
    try {
      Keyboard.dismiss();
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        onError('Microphone access is off. Turn it on in iPhone Settings > Expo Go.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setLevels(Array(BARS).fill(0));
      setPhase('recording');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch (e) {
      console.warn(e);
      onError("Couldn't start the microphone. You can type instead.");
      setPhase('idle');
    }
  };

  useImperativeHandle(ref, () => ({ startRecording: start }));

  const stop = async (keep: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setPhase(keep ? 'transcribing' : 'idle');
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
      if (!keep) return;
      const uri = recorder.uri;
      if (!uri) throw new Error('No recording');
      const heard = await transcribe(uri, openaiKey!, vocabulary());
      if (!heard) {
        onError("I didn't catch anything. Try again, a little closer to the phone.");
      } else {
        spoken.current = true;
        setText((t) => (t.trim() ? `${t.trim()} ${heard}` : heard));
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Transcription failed. You can type instead.');
    } finally {
      setPhase('idle');
    }
  };

  const send = () => {
    const value = text.trim();
    if (!value) return;
    onSend(value, spoken.current ? 'voice' : 'text');
    spoken.current = false;
    setText('');
    setDictationTip(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  if (phase !== 'idle') {
    const recording = phase === 'recording';
    return (
      <View style={[styles.bar, { borderTopColor: p.border, backgroundColor: p.background }]}>
        <View style={[styles.recordBox, { backgroundColor: p.card, borderColor: recording ? p.danger : p.border }]}>
          <Pressable onPress={() => stop(false)} disabled={!recording} hitSlop={10} accessibilityLabel="Cancel recording" style={styles.cancel}>
            <Ionicons name="close" size={22} color={recording ? p.secondary : p.border} />
          </Pressable>
          {recording ? (
            <>
              <Animated.View style={[styles.recDot, { backgroundColor: p.danger, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] }) }]} />
              <Text style={[styles.timer, { color: p.text }]}>{clock(state.durationMillis)}</Text>
              <View style={styles.wave}>
                {levels.map((l, i) => (
                  <View key={i} style={[styles.waveBar, { height: 4 + l * 26, backgroundColor: i > BARS - 4 ? p.danger : p.accent }]} />
                ))}
              </View>
            </>
          ) : (
            <View style={styles.transcribing}>
              <ActivityIndicator color={p.accent} />
              <Text style={{ color: p.secondary, fontSize: 15 }}>Writing it down…</Text>
            </View>
          )}
        </View>
        <Pressable
          onPress={() => stop(true)}
          disabled={!recording}
          style={[styles.round, { backgroundColor: recording ? p.danger : p.border }]}
          accessibilityLabel="Stop and write it down"
        >
          <Ionicons name="stop" size={20} color="#fff" />
        </Pressable>
      </View>
    );
  }

  const hasText = !!text.trim();
  return (
    <View style={[styles.wrap, { borderTopColor: p.border, backgroundColor: p.background }]}>
      {dictationTip && !hasText ? (
        <Pressable onPress={() => setDictationTip(false)} style={[styles.tip, { backgroundColor: p.accentSoft }]}>
          <Ionicons name="mic" size={16} color={p.accent} />
          <Text style={[styles.tipText, { color: p.text }]}>
            Tap the <Text style={{ fontWeight: '700' }}>mic on your keyboard</Text> (bottom right) and talk. For better speech, add an OpenAI key in Settings.
          </Text>
          <Ionicons name="close" size={16} color={p.secondary} />
        </Pressable>
      ) : null}
      {spoken.current && hasText ? <Text style={[styles.checkHint, { color: p.secondary }]}>Check it reads right, then send.</Text> : null}
      <View style={styles.bar}>
        {keyboardOpen ? (
          <Pressable onPress={() => Keyboard.dismiss()} hitSlop={8} style={[styles.side, { backgroundColor: p.card, borderColor: p.border }]} accessibilityLabel="Hide keyboard">
            <Ionicons name="chevron-down" size={22} color={p.secondary} />
          </Pressable>
        ) : null}
        <TextInput
          ref={input}
          value={text}
          onChangeText={(t) => {
            setText(t);
            if (!t) spoken.current = false;
          }}
          placeholder="Talk to me, or jot something down"
          placeholderTextColor={p.secondary}
          multiline
          style={[styles.input, { backgroundColor: p.card, color: p.text, borderColor: p.border }]}
        />
        {hasText ? (
          <Pressable onPress={send} style={[styles.round, { backgroundColor: p.accent }]} accessibilityLabel="Send">
            <Ionicons name="arrow-up" size={22} color="#fff" />
          </Pressable>
        ) : (
          <Pressable onPress={start} style={[styles.round, styles.mic, { backgroundColor: p.accent, shadowColor: p.accent }]} accessibilityLabel="Talk">
            <Ionicons name="mic" size={22} color="#fff" />
          </Pressable>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { borderTopWidth: StyleSheet.hairlineWidth },
  bar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 10, paddingVertical: 8 },
  side: { width: 40, height: 40, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 130,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 16,
    lineHeight: 21,
  },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  mic: { shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  recordBox: { flex: 1, height: 44, borderRadius: 22, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', paddingRight: 12, gap: 8 },
  cancel: { paddingLeft: 10 },
  recDot: { width: 9, height: 9, borderRadius: 5 },
  timer: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'], minWidth: 38 },
  wave: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2, height: 32, overflow: 'hidden' },
  waveBar: { width: 3, borderRadius: 2 },
  transcribing: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 10, marginTop: 8, padding: 10, borderRadius: 12 },
  tipText: { flex: 1, fontSize: 13, lineHeight: 18 },
  checkHint: { fontSize: 12, marginHorizontal: 18, marginTop: 6 },
});
