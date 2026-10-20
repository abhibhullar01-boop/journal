import * as Notifications from 'expo-notifications';
import { KIND_LABEL } from '../brain';
import { formatDue } from './format';
import type { TrackedItem } from './types';

/**
 * Local notifications drawn from what you said:
 * - a reminder at the time a task mentioned ("tomorrow", "at 5 pm", "by Friday")
 * - a heads-up when something is saved
 * - a morning digest of open tasks and an evening nudge
 * - a Sunday evening check-in on a skill or goal
 */
export const TASK_CATEGORY = 'task-reminder';
export const MARK_DONE = 'mark-done';
export const SNOOZE = 'snooze-hour';
const DIGEST_ID = 'daily-digest';
const EVENING_ID = 'evening-wrap';
const CHECK_IN_ID = 'weekly-check-in';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function setUpNotifications(): Promise<void> {
  // Ask up front, so the first reminder isn't lost waiting for an answer.
  await ensurePermission().catch(() => false);
  try {
    await Notifications.setNotificationCategoryAsync(TASK_CATEGORY, [
      { identifier: MARK_DONE, buttonTitle: 'Mark done' },
      { identifier: SNOOZE, buttonTitle: 'Remind me in an hour' },
    ]);
  } catch {
    // Categories are a nice-to-have; reminders still work without the buttons.
  }
}

/** Asks once; later calls return the stored answer. */
export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/** Schedules a reminder for a dated, open task. Returns the notification id. */
export async function scheduleReminder(item: TrackedItem): Promise<string | null> {
  if ((item.kind !== 'task' && item.kind !== 'shopping') || item.done || !item.dueDate) return null;
  const date = new Date(item.dueDate);
  if (date.getTime() <= Date.now()) return null;
  if (!(await ensurePermission())) return null;
  return Notifications.scheduleNotificationAsync({
    content: {
      title: item.title,
      body: `From your journal: “${item.sentence}”`,
      sound: true,
      categoryIdentifier: TASK_CATEGORY,
      data: { itemId: item.id },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
  });
}

const KIND_LINE: Record<string, string> = { task: 'Task', shopping: 'To buy', skill: 'Skill', goal: 'Goal' };

/** A heads-up right away with what was saved from a message, and when the reminders will come. */
export async function notifySaved(items: TrackedItem[]): Promise<void> {
  if (!items.length || !(await Notifications.getPermissionsAsync()).granted) return;
  const lines: string[] = [];
  for (const kind of ['task', 'shopping', 'skill', 'goal']) {
    const ofKind = items.filter((i) => i.kind === kind);
    if (!ofKind.length) continue;
    if (kind === 'shopping') {
      lines.push(`${KIND_LINE[kind]}: ${ofKind.map((i) => i.title.toLowerCase()).join(', ')}`);
      continue;
    }
    for (const i of ofKind) lines.push(`${KIND_LINE[kind]}: ${i.title}${i.dueDate ? ` · 🔔 ${formatDue(i.dueDate)}` : ''}`);
  }
  const reminders = items.filter((i) => i.dueDate && new Date(i.dueDate).getTime() > Date.now()).length;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: reminders ? `Saved, with ${reminders === 1 ? 'a reminder' : `${reminders} reminders`}` : 'Saved to your lists',
      body: lines.join('\n'),
      sound: false,
      data: { kind: 'saved' },
    },
    trigger: null,
  });
}

export async function cancelReminder(notificationId: string | null): Promise<void> {
  if (notificationId) await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => {});
}

/** Rebuilds the repeating digest and check-in so their text matches the current data. */
export async function refreshDigests(items: TrackedItem[]): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(DIGEST_ID).catch(() => {});
  await Notifications.cancelScheduledNotificationAsync(CHECK_IN_ID).catch(() => {});
  await Notifications.cancelScheduledNotificationAsync(EVENING_ID).catch(() => {});
  if (!(await Notifications.getPermissionsAsync()).granted) return;

  const open = items.filter((i) => i.kind === 'task' && !i.done);
  const toBuy = items.filter((i) => i.kind === 'shopping' && !i.done);
  if (open.length || toBuy.length) {
    const parts = [
      open.length ? (open.length === 1 ? '1 open task' : `${open.length} open tasks`) : '',
      toBuy.length ? `${toBuy.length} to buy` : '',
    ].filter(Boolean);
    const body = [
      open.slice(0, 3).map((i) => i.title).join(' · '),
      toBuy.length ? `Buy: ${toBuy.slice(0, 5).map((i) => i.title.toLowerCase()).join(', ')}` : '',
    ].filter(Boolean).join('\n');
    await Notifications.scheduleNotificationAsync({
      identifier: DIGEST_ID,
      content: {
        title: parts.join(', '),
        body,
        sound: true,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 8, minute: 30 },
    });
  }

  // An evening nudge with what's still open, so nothing slips to tomorrow unnoticed.
  if (open.length) {
    await Notifications.scheduleNotificationAsync({
      identifier: EVENING_ID,
      content: {
        title: open.length === 1 ? 'One thing still open' : `${open.length} things still open`,
        body: `${open.slice(0, 3).map((i) => i.title).join(' · ')}\nTap to tick them off or tell me how the day went.`,
        sound: true,
        data: { kind: 'evening' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 20, minute: 30 },
    });
  }

  const growth = items.filter((i) => (i.kind === 'skill' || i.kind === 'goal') && !i.done);
  const pick = growth[Math.floor(Math.random() * growth.length)];
  if (pick) {
    await Notifications.scheduleNotificationAsync({
      identifier: CHECK_IN_ID,
      content: {
        title: `${KIND_LABEL[pick.kind]} check-in`,
        body:
          pick.kind === 'skill'
            ? `You said you're working on “${pick.title}”. Did you practice this week?`
            : `You said you want to “${pick.title.toLowerCase()}”. What's one step this week?`,
        sound: true,
      },
      // Weekday 1 is Sunday.
      trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 1, hour: 18, minute: 0 },
    });
  }
}
