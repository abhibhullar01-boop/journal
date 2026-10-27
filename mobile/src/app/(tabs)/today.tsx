import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ItemRow } from '../../components/ItemRow';
import { endOfDay, greeting, startOfDay, useNow } from '../../components/clock';
import { KIND_COLOR, KIND_ICON, RADIUS, SERIF, SPACE, tint, TYPE, usePalette } from '../../components/theme';
import { Button, Card, IconButton, ProgressBar, ScreenHeader, Section } from '../../components/ui';
import { clockLabel } from '../../store/format';
import { useJournal } from '../../store/JournalContext';
import type { TrackedItem } from '../../store/types';

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const byDue = (a: TrackedItem, b: TrackedItem) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '');

/** A glance at the day: what's due, what's coming, what to buy, how the week went, and today's notes. */
export default function TodayScreen() {
  const p = usePalette();
  const { entries, items } = useJournal();
  const now = useNow();

  const day = useMemo(() => {
    const start = startOfDay(now);
    const end = endOfDay(now);
    const weekAhead = new Date(end);
    weekAhead.setDate(weekAhead.getDate() + 7);
    const timed = items.filter((i) => (i.kind === 'task' || i.kind === 'shopping') && i.dueDate);
    // Due today: everything still open up to tonight (overdue included), and what was ticked off today.
    const dueToday = timed
      .filter((i) => new Date(i.dueDate!) <= end && (!i.done || (!!i.completedAt && new Date(i.completedAt) >= start)))
      .sort((a, b) => Number(a.done) - Number(b.done) || byDue(a, b));
    const open = dueToday.filter((i) => !i.done);
    const next = open.find((i) => new Date(i.dueDate!) >= now) ?? null;
    const overdue = open.filter((i) => new Date(i.dueDate!) < now).length;
    const comingUp = timed.filter((i) => !i.done && new Date(i.dueDate!) > end && new Date(i.dueDate!) <= weekAhead).sort(byDue);
    const undated = items.filter((i) => i.kind === 'task' && !i.done && !i.dueDate).length;
    const toBuy = items.filter((i) => i.kind === 'shopping' && !i.done).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const growing = items.filter((i) => (i.kind === 'skill' || i.kind === 'goal') && !i.done);
    const notes = entries.filter((e) => new Date(e.createdAt) >= start);

    // The last seven days: notes written and things done each day.
    const week = Array.from({ length: 7 }, (_, k) => {
      const from = new Date(start);
      from.setDate(from.getDate() - (6 - k));
      const to = new Date(from);
      to.setDate(from.getDate() + 1);
      const inDay = (iso: string | null) => !!iso && new Date(iso) >= from && new Date(iso) < to;
      return {
        letter: DAY_LETTERS[from.getDay()],
        notes: entries.filter((e) => inDay(e.createdAt)).length,
        done: items.filter((i) => i.done && inDay(i.completedAt)).length,
        today: k === 6,
      };
    });
    // Days in a row with at least one note, counting back from today (or yesterday, early in the day).
    const days = new Set(entries.map((e) => new Date(e.createdAt).toDateString()));
    let streak = 0;
    const cursor = new Date(start);
    if (!days.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1);
    while (days.has(cursor.toDateString())) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return { dueToday, open, next, overdue, comingUp, undated, toBuy, growing, notes, week, streak };
  }, [entries, items, now]);

  const { dueToday, open, next, overdue, comingUp, undated, toBuy, growing, notes, week, streak } = day;
  const doneCount = dueToday.length - open.length;
  const evening = now.getHours() >= 17 || now.getHours() < 4;
  const headline = dueToday.length
    ? open.length
      ? `${open.length} ${open.length === 1 ? 'thing' : 'things'} left today`
      : 'All done for today'
    : notes.length
      ? 'Nothing due today'
      : 'A fresh day';
  const peak = Math.max(1, ...week.map((d) => Math.max(d.notes, d.done)));
  const weekNotes = week.reduce((n, d) => n + d.notes, 0);
  const weekDone = week.reduce((n, d) => n + d.done, 0);

  return (
    <ScrollView style={{ backgroundColor: p.background }} contentContainerStyle={styles.content}>
      <ScreenHeader
        title={greeting(now)}
        subtitle={now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
        right={<IconButton icon="settings-outline" label="Settings" color={p.secondary} onPress={() => router.push('/settings')} />}
      />

      <Card style={styles.summary}>
        <View style={styles.summaryTop}>
          <Text style={[TYPE.label, { color: p.tertiary }]}>Today</Text>
          {dueToday.length ? (
            <Text style={[TYPE.footnote, { color: p.secondary }]}>
              {doneCount} of {dueToday.length} done
            </Text>
          ) : null}
        </View>
        <Text style={[styles.headline, { color: p.text }]}>{headline}</Text>
        {dueToday.length ? <ProgressBar value={doneCount / dueToday.length} color={p.accent} /> : null}
        {next || overdue ? (
          <View style={styles.nextRow}>
            <Ionicons name={overdue ? 'alarm-outline' : 'time-outline'} size={15} color={overdue ? p.danger : p.secondary} />
            <Text style={[TYPE.subhead, { color: p.secondary, flex: 1 }]} numberOfLines={2}>
              {overdue ? <Text style={{ color: p.danger, fontWeight: '600' }}>{`${overdue} overdue`}</Text> : null}
              {overdue && next ? '  ·  ' : ''}
              {next ? (
                <>
                  Next: <Text style={{ color: p.text, fontWeight: '600' }}>{next.title}</Text> at {clockLabel(next.dueDate!)}
                </>
              ) : null}
            </Text>
          </View>
        ) : null}
        <View style={styles.buttons}>
          <Button compact icon="mic" title="Talk" onPress={() => router.navigate({ pathname: '/', params: { record: '1' } })} />
          <Button
            compact
            variant="secondary"
            icon={evening ? 'moon-outline' : 'sunny-outline'}
            title={evening ? 'Wrap up my day' : 'Plan my day'}
            onPress={() => router.navigate({ pathname: '/', params: { ask: evening ? 'Help me wrap up the day' : 'Plan my day' } })}
          />
        </View>
      </Card>

      <Section title="Due today" count={open.length || undefined}>
        {dueToday.length ? (
          dueToday.map((item, k) => <ItemRow key={item.id} item={item} last={k === dueToday.length - 1} />)
        ) : (
          <Pressable onPress={() => router.navigate({ pathname: '/lists', params: { kind: 'task' } })} disabled={!undated} style={styles.quietBox}>
            <Text style={[TYPE.callout, { color: p.secondary }]}>
              Nothing due today.
              {undated ? <Text style={{ color: p.accent }}>{` ${undated} task${undated === 1 ? '' : 's'} without a date →`}</Text> : null}
            </Text>
          </Pressable>
        )}
      </Section>

      {comingUp.length ? (
        <Section title="Coming up" count={comingUp.length} action="All tasks" onAction={() => router.navigate({ pathname: '/lists', params: { kind: 'task' } })}>
          {comingUp.slice(0, 5).map((item, k, list) => (
            <ItemRow key={item.id} item={item} last={k === list.length - 1} />
          ))}
        </Section>
      ) : null}

      {toBuy.length ? (
        <Section
          title="To buy"
          count={toBuy.length}
          action={toBuy.length > 5 ? 'See all' : undefined}
          onAction={() => router.navigate({ pathname: '/lists', params: { kind: 'shopping' } })}
        >
          {toBuy.slice(0, 5).map((item, k, list) => (
            <ItemRow key={item.id} item={item} last={k === list.length - 1} />
          ))}
        </Section>
      ) : null}

      <Section title="This week">
        <View style={styles.chart} accessibilityLabel={`${weekNotes} notes and ${weekDone} things done this week`}>
          {week.map((d, k) => (
            <View key={k} style={styles.chartCol}>
              <View style={styles.chartBars}>
                <View style={[styles.bar, { height: `${(d.notes / peak) * 100}%`, backgroundColor: d.today ? p.accent : tint(p.accent, 0.45) }]} />
                <View style={[styles.bar, { height: `${(d.done / peak) * 100}%`, backgroundColor: d.today ? KIND_COLOR.task : tint(KIND_COLOR.task, 0.45) }]} />
              </View>
              <Text style={[TYPE.caption, { color: d.today ? p.text : p.tertiary, fontWeight: d.today ? '700' : '500' }]}>{d.letter}</Text>
            </View>
          ))}
        </View>
        <View style={[styles.legend, { borderTopColor: p.hairline }]}>
          <View style={[styles.legendDot, { backgroundColor: p.accent }]} />
          <Text style={[TYPE.footnote, { color: p.secondary }]}>{weekNotes} notes</Text>
          <View style={[styles.legendDot, { backgroundColor: KIND_COLOR.task, marginLeft: SPACE.m }]} />
          <Text style={[TYPE.footnote, { color: p.secondary }]}>{weekDone} done</Text>
          {streak >= 2 ? (
            <Text style={[TYPE.footnote, { color: p.accent, fontWeight: '600', marginLeft: 'auto' }]}>{streak} days in a row</Text>
          ) : null}
        </View>
      </Section>

      {growing.length ? (
        <Section
          title="Skills and goals"
          count={growing.length}
          action={growing.length > 4 ? 'See all' : undefined}
          onAction={() => router.navigate({ pathname: '/lists', params: { kind: 'goal' } })}
        >
          {growing.slice(0, 4).map((item, k, list) => (
            <Pressable
              key={item.id}
              onPress={() => router.navigate({ pathname: '/', params: { ask: `How am I doing with "${item.title}"? Give me one small next step.` } })}
              style={({ pressed }) => [styles.growRow, k < list.length - 1 && { borderBottomColor: p.hairline, borderBottomWidth: StyleSheet.hairlineWidth }, pressed && { opacity: 0.6 }]}
              accessibilityHint="Asks your companion for a next step"
            >
              <View style={[styles.growIcon, { backgroundColor: tint(KIND_COLOR[item.kind], 0.1) }]}>
                <Ionicons name={KIND_ICON[item.kind]} size={15} color={KIND_COLOR[item.kind]} />
              </View>
              <Text style={[TYPE.body, { color: p.text, flex: 1 }]} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={[TYPE.footnote, { color: p.accent, fontWeight: '600' }]}>Next step</Text>
            </Pressable>
          ))}
        </Section>
      ) : null}

      <Section title="Today's notes" count={notes.length || undefined}>
        {notes.length ? (
          notes.slice(0, 12).map((e, k, list) => (
            <Pressable
              key={e.id}
              onPress={() => router.push(`/entry/${e.id}`)}
              style={({ pressed }) => [styles.note, k < list.length - 1 && { borderBottomColor: p.hairline, borderBottomWidth: StyleSheet.hairlineWidth }, pressed && { opacity: 0.6 }]}
            >
              <Text style={[TYPE.caption, styles.noteTime, { color: p.tertiary }]}>{clockLabel(e.createdAt)}</Text>
              <Text style={[TYPE.callout, { color: p.text, flex: 1 }]} numberOfLines={2}>
                {e.text}
              </Text>
              <Ionicons name="chevron-forward" size={15} color={p.tertiary} />
            </Pressable>
          ))
        ) : (
          <View style={styles.quietBox}>
            <Text style={[TYPE.callout, { color: p.secondary }]}>Nothing yet today. Whatever you say in Chat lands here.</Text>
          </View>
        )}
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: SPACE.xxxl },
  summary: { marginTop: SPACE.m, paddingVertical: SPACE.l, gap: SPACE.s },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  headline: { fontFamily: SERIF, fontSize: 26, lineHeight: 32, fontWeight: '700' },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  buttons: { flexDirection: 'row', gap: SPACE.s, marginTop: SPACE.s },
  quietBox: { paddingVertical: SPACE.m },
  chart: { flexDirection: 'row', height: 112, alignItems: 'flex-end', paddingTop: SPACE.m },
  chartCol: { flex: 1, alignItems: 'center', gap: 6 },
  chartBars: { height: 80, flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  bar: { width: 8, borderRadius: 4, minHeight: 3 },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACE.m,
    paddingVertical: SPACE.m,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  growRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.m, paddingVertical: 12, minHeight: 52 },
  growIcon: { width: 30, height: 30, borderRadius: RADIUS.s, alignItems: 'center', justifyContent: 'center' },
  note: { flexDirection: 'row', alignItems: 'center', gap: SPACE.m, paddingVertical: 12 },
  noteTime: { width: 56 },
});
