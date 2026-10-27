import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { endOfDay, useNow } from '../../components/clock';
import { useWide } from '../../components/layout';
import { usePalette } from '../../components/theme';
import { useJournal } from '../../store/JournalContext';

export default function TabsLayout() {
  const p = usePalette();
  const { items } = useJournal();
  const now = useNow(5 * 60_000);
  // A wide browser window has the sidebar instead of the tab bar.
  const wide = useWide();
  const insets = useSafeAreaInsets();
  // The badge counts what needs you today (due or overdue), not every open item.
  const end = endOfDay(now).getTime();
  const due = items.filter((i) => !i.done && i.dueDate && (i.kind === 'task' || i.kind === 'shopping') && new Date(i.dueDate).getTime() <= end).length;

  return (
    <Tabs
      tabBar={wide ? () => null : undefined}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: p.accent,
        tabBarInactiveTintColor: p.tertiary,
        tabBarStyle: {
          backgroundColor: p.background,
          borderTopColor: p.border,
          // In a phone's browser the icons sit a little taller than in the app, so give the labels room.
          ...(Platform.OS === 'web' ? { height: 56 + insets.bottom } : null),
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarBadgeStyle: { backgroundColor: p.danger, color: '#fff', fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: p.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'} color={color as string} size={size - 1} />
          ),
        }}
      />
      <Tabs.Screen
        name="today"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'today' : 'today-outline'} color={color as string} size={size - 1} />,
        }}
      />
      <Tabs.Screen
        name="lists"
        options={{
          title: 'Lists',
          tabBarBadge: due > 0 ? due : undefined,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'checkmark-circle' : 'checkmark-circle-outline'} color={color as string} size={size - 1} />
          ),
        }}
      />
    </Tabs>
  );
}
