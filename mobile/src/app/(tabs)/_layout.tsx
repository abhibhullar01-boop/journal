import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import { usePalette } from '../../components/theme';
import { useJournal } from '../../store/JournalContext';

export default function TabsLayout() {
  const p = usePalette();
  const { items } = useJournal();
  const open = items.filter((i) => (i.kind === 'task' || i.kind === 'shopping') && !i.done).length;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: p.accent,
        tabBarInactiveTintColor: p.secondary,
        tabBarStyle: { backgroundColor: p.card, borderTopColor: p.border },
        headerStyle: { backgroundColor: p.background },
        headerShadowVisible: false,
        headerTitleStyle: { color: p.text, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="sunny-outline" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="lists"
        options={{
          title: 'Lists',
          tabBarBadge: open > 0 ? open : undefined,
          tabBarBadgeStyle: { backgroundColor: p.danger },
          tabBarIcon: ({ color, size }) => <Ionicons name="checkbox-outline" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Companion',
          tabBarLabel: 'Chat',
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles-outline" color={color as string} size={size} />,
        }}
      />
    </Tabs>
  );
}
