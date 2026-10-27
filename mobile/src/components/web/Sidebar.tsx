import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useJournal } from '../../store/JournalContext';
import { endOfDay, useNow } from '../clock';
import { COLUMN_WIDTH, useWide } from '../layout';
import { IconName, RADIUS, SERIF, SPACE, TYPE, usePalette } from '../theme';
import { OTHER_PROJECTS } from './projects';

type Hover = { pressed: boolean; hovered?: boolean };

const SIDEBAR_BG = '#F0EDE6';

/** On a wide browser window: a sidebar on the left and the screen in a centred column. */
export function WebShell({ children }: { children: ReactNode }) {
  const p = usePalette();
  const wide = useWide();
  if (!wide) return <>{children}</>;
  return (
    <View style={styles.shell}>
      <Sidebar />
      <View style={[styles.main, { backgroundColor: p.background }]}>
        <View style={styles.column}>{children}</View>
      </View>
    </View>
  );
}

function NavItem({ icon, activeIcon, label, active, badge, onPress }: { icon: IconName; activeIcon: IconName; label: string; active: boolean; badge?: number; onPress(): void }) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityState={{ selected: active }}
      style={({ pressed, hovered }: Hover) => [
        styles.item,
        active ? { backgroundColor: p.accentSoft } : (hovered || pressed) && { backgroundColor: 'rgba(28, 27, 24, 0.05)' },
      ]}
    >
      <Ionicons name={active ? activeIcon : icon} size={19} color={active ? p.accent : p.secondary} />
      <Text style={[TYPE.callout, { flex: 1, color: active ? p.accent : p.text, fontWeight: active ? '600' : '500' }]}>{label}</Text>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: p.danger }]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function Sidebar() {
  const p = usePalette();
  const path = usePathname();
  const { items } = useJournal();
  const now = useNow(5 * 60_000);
  const end = endOfDay(now).getTime();
  const due = items.filter((i) => !i.done && i.dueDate && (i.kind === 'task' || i.kind === 'shopping') && new Date(i.dueDate).getTime() <= end).length;
  const go = (to: '/' | '/today' | '/lists' | '/settings' | '/brain') => router.navigate(to);

  return (
    <View style={[styles.sidebar, { backgroundColor: SIDEBAR_BG, borderRightColor: p.border }]} role="navigation">
      <View style={styles.brand}>
        <View style={[styles.logo, { backgroundColor: p.accent }]}>
          <Ionicons name="book-outline" size={17} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.brandName, { color: p.text }]}>Journal</Text>
          <Text style={[TYPE.caption, { color: p.tertiary }]}>Your companion</Text>
        </View>
      </View>

      <Pressable
        onPress={() => router.navigate({ pathname: '/', params: { record: '1' } })}
        style={({ pressed, hovered }: Hover) => [styles.talk, { backgroundColor: p.accent }, (pressed || hovered) && { opacity: 0.88 }]}
        accessibilityRole="button"
      >
        <Ionicons name="mic" size={17} color="#FFFFFF" />
        <Text style={[TYPE.callout, { color: '#FFFFFF', fontWeight: '600' }]}>Talk</Text>
      </Pressable>

      <View style={styles.group}>
        <NavItem icon="chatbubble-ellipses-outline" activeIcon="chatbubble-ellipses" label="Chat" active={path === '/'} onPress={() => go('/')} />
        <NavItem icon="today-outline" activeIcon="today" label="Today" active={path === '/today'} onPress={() => go('/today')} />
        <NavItem icon="checkmark-circle-outline" activeIcon="checkmark-circle" label="Lists" badge={due || undefined} active={path === '/lists'} onPress={() => go('/lists')} />
      </View>
      <View style={styles.group}>
        <NavItem icon="settings-outline" activeIcon="settings" label="Settings" active={path === '/settings'} onPress={() => go('/settings')} />
        <NavItem icon="hardware-chip-outline" activeIcon="hardware-chip" label="Built-in brain" active={path === '/brain'} onPress={() => go('/brain')} />
      </View>

      <View style={{ flex: 1 }} />

      <View style={[styles.projects, { borderTopColor: p.border }]}>
        <Text style={[TYPE.label, styles.projectsLabel, { color: p.tertiary }]}>Your projects</Text>
        <View style={[styles.item, { backgroundColor: 'rgba(28, 27, 24, 0.04)' }]}>
          <Ionicons name="book" size={17} color={p.accent} />
          <Text style={[TYPE.subhead, { flex: 1, color: p.text, fontWeight: '600' }]}>Journal</Text>
          <Text style={[TYPE.caption, { color: p.tertiary }]}>Here</Text>
        </View>
        {OTHER_PROJECTS.map((project) => (
          <Pressable
            key={project.url}
            onPress={() => Linking.openURL(project.url).catch(() => {})}
            accessibilityRole="link"
            accessibilityHint="Opens in a new tab"
            style={({ pressed, hovered }: Hover) => [styles.item, (hovered || pressed) && { backgroundColor: 'rgba(28, 27, 24, 0.05)' }]}
          >
            <Ionicons name={project.icon} size={17} color={p.secondary} />
            <View style={{ flex: 1 }}>
              <Text style={[TYPE.subhead, { color: p.text }]}>{project.name}</Text>
              <Text style={[TYPE.caption, { color: p.tertiary }]}>{project.note}</Text>
            </View>
            <Ionicons name="open-outline" size={14} color={p.tertiary} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, flexDirection: 'row' },
  sidebar: { width: 252, borderRightWidth: StyleSheet.hairlineWidth, paddingHorizontal: SPACE.m, paddingTop: SPACE.xl, paddingBottom: SPACE.l },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: SPACE.s, marginBottom: SPACE.xl },
  logo: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontFamily: SERIF, fontSize: 20, lineHeight: 24, fontWeight: '700' },
  talk: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: RADIUS.pill, paddingVertical: 10, marginBottom: SPACE.l },
  group: { gap: 2, marginBottom: SPACE.l },
  item: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 10, paddingVertical: 8, borderRadius: RADIUS.s + 2 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  projects: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: SPACE.m, gap: 2 },
  projectsLabel: { paddingHorizontal: 10, marginBottom: 6 },
  main: { flex: 1, alignItems: 'center' },
  column: { flex: 1, width: '100%', maxWidth: COLUMN_WIDTH },
});
