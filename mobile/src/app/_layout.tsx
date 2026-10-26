import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetch as expoFetch } from 'expo/fetch';
import * as Notifications from 'expo-notifications';
import { DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { setFetch } from '../ai/claude';
import { setCacheStore, setHttpFetch } from '../ai/http';
import { KeysProvider } from '../ai/keys';
import { PALETTE } from '../components/theme';
import { JournalProvider, useJournal } from '../store/JournalContext';
import { MARK_DONE, setUpNotifications, SNOOZE } from '../store/reminders';

/** Handles taps on notifications: Mark done, snooze, or open the right screen. */
function NotificationBridge() {
  const journal = useJournal();
  const journalRef = useRef(journal);
  journalRef.current = journal;
  const pending = useRef<Notifications.NotificationResponse | null>(null);

  const handle = (response: Notifications.NotificationResponse) => {
    const j = journalRef.current;
    if (!j.ready) {
      pending.current = response;
      return;
    }
    const itemId = response.notification.request.content.data?.itemId as string | undefined;
    const item = j.items.find((i) => i.id === itemId);
    if (response.actionIdentifier === MARK_DONE) {
      if (item && !item.done) j.toggleDone(item.id);
    } else if (response.actionIdentifier === SNOOZE) {
      if (item) j.snooze(item.id);
    } else {
      const kind = response.notification.request.content.data?.kind;
      // A "saved" heads-up opens the chat where it was said; reminders and digests open Today.
      router.navigate(kind === 'saved' ? '/' : item ? { pathname: '/lists', params: { kind: item.kind } } : '/today');
    }
  };

  useEffect(() => {
    setUpNotifications();
    const subscription = Notifications.addNotificationResponseReceivedListener(handle);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (journal.ready && pending.current) {
      const response = pending.current;
      pending.current = null;
      handle(response);
    }
  }, [journal.ready]);

  return null;
}

// Expo's fetch can stream, so the companion's words appear as they're written, and link
// previews can stop reading a page once they have what they need.
setFetch(expoFetch);
setHttpFetch(expoFetch);
// Link previews are kept on the phone, so a link seen before shows its picture straight away.
setCacheStore({ get: (key) => AsyncStorage.getItem(key), set: (key, value) => AsyncStorage.setItem(key, value) });

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: PALETTE.accent,
    background: PALETTE.background,
    card: PALETTE.card,
    text: PALETTE.text,
    border: PALETTE.border,
  },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={theme}>
      <KeysProvider>
        <JournalProvider>
          <NotificationBridge />
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: PALETTE.background },
              headerShadowVisible: false,
              headerTintColor: PALETTE.accent,
              headerTitleStyle: { color: PALETTE.text, fontWeight: '600' },
              contentStyle: { backgroundColor: PALETTE.background },
              headerBackButtonDisplayMode: 'minimal',
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Home' }} />
            <Stack.Screen name="entry/[id]" options={{ title: 'Entry' }} />
            <Stack.Screen name="settings" options={{ title: 'Settings' }} />
            <Stack.Screen name="brain" options={{ title: 'On-phone brain' }} />
          </Stack>
        </JournalProvider>
      </KeysProvider>
    </ThemeProvider>
  );
}
