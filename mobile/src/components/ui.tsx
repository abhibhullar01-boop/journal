import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { InsightKind, KIND_LABEL } from '../brain';
import { IconName, KIND_COLOR, RADIUS, SCREEN_PADDING, SPACE, tint, TYPE, usePalette } from './theme';

/** A white card with a hairline edge. */
export function Card({ children, style, flush }: { children: ReactNode; style?: StyleProp<ViewStyle>; flush?: boolean }) {
  const p = usePalette();
  return (
    <View style={[styles.card, { backgroundColor: p.card, borderColor: p.hairline }, flush && styles.flush, style]}>{children}</View>
  );
}

/** The small capitals label above a group, with an optional action on the right ("See all"). */
export function SectionTitle({ children, action, onAction, count }: { children: ReactNode; action?: string; onAction?: () => void; count?: number }) {
  const p = usePalette();
  return (
    <View style={styles.sectionRow}>
      <Text style={[TYPE.label, { color: p.secondary }]}>
        {children}
        {count !== undefined ? <Text style={{ color: p.tertiary }}>{`  ${count}`}</Text> : null}
      </Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={10}>
          <Text style={[TYPE.footnote, { color: p.accent, fontWeight: '600' }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** A section: a label and a card. */
export function Section({
  title,
  count,
  action,
  onAction,
  children,
  flush,
}: {
  title: string;
  count?: number;
  action?: string;
  onAction?: () => void;
  children: ReactNode;
  flush?: boolean;
}) {
  return (
    <View style={styles.section}>
      <SectionTitle action={action} onAction={onAction} count={count}>
        {title}
      </SectionTitle>
      <Card flush={flush}>{children}</Card>
    </View>
  );
}

/** The big serif title at the top of a tab, with the date or a status under it. */
export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + SPACE.m }]}>
      <View style={{ flex: 1 }}>
        <Text style={[TYPE.largeTitle, { color: p.text }]} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={[TYPE.subhead, { color: p.secondary, marginTop: 2 }]}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.headerRight}>{right}</View> : null}
    </View>
  );
}

/** A round icon button for headers and toolbars. */
export function IconButton({
  icon,
  onPress,
  label,
  color,
  size = 22,
  filled,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  color?: string;
  size?: number;
  filled?: boolean;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityLabel={label}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.iconButton,
        filled && { backgroundColor: p.card, borderColor: p.hairline, borderWidth: StyleSheet.hairlineWidth },
        pressed && { backgroundColor: p.sunken },
      ]}
    >
      <Ionicons name={icon} size={size} color={color ?? p.text} />
    </Pressable>
  );
}

/** A small coloured dot that stands for a list. */
export function KindDot({ kind, size = 8 }: { kind: InsightKind; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: KIND_COLOR[kind] }} />;
}

/** "● Task", tappable to change the list. */
export function KindBadge({ kind, onPress, label }: { kind: InsightKind; onPress?: () => void; label?: string }) {
  const color = KIND_COLOR[kind];
  const body = (
    <View style={[styles.badge, { backgroundColor: tint(color, 0.09) }]}>
      <KindDot kind={kind} size={6} />
      <Text style={[styles.badgeText, { color }]}>{label ?? KIND_LABEL[kind]}</Text>
      {onPress ? <Ionicons name="chevron-down" size={11} color={color} /> : null}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} hitSlop={6} accessibilityLabel={`${KIND_LABEL[kind]}. Change list`}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'quiet';

export function Button({
  title,
  icon,
  onPress,
  variant = 'primary',
  disabled,
  compact,
  style,
}: {
  title: string;
  icon?: IconName;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const p = usePalette();
  const colors = {
    primary: { bg: p.accent, fg: '#FFFFFF', border: p.accent },
    secondary: { bg: p.card, fg: p.text, border: p.border },
    quiet: { bg: 'transparent', fg: p.accent, border: 'transparent' },
  }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: colors.bg, borderColor: colors.border },
        disabled && { opacity: 0.45 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={compact ? 16 : 18} color={colors.fg} /> : null}
      <Text style={[compact ? TYPE.subhead : TYPE.callout, { color: colors.fg, fontWeight: '600' }]}>{title}</Text>
    </Pressable>
  );
}

/** A thin progress track. */
export function ProgressBar({ value, color, track, height = 6 }: { value: number; color: string; track?: string; height?: number }) {
  const p = usePalette();
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: track ?? p.sunken, overflow: 'hidden' }}>
      <View style={{ width: `${pct}%`, height, borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

/** iOS-style segmented control. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; badge?: number }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const p = usePalette();
  return (
    <View style={[styles.segments, { backgroundColor: p.sunken }]} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && [styles.segmentActive, { backgroundColor: p.card }]]}
          >
            <Text style={[TYPE.subhead, { color: active ? p.text : p.secondary, fontWeight: active ? '600' : '500' }]} numberOfLines={1}>
              {o.label}
              {o.badge ? <Text style={{ color: active ? p.secondary : p.tertiary, fontWeight: '500' }}>{` ${o.badge}`}</Text> : null}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A plain row inside a card: icon, text, and something on the right. */
export function Row({
  icon,
  iconColor,
  title,
  subtitle,
  right,
  onPress,
  last,
  destructive,
}: {
  icon?: IconName;
  iconColor?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  last?: boolean;
  destructive?: boolean;
}) {
  const p = usePalette();
  const body = (
    <View style={[styles.row, !last && { borderBottomColor: p.hairline, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      {icon ? <Ionicons name={icon} size={20} color={iconColor ?? (destructive ? p.danger : p.secondary)} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={[TYPE.body, { color: destructive ? p.danger : p.text }]}>{title}</Text>
        {subtitle ? <Text style={[TYPE.footnote, { color: p.secondary, marginTop: 1 }]}>{subtitle}</Text> : null}
      </View>
      {right}
      {onPress && !right ? <Ionicons name="chevron-forward" size={16} color={p.tertiary} /> : null}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.6 }} accessibilityRole="button">
      {body}
    </Pressable>
  ) : (
    body
  );
}

export function EmptyState({ icon, title, message, children }: { icon: IconName; title: string; message: string; children?: ReactNode }) {
  const p = usePalette();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: p.sunken }]}>
        <Ionicons name={icon} size={24} color={p.secondary} />
      </View>
      <Text style={[TYPE.headline, { color: p.text, textAlign: 'center' }]}>{title}</Text>
      <Text style={[TYPE.callout, { color: p.secondary, textAlign: 'center' }]}>{message}</Text>
      {children}
    </View>
  );
}

/** Fine print under a section. */
export function Footnote({ children }: { children: ReactNode }) {
  const p = usePalette();
  return <Text style={[TYPE.footnote, styles.footnote, { color: p.secondary }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.l,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SPACE.l,
    paddingVertical: SPACE.s,
    marginHorizontal: SCREEN_PADDING,
  },
  flush: { paddingHorizontal: 0, paddingVertical: 0, overflow: 'hidden' },
  section: { marginTop: SPACE.xxl },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginHorizontal: SCREEN_PADDING + 4,
    marginBottom: SPACE.s,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: SCREEN_PADDING, paddingBottom: SPACE.s },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  iconButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  button: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonCompact: { paddingHorizontal: 14, paddingVertical: 8 },
  segments: { flexDirection: 'row', borderRadius: 11, padding: 3, marginHorizontal: SCREEN_PADDING },
  segment: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  segmentActive: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.m, paddingVertical: 13, minHeight: 50 },
  empty: { alignItems: 'center', paddingHorizontal: 40, paddingTop: 56, paddingBottom: 24, gap: SPACE.s },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  footnote: { marginHorizontal: SCREEN_PADDING + 4, marginTop: SPACE.s },
});
