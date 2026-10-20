import * as Notifications from 'expo-notifications';
import { KIND_LABEL } from '../brain';
import type { TrackedItem } from './types';

/**
 * Local notifications drawn from what you said:
 * - a reminder at the time a task mentioned ("tomorrow", "at 5 pm", "by Friday")
 * - a morning digest of open tasks
 * - a Sunday evening check-in on a skill or goal
 */
export const TASK_CATEGORY = 'task-reminder';
export const MARK_DONE = 'mark-done';
export const SNOOZE = 'snooze-hour';
const DIGEST_ID = 'daily-digest';
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
  if (item.kind !== 'task' || item.done || !item.dueDate) return null;
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

export async function cancelReminder(notificationId: string | null): Promise<void> {
  if (notificationId) await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => {});
}

/** Rebuilds the repeating digest and check-in so their text matches the current data. */
export async function refreshDigests(items: TrackedItem[]): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(DIGEST_ID).catch(() => {});
  await Notifications.cancelScheduledNotificationAsync(CHECK_IN_ID).catch(() => {});
  if (!(await Notifications.getPermissionsAsync()).granted) return;

  const open = items.filter((i) => i.kind === 'task' && !i.done);
  if (open.length) {
    await Notifications.scheduleNotificationAsync({
      identifier: DIGEST_ID,
      content: {
        title: open.length === 1 ? '1 open task' : `${open.length} open tasks`,
        body: open.slice(0, 3).map((i) => i.title).join(' · '),
        sound: true,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 8, minute: 30 },
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
