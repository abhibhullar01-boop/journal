import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { useColorScheme } from 'react-native';
import { JournalProvider, useJournal } from '../store/JournalContext';
import { MARK_DONE, setUpNotifications, SNOOZE } from '../store/reminders';

/** Handles taps on reminder notifications: Mark done, snooze, or open the tracker. */
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
      router.navigate('/tracker');
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

export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <JournalProvider>
        <NotificationBridge />
        <StatusBar style="auto" />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="capture" options={{ presentation: 'modal', title: 'New entry' }} />
          <Stack.Screen name="entry/[id]" options={{ title: 'Entry' }} />
        </Stack>
      </JournalProvider>
    </ThemeProvider>
  );
}
