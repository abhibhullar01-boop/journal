import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { InsightKind, KIND_LABEL } from '../brain';
import { IconName, KIND_COLOR, KIND_ICON, usePalette } from './theme';

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const p = usePalette();
  return <View style={[styles.card, { backgroundColor: p.card }, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  const p = usePalette();
  return <Text style={[styles.sectionTitle, { color: p.secondary }]}>{children}</Text>;
}

export function KindBadge({ kind, count, onPress }: { kind: InsightKind; count?: number; onPress?: () => void }) {
  const color = KIND_COLOR[kind];
  const body = (
    <View style={[styles.badge, { backgroundColor: `${color}22` }]}>
      <Ionicons name={KIND_ICON[kind]} size={13} color={color} />
      <Text style={[styles.badgeText, { color }]}>{count ?? KIND_LABEL[kind]}</Text>
    </View>
  );
  return onPress ? <Pressable onPress={onPress} hitSlop={6}>{body}</Pressable> : body;
}

export function BigButton({
  title,
  icon,
  onPress,
  filled = true,
}: {
  title: string;
  icon: IconName;
  onPress: () => void;
  filled?: boolean;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.bigButton,
        filled ? { backgroundColor: p.accent } : { backgroundColor: p.card, borderColor: p.accent, borderWidth: 1.5 },
        pressed && { opacity: 0.75 },
      ]}
    >
      <Ionicons name={icon} size={20} color={filled ? '#fff' : p.accent} />
      <Text style={[styles.bigButtonText, { color: filled ? '#fff' : p.accent }]}>{title}</Text>
    </Pressable>
  );
}

export function EmptyState({ icon, title, message }: { icon: IconName; title: string; message: string }) {
  const p = usePalette();
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={44} color={p.secondary} />
      <Text style={[styles.emptyTitle, { color: p.text }]}>{title}</Text>
      <Text style={[styles.emptyMessage, { color: p.secondary }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, padding: 14, marginHorizontal: 16, marginBottom: 10 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginHorizontal: 20,
    marginTop: 18,
    marginBottom: 8,
  },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  bigButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 14,
  },
  bigButtonText: { fontSize: 17, fontWeight: '600' },
  empty: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 80, gap: 10 },
  emptyTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  emptyMessage: { fontSize: 15, textAlign: 'center', lineHeight: 21 },
});
