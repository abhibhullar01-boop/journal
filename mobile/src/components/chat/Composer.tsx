import { Ionicons } from '@expo/vector-icons';
import {
  AudioQuality,
  IOSOutputFormat,
  RecordingOptions,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, TextInputInstance, View } from 'react-native';
import { browserSpeechAvailable, Listening, startListening } from '../../ai/browserSpeech';
import { transcribe } from '../../ai/transcribe';
import { hasFinePointer } from '../layout';
import { RADIUS, SPACE, tint, TYPE, usePalette } from '../theme';

/**
 * Speech-quality audio: mono, 24 kHz, 48 kbps AAC. A minute is about 360 KB, a third of the
 * old size, so it uploads quickly on mobile data; the speech models listen at 16-24 kHz anyway.
 */
const RECORDING: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  sampleRate: 24000,
  numberOfChannels: 1,
  bitRate: 48000,
  isMeteringEnabled: true,
  ios: { ...RecordingPresets.HIGH_QUALITY.ios, outputFormat: IOSOutputFormat.MPEG4AAC, audioQuality: AudioQuality.HIGH },
};

/** Long recordings stop on their own (well under the 25 MB upload limit). */
const MAX_RECORDING_MS = 15 * 60_000;
const BARS = 30;
const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export interface ComposerHandle {
  startRecording(): void;
}

interface Props {
  onSend(text: string, source: 'voice' | 'text'): void;
  openaiKey: string | null;
  vocabulary: () => string[];
  keyboardOpen: boolean;
  onError(message: string): void;
  /** The user is about to say something (focus or mic): a good moment to warm up the companion. */
  onStart?(): void;
  /** Editing one of your earlier messages. */
  editing?: { id: string; text: string } | null;
  onSaveEdit?(id: string, text: string): void;
  onCancelEdit?(): void;
}

type Phase = 'idle' | 'recording' | 'transcribing';

const WEB = Platform.OS === 'web';
const MIC_BLOCKED = WEB
  ? 'Microphone access is blocked. Allow it for this site (the icon left of the web address), then try again.'
  : 'Microphone access is off. Turn it on in iPhone Settings > Expo Go.';

/** The message bar: type, or tap the mic and talk. */
export const Composer = forwardRef<ComposerHandle, Props>(function Composer(
  { onSend, openaiKey, vocabulary, keyboardOpen, onError, onStart, editing, onSaveEdit, onCancelEdit },
  ref,
) {
  const p = usePalette();
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0));
  const [dictationTip, setDictationTip] = useState(false);
  // Remembers whether the text came from the mic, so the entry is marked as spoken.
  const spoken = useRef(false);
  /** After the recording: send straight away, or put the words in the box to check first. */
  const sendAfter = useRef(true);
  /** Set while a recording is being stopped, so a second tap (or the time limit) doesn't stop it twice. */
  const stopping = useRef(false);
  const input = useRef<TextInputInstance>(null);
  const recorder = useAudioRecorder(RECORDING);
  const state = useAudioRecorderState(recorder, 80);
  const pulse = useRef(new Animated.Value(0)).current;
  /** On the website without an OpenAI key, the browser's own speech recognition listens. */
  const listening = useRef<Listening | null>(null);
  const [heardSoFar, setHeardSoFar] = useState('');
  const [listenStart, setListenStart] = useState(0);
  const [listenTime, setListenTime] = useState(0);
  /** A computer: Enter sends, Shift+Enter starts a new line. */
  const desktop = useRef(hasFinePointer()).current;

  // Editing an earlier message puts its words in the box.
  useEffect(() => {
    if (editing) {
      setText(editing.text);
      spoken.current = false;
      setTimeout(() => input.current?.focus(), 50);
    }
  }, [editing]);

  // Mic level (dB, about -60 quiet to 0 loud) feeds the moving bars.
  useEffect(() => {
    if (phase !== 'recording') return;
    const level = Math.max(0.05, Math.min(1, ((state.metering ?? -60) + 55) / 48));
    setLevels((l) => [...l.slice(1), level]);
    if (state.durationMillis > MAX_RECORDING_MS) stop('send');
  }, [state.metering, state.durationMillis, phase]);

  // The browser's listening has no recorder clock, so it keeps its own.
  useEffect(() => {
    if (phase !== 'recording' || !listenStart) return;
    const timer = setInterval(() => {
      const ms = Date.now() - listenStart;
      setListenTime(ms);
      if (ms > MAX_RECORDING_MS) stop('send');
    }, 250);
    return () => clearInterval(timer);
  }, [phase, listenStart]);

  useEffect(() => {
    if (phase !== 'recording') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [phase, pulse]);

  useEffect(
    () => () => {
      listening.current?.cancel();
      setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    },
    [],
  );

  /** The website, no OpenAI key: listen with the browser's speech recognition. */
  const listenInBrowser = () => {
    try {
      setHeardSoFar('');
      listening.current = startListening(setHeardSoFar, (message) => {
        listening.current?.cancel();
        listening.current = null;
        setListenStart(0);
        setPhase('idle');
        onError(message);
      });
      setListenStart(Date.now());
      setListenTime(0);
      setPhase('recording');
    } catch {
      listening.current = null;
      onError("This browser can't listen. Add an OpenAI key in Settings, or type instead.");
    }
  };

  const start = async () => {
    onStart?.();
    if (!openaiKey) {
      if (WEB && browserSpeechAvailable()) {
        listenInBrowser();
        return;
      }
      // No speech key: the keyboard's own mic does the talking.
      setDictationTip(true);
      input.current?.focus();
      return;
    }
    try {
      Keyboard.dismiss();
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        onError(MIC_BLOCKED);
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
      // A browser that was refused the microphone throws here rather than returning "not granted".
      onError(WEB && /denied|allowed|permission/i.test(String(e)) ? MIC_BLOCKED : "Couldn't start the microphone. You can type instead.");
      setPhase('idle');
    }
  };

  useImperativeHandle(ref, () => ({ startRecording: start }));

  /** Ends the recording: 'send' sends the words, 'review' puts them in the box, 'cancel' throws it away. */
  const stop = async (how: 'send' | 'review' | 'cancel') => {
    if (phase !== 'recording' || stopping.current) return;
    stopping.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    sendAfter.current = how === 'send';
    setPhase(how === 'cancel' ? 'idle' : 'transcribing');
    try {
      let heard: string;
      if (listening.current) {
        const session = listening.current;
        listening.current = null;
        setListenStart(0);
        if (how === 'cancel') {
          session.cancel();
          return;
        }
        heard = (await session.stop()).trim();
      } else {
        await recorder.stop();
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
        if (how === 'cancel') return;
        const uri = recorder.uri;
        if (!uri) throw new Error('No recording');
        heard = await transcribe(uri, openaiKey!, vocabulary());
      }
      if (!heard) {
        onError(WEB ? "I didn't catch anything. Try again, a little closer to the mic." : "I didn't catch anything. Try again, a little closer to the phone.");
      } else if (sendAfter.current && !editing) {
        const typed = text.trim();
        onSend(typed ? `${typed} ${heard}` : heard, 'voice');
        setText('');
        spoken.current = false;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else {
        spoken.current = true;
        setText((t) => (t.trim() ? `${t.trim()} ${heard}` : heard));
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Transcription failed. You can type instead.');
    } finally {
      stopping.current = false;
      setPhase('idle');
    }
  };

  const send = () => {
    const value = text.trim();
    if (!value) return;
    if (editing) {
      onSaveEdit?.(editing.id, value);
    } else {
      onSend(value, spoken.current ? 'voice' : 'text');
    }
    spoken.current = false;
    setText('');
    setDictationTip(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const cancelEdit = () => {
    setText('');
    onCancelEdit?.();
  };

  if (phase !== 'idle') {
    const recording = phase === 'recording';
    return (
      <View style={[styles.wrap, { borderTopColor: p.hairline, backgroundColor: p.background }]}>
        <Text style={[TYPE.caption, styles.hint, { color: p.secondary }]}>
          {recording
            ? `Listening… ${desktop ? 'click' : 'tap'} ↑ to send, or the pencil to check the words first`
            : sendAfter.current
              ? 'Writing it down and sending…'
              : 'Writing it down…'}
        </Text>
        <View style={styles.bar}>
          <View style={[styles.pill, styles.recordPill, { backgroundColor: p.card, borderColor: recording ? tint(p.danger, 0.45) : p.border }]}>
            <Pressable onPress={() => stop('cancel')} disabled={!recording} hitSlop={10} accessibilityLabel="Cancel recording" style={styles.cancel}>
              <Ionicons name="close" size={20} color={recording ? p.secondary : p.border} />
            </Pressable>
            {recording ? (
              <>
                <Animated.View style={[styles.recDot, { backgroundColor: p.danger, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.25] }) }]} />
                <Text style={[styles.timer, { color: p.text }]}>{clock(listenStart ? listenTime : state.durationMillis)}</Text>
                {listenStart ? (
                  <Text style={[TYPE.callout, styles.heard, { color: heardSoFar ? p.text : p.tertiary }]} numberOfLines={1}>
                    {heardSoFar ? (heardSoFar.length > 70 ? `…${heardSoFar.slice(-70)}` : heardSoFar) : 'Listening…'}
                  </Text>
                ) : (
                  <View style={styles.wave}>
                    {levels.map((l, i) => (
                      <View key={i} style={[styles.waveBar, { height: 3 + l * 24, backgroundColor: i > BARS - 4 ? p.accent : tint(p.accent, 0.55) }]} />
                    ))}
                  </View>
                )}
              </>
            ) : (
              <View style={styles.transcribing}>
                <ActivityIndicator color={p.accent} />
                <Text style={[TYPE.callout, { color: p.secondary }]}>Writing it down…</Text>
              </View>
            )}
          </View>
          {recording ? (
            <Pressable
              onPress={() => stop('review')}
              style={({ pressed }) => [styles.round, styles.secondaryRound, { backgroundColor: p.card, borderColor: p.border }, pressed && { opacity: 0.7 }]}
              accessibilityLabel="Stop and check the words before sending"
            >
              <Ionicons name="create-outline" size={19} color={p.text} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => stop('send')}
            disabled={!recording}
            style={({ pressed }) => [styles.round, { backgroundColor: recording ? p.accent : p.border }, pressed && { opacity: 0.8 }]}
            accessibilityLabel="Stop and send"
          >
            <Ionicons name="arrow-up" size={21} color="#fff" />
          </Pressable>
        </View>
      </View>
    );
  }

  const hasText = !!text.trim();
  return (
    <View style={[styles.wrap, { borderTopColor: p.hairline, backgroundColor: p.background }]}>
      {editing ? (
        <View style={[styles.banner, { backgroundColor: p.sunken }]}>
          <Ionicons name="create-outline" size={15} color={p.secondary} />
          <Text style={[TYPE.footnote, { color: p.text, flex: 1 }]}>Editing your message. It will be sorted again.</Text>
          <Pressable onPress={cancelEdit} hitSlop={10}>
            <Text style={[TYPE.footnote, { color: p.accent, fontWeight: '600' }]}>Cancel</Text>
          </Pressable>
        </View>
      ) : dictationTip && !hasText ? (
        <Pressable onPress={() => setDictationTip(false)} style={[styles.banner, { backgroundColor: p.accentSoft }]}>
          <Ionicons name="mic-outline" size={15} color={p.accent} />
          <Text style={[TYPE.footnote, { color: p.text, flex: 1 }]}>
            {WEB ? (
              <>
                This browser can't listen by itself. Add an <Text style={{ fontWeight: '700' }}>OpenAI key</Text> in Settings to talk, or type here.
              </>
            ) : (
              <>
                Tap the <Text style={{ fontWeight: '700' }}>mic on your keyboard</Text> and talk. For better speech, add an OpenAI key in Settings.
              </>
            )}
          </Text>
          <Ionicons name="close" size={15} color={p.secondary} />
        </Pressable>
      ) : spoken.current && hasText ? (
        <Text style={[TYPE.caption, styles.hint, { color: p.secondary }]}>Check it reads right, then send.</Text>
      ) : null}
      <View style={styles.bar}>
        {keyboardOpen ? (
          <Pressable
            onPress={() => Keyboard.dismiss()}
            hitSlop={8}
            style={({ pressed }) => [styles.side, pressed && { backgroundColor: p.sunken }]}
            accessibilityLabel="Hide keyboard"
          >
            <Ionicons name="chevron-down" size={22} color={p.secondary} />
          </Pressable>
        ) : null}
        <View style={[styles.pill, { backgroundColor: p.card, borderColor: p.border }]}>
          <TextInput
            ref={input}
            value={text}
            onChangeText={(t) => {
              setText(t);
              if (!t) spoken.current = false;
            }}
            onFocus={onStart}
            onKeyPress={
              desktop
                ? (e) => {
                    const key = e.nativeEvent as unknown as { key: string; shiftKey?: boolean; isComposing?: boolean };
                    if (key.key === 'Enter' && !key.shiftKey && !key.isComposing) {
                      e.preventDefault();
                      send();
                    }
                  }
                : undefined
            }
            placeholder={editing ? 'Edit your message' : desktop ? 'Message, or click the mic' : 'Message, or tap the mic'}
            placeholderTextColor={p.tertiary}
            multiline
            style={[styles.input, { color: p.text }]}
            accessibilityLabel="Message"
          />
          {hasText ? (
            <Pressable onPress={send} style={({ pressed }) => [styles.round, styles.inner, { backgroundColor: p.accent }, pressed && { opacity: 0.8 }]} accessibilityLabel={editing ? 'Save' : 'Send'}>
              <Ionicons name={editing ? 'checkmark' : 'arrow-up'} size={20} color="#fff" />
            </Pressable>
          ) : (
            <Pressable onPress={start} style={({ pressed }) => [styles.round, styles.inner, { backgroundColor: p.accent }, pressed && { opacity: 0.8 }]} accessibilityLabel="Talk">
              <Ionicons name="mic" size={19} color="#fff" />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6 },
  bar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingBottom: 8, paddingTop: 2 },
  side: { width: 38, height: 44, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 16,
    paddingRight: 4,
  },
  input: { flex: 1, maxHeight: 140, fontSize: 16, lineHeight: 21, paddingTop: 11, paddingBottom: 11 },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  inner: { width: 36, height: 36, borderRadius: 18, marginBottom: 4, marginLeft: 6 },
  secondaryRound: { borderWidth: StyleSheet.hairlineWidth, marginBottom: 2 },
  recordPill: { alignItems: 'center', height: 44, gap: 8, paddingLeft: 0, paddingRight: 14 },
  cancel: { paddingLeft: 12 },
  recDot: { width: 8, height: 8, borderRadius: 4 },
  timer: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'], minWidth: 38 },
  wave: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2, height: 30, overflow: 'hidden' },
  waveBar: { width: 3, borderRadius: 2 },
  heard: { flex: 1 },
  transcribing: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginBottom: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: RADIUS.m },
  hint: { marginHorizontal: SPACE.xl, marginBottom: 4 },
});
