import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useKeys } from '../../ai/keys';
import { usePalette } from '../../components/theme';
import { useJournal } from '../../store/JournalContext';

const STARTERS = [
  'What should I focus on today?',
  'What do I need to buy this week?',
  'How am I doing on my goals?',
  'Remind me to call mom tomorrow evening',
  "I'm feeling a bit low today",
];

/** Talk to your companion. It has read your journal and can add things to your lists. */
export default function ChatScreen() {
  const p = usePalette();
  const navigation = useNavigation();
  const { anthropic } = useKeys();
  const { chat, chatBusy, sendChat, clearChat } = useJournal();
  const { ask } = useLocalSearchParams<{ ask?: string }>();
  const [draft, setDraft] = useState('');
  const scroll = useRef<ScrollView>(null);
  const lastAsk = useRef<string | undefined>(undefined);

  const send = (text: string) => {
    if (!text.trim() || chatBusy) return;
    setDraft('');
    sendChat(text);
  };

  // A question tapped on the Today tab arrives as ?ask=...
  useEffect(() => {
    if (ask && ask !== lastAsk.current) {
      lastAsk.current = ask;
      send(ask);
      router.setParams({ ask: undefined });
    }
  }, [ask]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        chat.length ? (
          <Pressable
            hitSlop={10}
            style={{ marginRight: 16 }}
            onPress={() =>
              Alert.alert('Start a new chat?', 'Your companion still remembers your journal and the facts it saved.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'New chat', onPress: clearChat },
              ])
            }
          >
            <Ionicons name="create-outline" size={24} color={p.accent} />
          </Pressable>
        ) : null,
    });
  }, [navigation, chat.length]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: p.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.thread}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
      >
        {!chat.length ? (
          <View style={styles.intro}>
            <View style={[styles.avatar, { backgroundColor: p.accent }]}>
              <Ionicons name="sparkles" size={30} color="#fff" />
            </View>
            <Text style={[styles.introTitle, { color: p.text }]}>Your companion</Text>
            <Text style={[styles.introText, { color: p.secondary }]}>
              I've read your journal. Ask me what to focus on, what to buy, or just talk. I can add things to your lists too.
            </Text>
            {!anthropic ? (
              <Pressable onPress={() => router.push('/settings')} style={[styles.setup, { borderColor: p.accent }]}>
                <Ionicons name="key-outline" size={18} color={p.accent} />
                <Text style={{ color: p.accent, fontWeight: '600', fontSize: 15 }}>Add your Claude key to start</Text>
              </Pressable>
            ) : null}
            <View style={styles.starters}>
              {STARTERS.map((s) => (
                <Pressable key={s} onPress={() => send(s)} style={[styles.starter, { backgroundColor: p.card, borderColor: p.border }]}>
                  <Text style={{ color: p.text, fontSize: 15 }}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {chat.map((turn, i) => {
          const mine = turn.role === 'user';
          return (
            <View
              key={`${turn.at}-${i}`}
              style={[
                styles.bubble,
                mine ? { alignSelf: 'flex-end', backgroundColor: p.accent } : { alignSelf: 'flex-start', backgroundColor: p.card },
              ]}
            >
              <Text style={[styles.bubbleText, { color: mine ? '#fff' : p.text }]} selectable>
                {turn.text}
              </Text>
            </View>
          );
        })}
        {chatBusy ? (
          <View style={[styles.bubble, styles.typing, { backgroundColor: p.card }]}>
            <ActivityIndicator size="small" color={p.accent} />
            <Text style={{ color: p.secondary }}>Thinking…</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.composer, { borderTopColor: p.border, backgroundColor: p.background }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Message your companion"
          placeholderTextColor={p.secondary}
          multiline
          style={[styles.input, { backgroundColor: p.card, color: p.text, borderColor: p.border }]}
        />
        <Pressable
          onPress={() => send(draft)}
          disabled={!draft.trim() || chatBusy}
          style={[styles.send, { backgroundColor: draft.trim() && !chatBusy ? p.accent : p.border }]}
          accessibilityLabel="Send"
        >
          <Ionicons name="arrow-up" size={22} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  thread: { padding: 16, gap: 10, flexGrow: 1 },
  intro: { alignItems: 'center', paddingTop: 12, gap: 10 },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  introTitle: { fontSize: 22, fontWeight: '800' },
  introText: { fontSize: 15, lineHeight: 21, textAlign: 'center', paddingHorizontal: 12 },
  setup: { flexDirection: 'row', gap: 8, alignItems: 'center', borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, marginTop: 4 },
  starters: { alignSelf: 'stretch', gap: 8, marginTop: 10 },
  starter: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  bubble: { maxWidth: '85%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleText: { fontSize: 16, lineHeight: 22 },
  typing: { alignSelf: 'flex-start', flexDirection: 'row', gap: 8, alignItems: 'center' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, maxHeight: 120, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, fontSize: 16 },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
