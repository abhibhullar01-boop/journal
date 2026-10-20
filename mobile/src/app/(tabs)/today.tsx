import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KIND_PLURAL, TRACKABLE_KINDS } from '../../brain';
import { ItemRow } from '../../components/ItemRow';
import { KIND_COLOR, KIND_ICON, usePalette } from '../../components/theme';
import { Card, SectionTitle } from '../../components/ui';
import { clockLabel } from '../../store/format';
import { useJournal } from '../../store/JournalContext';

function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 5) return 'Still up?';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** A glance at the day: what's due, what to buy, how the week went, and today's notes. */
export default function TodayScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { entries, items } = useJournal();
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const tasks = items.filter((i) => i.kind === 'task');
  const dueToday = tasks
    .filter((i) => i.dueDate && new Date(i.dueDate) <= endOfToday && (!i.done || (i.completedAt && new Date(i.completedAt) >= startOfToday)))
    .sort((a, b) => Number(a.done) - Number(b.done) || (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
  const doneToday = dueToday.filter((i) => i.done).length;
  const otherOpen = tasks.filter((i) => !i.done && !dueToday.includes(i));
  const toBuy = items.filter((i) => i.kind === 'shopping' && !i.done);
  const growing = items.filter((i) => (i.kind === 'skill' || i.kind === 'goal') && !i.done);
  const todaysNotes = entries.filter((e) => new Date(e.createdAt) >= startOfToday);

  // The last 7 days: how many notes and how many things done each day.
  const week = Array.from({ length: 7 }, (_, k) => {
    const day = new Date(startOfToday);
    day.setDate(day.getDate() - (6 - k));
    const next = new Date(day);
    next.setDate(day.getDate() + 1);
    const inDay = (iso: string | null) => !!iso && new Date(iso) >= day && new Date(iso) < next;
    return {
      letter: DAY_LETTERS[day.getDay()],
      notes: entries.filter((e) => inDay(e.createdAt)).length,
      done: items.filter((i) => i.done && inDay(i.completedAt)).length,
      today: k === 6,
    };
  });
  const peak = Math.max(1, ...week.map((d) => d.notes + d.done));
  const weekDone = week.reduce((n, d) => n + d.done, 0);
  const weekNotes = week.reduce((n, d) => n + d.notes, 0);

  return (
    <ScrollView style={{ backgroundColor: p.background }} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.hello, { color: p.text }]}>{greeting(now)}</Text>
          <Text style={[styles.date, { color: p.secondary }]}>
            {now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
        </View>
        <Pressable onPress={() => router.push('/settings')} hitSlop={12} accessibilityLabel="Settings" style={styles.gear}>
          <Ionicons name="settings-outline" size={24} color={p.secondary} />
        </Pressable>
      </View>

      {/* Progress for today */}
      <View style={[styles.hero, { backgroundColor: p.accent }]}>
        <View style={styles.heroDecor1} />
        <View style={styles.heroDecor2} />
        <Text style={styles.heroLabel}>TODAY</Text>
        <Text style={styles.heroBig}>
          {dueToday.length ? `${doneToday} of ${dueToday.length} done` : todaysNotes.length ? 'Nothing due today' : 'A fresh day'}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${dueToday.length ? (doneToday / dueToday.length) * 100 : todaysNotes.length ? 100 : 4}%` }]} />
        </View>
        <View style={styles.heroButtons}>
          <Pressable
            onPress={() => router.navigate({ pathname: '/', params: { record: '1' } })}
            style={({ pressed }) => [styles.heroButton, pressed && { opacity: 0.85 }]}
            accessibilityLabel="Talk"
          >
            <Ionicons name="mic" size={18} color={p.accent} />
            <Text style={[styles.heroButtonText, { color: p.accent }]}>Talk to me</Text>
          </Pressable>
          <Pressable onPress={() => router.navigate('/')} style={({ pressed }) => [styles.heroGhost, pressed && { opacity: 0.85 }]}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color="#fff" />
            <Text style={styles.heroGhostText}>Open chat</Text>
          </Pressable>
        </View>
      </View>

      {/* One tile per list */}
      <View style={styles.tiles}>
        {TRACKABLE_KINDS.map((kind) => {
          const n = items.filter((i) => i.kind === kind && !i.done).length;
          return (
            <Pressable
              key={kind}
              onPress={() => router.navigate({ pathname: '/lists', params: { kind } })}
              style={({ pressed }) => [styles.tile, { backgroundColor: p.card, shadowColor: p.shadow }, pressed && { opacity: 0.8 }]}
            >
              <View style={[styles.tileIcon, { backgroundColor: `${KIND_COLOR[kind]}1A` }]}>
                <Ionicons name={KIND_ICON[kind]} size={20} color={KIND_COLOR[kind]} />
              </View>
              <Text style={[styles.tileCount, { color: p.text }]}>{n}</Text>
              <Text style={[styles.tileName, { color: p.secondary }]}>{kind === 'shopping' ? 'To buy' : KIND_PLURAL[kind]}</Text>
            </Pressable>
          );
        })}
      </View>

      <SectionTitle>Due today</SectionTitle>
      <Card>
        {dueToday.length ? (
          dueToday.map((item) => <ItemRow key={item.id} item={item} />)
        ) : (
          <Text style={[styles.quiet, { color: p.secondary }]}>
            {otherOpen.length ? `Nothing due today. ${otherOpen.length} other task${otherOpen.length === 1 ? '' : 's'} waiting in Lists.` : 'Nothing due today.'}
          </Text>
        )}
      </Card>

      {toBuy.length ? (
        <>
          <SectionTitle>To buy</SectionTitle>
          <Pressable onPress={() => router.navigate({ pathname: '/lists', params: { kind: 'shopping' } })}>
            <Card style={styles.chips}>
              {toBuy.slice(0, 12).map((i) => (
                <View key={i.id} style={[styles.chip, { backgroundColor: `${KIND_COLOR.shopping}16` }]}>
                  <Ionicons name="cart-outline" size={13} color={KIND_COLOR.shopping} />
                  <Text style={[styles.chipText, { color: KIND_COLOR.shopping }]}>{i.title}</Text>
                </View>
              ))}
              {toBuy.length > 12 ? <Text style={{ color: p.secondary, alignSelf: 'center' }}>+{toBuy.length - 12} more</Text> : null}
            </Card>
          </Pressable>
        </>
      ) : null}

      <SectionTitle>Your week</SectionTitle>
      <Card>
        <View style={styles.chart}>
          {week.map((d, i) => (
            <View key={i} style={styles.chartCol}>
              <View style={styles.chartBarBox}>
                <View style={[styles.chartBar, { height: `${(d.done / peak) * 100}%`, backgroundColor: KIND_COLOR.goal }]} />
                <View style={[styles.chartBar, { height: `${(d.notes / peak) * 100}%`, backgroundColor: d.today ? p.accent : `${p.accent}66` }]} />
              </View>
              <Text style={[styles.chartLabel, { color: d.today ? p.text : p.secondary, fontWeight: d.today ? '800' : '500' }]}>{d.letter}</Text>
            </View>
          ))}
        </View>
        <View style={styles.legend}>
          <View style={[styles.legendDot, { backgroundColor: p.accent }]} />
          <Text style={[styles.legendText, { color: p.secondary }]}>{weekNotes} notes</Text>
          <View style={[styles.legendDot, { backgroundColor: KIND_COLOR.goal, marginLeft: 12 }]} />
          <Text style={[styles.legendText, { color: p.secondary }]}>{weekDone} done</Text>
        </View>
      </Card>

      {growing.length ? (
        <>
          <SectionTitle>Skills and goals</SectionTitle>
          <Card style={styles.chips}>
            {growing.slice(0, 10).map((i) => (
              <Pressable
                key={i.id}
                onPress={() => router.navigate({ pathname: '/', params: { ask: `How am I doing with "${i.title}"? Give me one small next step.` } })}
                style={[styles.chip, { backgroundColor: `${KIND_COLOR[i.kind]}16` }]}
              >
                <Ionicons name={KIND_ICON[i.kind]} size={13} color={KIND_COLOR[i.kind]} />
                <Text style={[styles.chipText, { color: KIND_COLOR[i.kind] }]}>{i.title}</Text>
              </Pressable>
            ))}
          </Card>
        </>
      ) : null}

      <SectionTitle>Today's notes</SectionTitle>
      <Card>
        {todaysNotes.length ? (
          todaysNotes.slice(0, 15).map((e) => (
            <Pressable key={e.id} onPress={() => router.push(`/entry/${e.id}`)} style={[styles.note, { borderBottomColor: p.border }]}>
              <Text style={[styles.noteTime, { color: p.secondary }]}>{clockLabel(e.createdAt)}</Text>
              <Text style={[styles.noteText, { color: p.text }]} numberOfLines={2}>
                {e.text}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={p.border} />
            </Pressable>
          ))
        ) : (
          <Text style={[styles.quiet, { color: p.secondary }]}>Nothing yet today. Anything you say in Chat lands here.</Text>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingBottom: 10 },
  hello: { fontSize: 30, fontWeight: '800' },
  date: { fontSize: 15, marginTop: 2 },
  gear: { padding: 4 },
  hero: { marginHorizontal: 16, borderRadius: 24, padding: 20, overflow: 'hidden' },
  heroDecor1: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: '#ffffff14', right: -50, top: -70 },
  heroDecor2: { position: 'absolute', width: 90, height: 90, borderRadius: 45, backgroundColor: '#ffffff10', right: 60, bottom: -40 },
  heroLabel: { color: '#ffffffcc', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  heroBig: { color: '#fff', fontSize: 26, fontWeight: '800', marginTop: 4 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: '#ffffff33', marginTop: 12, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: '#fff' },
  heroButtons: { flexDirection: 'row', gap: 10, marginTop: 16 },
  heroButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  heroButtonText: { fontSize: 15, fontWeight: '700' },
  heroGhost: { flexDirection: 'row', alignItems: 'center', gap: 6, borderColor: '#ffffff88', borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  heroGhostText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  tiles: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 12 },
  tile: { flex: 1, borderRadius: 16, paddingVertical: 12, alignItems: 'center', gap: 4, shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  tileIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  tileCount: { fontSize: 20, fontWeight: '800' },
  tileName: { fontSize: 11, fontWeight: '700' },
  quiet: { fontSize: 15, lineHeight: 21 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 14, fontWeight: '600' },
  chart: { flexDirection: 'row', justifyContent: 'space-between', height: 110, alignItems: 'flex-end' },
  chartCol: { alignItems: 'center', flex: 1, gap: 6 },
  chartBarBox: { height: 86, flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  chartBar: { width: 9, borderRadius: 5, minHeight: 3 },
  chartLabel: { fontSize: 12 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 13 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  noteTime: { fontSize: 12, width: 58 },
  noteText: { flex: 1, fontSize: 15, lineHeight: 20 },
});
