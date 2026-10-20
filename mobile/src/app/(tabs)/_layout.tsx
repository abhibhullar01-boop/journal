import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import { usePalette } from '../../components/theme';
import { useJournal } from '../../store/JournalContext';

export default function TabsLayout() {
  const p = usePalette();
  const { items } = useJournal();
  const openTasks = items.filter((i) => i.kind === 'task' && !i.done).length;

  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: p.accent }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Journal',
          tabBarIcon: ({ color, size }) => <Ionicons name="book-outline" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="tracker"
        options={{
          title: 'Tracker',
          tabBarBadge: openTasks > 0 ? openTasks : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="checkbox-outline" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="brain"
        options={{
          title: 'Brain',
          tabBarIcon: ({ color, size }) => <Ionicons name="bulb-outline" color={color as string} size={size} />,
        }}
      />
    </Tabs>
  );
}
