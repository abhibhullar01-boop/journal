import { router } from 'expo-router';
import { KIND_LABEL } from '../brain';
import { alert } from '../components/dialog';
import type { TrackedItem } from './types';

/**
 * Reminders on the website. A browser can't schedule notifications for later the way a phone
 * can, so the page keeps its own timers while it is open, and shows a browser notification
 * when one comes due (or a message on the page, if notifications aren't allowed).
 * The timers are rebuilt from the lists whenever they change, and again on every visit.
 */
export const TASK_CATEGORY = 'task-reminder';
export const MARK_DONE = 'mark-done';
export const SNOOZE = 'snooze-hour';

/** Browsers can't wait longer than about 24.8 days; later reminders are set on a later visit. */
const LONGEST_WAIT = 2_147_000_000;

type Permission = 'granted' | 'denied' | 'default' | 'unsupported';
type BrowserNotification = { onclick: (() => void) | null; close(): void };
type NotificationClass = {
  permission: Permission;
  requestPermission(): Promise<Permission>;
  new (title: string, options?: { body?: string; tag?: string; icon?: string }): BrowserNotification;
};

const notificationClass = () => (globalThis as { Notification?: NotificationClass }).Notification;

function notificationPermission(): Permission {
  return notificationClass()?.permission ?? 'unsupported';
}

/** Whether this browser may show notifications. */
export async function notificationStatus(): Promise<Permission> {
  return notificationPermission();
}

/** Asks the browser for notifications. Call it from a click: browsers ignore it otherwise. */
export async function requestNotificationPermission(): Promise<boolean> {
  const N = notificationClass();
  if (!N) return false;
  if (N.permission === 'granted') return true;
  if (N.permission === 'denied') return false;
  try {
    return (await N.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

function show(title: string, body: string, opens: () => void, tag?: string) {
  const N = notificationClass();
  if (N?.permission === 'granted') {
    try {
      const n = new N(title, { body, tag, icon: '/icon-192.png' });
      n.onclick = () => {
        globalThis.focus?.();
        opens();
        n.close();
      };
      return;
    } catch {
      // Some phone browsers only allow notifications from a service worker: fall back below.
    }
  }
  // No notifications: say it on the page, where the user will see it next.
  alert(title, body, [{ text: 'Later', style: 'cancel' }, { text: 'Open', onPress: opens }]);
}

const itemTimers = new Map<string, { at: number; timer: ReturnType<typeof setTimeout> }>();
const digestTimers: ReturnType<typeof setTimeout>[] = [];
let latest: TrackedItem[] = [];
let digestsOn = true;

export async function setUpNotifications(): Promise<void> {
  // Nothing to set up: the browser asks for permission when you turn notifications on in Settings.
}

export async function ensurePermission(): Promise<boolean> {
  return notificationPermission() === 'granted';
}

/** Timers are kept in step with the lists by refreshDigests, so nothing is stored per item. */
export async function scheduleReminder(_item: TrackedItem): Promise<string | null> {
  return null;
}

export async function cancelReminder(_notificationId: string | null): Promise<void> {}

/** The chat already shows what was saved, so the website doesn't repeat it as a notification. */
export async function notifySaved(_items: TrackedItem[]): Promise<void> {}

function remind(item: TrackedItem) {
  itemTimers.delete(item.id);
  const now = latest.find((i) => i.id === item.id);
  if (!now || now.done || now.dueDate !== item.dueDate) return;
  show(now.title, `From your journal: “${now.sentence}”`, () => router.navigate({ pathname: '/lists', params: { kind: now.kind } }), now.id);
}

/** The next time a clock time comes round (weekday: 0 is Sunday). */
function next(hour: number, minute: number, weekday?: number): number {
  const at = new Date();
  at.setHours(hour, minute, 0, 0);
  while (at.getTime() <= Date.now() || (weekday !== undefined && at.getDay() !== weekday)) at.setDate(at.getDate() + 1);
  return at.getTime();
}

function morning() {
  const open = latest.filter((i) => i.kind === 'task' && !i.done);
  const toBuy = latest.filter((i) => i.kind === 'shopping' && !i.done);
  if (open.length || toBuy.length) {
    const title = [open.length ? (open.length === 1 ? '1 open task' : `${open.length} open tasks`) : '', toBuy.length ? `${toBuy.length} to buy` : '']
      .filter(Boolean)
      .join(', ');
    const body = [open.slice(0, 3).map((i) => i.title).join(' · '), toBuy.length ? `Buy: ${toBuy.slice(0, 5).map((i) => i.title.toLowerCase()).join(', ')}` : '']
      .filter(Boolean)
      .join('\n');
    show(title, body, () => router.navigate('/today'), 'daily-digest');
  }
}

function evening() {
  const open = latest.filter((i) => i.kind === 'task' && !i.done);
  if (!open.length) return;
  show(
    open.length === 1 ? 'One thing still open' : `${open.length} things still open`,
    `${open.slice(0, 3).map((i) => i.title).join(' · ')}\nTick them off or tell me how the day went.`,
    () => router.navigate('/today'),
    'evening-wrap',
  );
}

function checkIn() {
  const growth = latest.filter((i) => (i.kind === 'skill' || i.kind === 'goal') && !i.done);
  const week = Math.floor(Date.now() / (7 * 24 * 3600_000));
  const pick = growth.length ? growth[week % growth.length] : undefined;
  if (!pick) return;
  show(
    `${KIND_LABEL[pick.kind]} check-in`,
    pick.kind === 'skill' ? `You said you're working on “${pick.title}”. Did you practice this week?` : `You said you want to “${pick.title.toLowerCase()}”. What's one step this week?`,
    () => router.navigate({ pathname: '/', params: { ask: `How am I doing with "${pick.title}"? Give me one small next step.` } }),
    'weekly-check-in',
  );
}

/** Sets a digest for its next time, and again after it shows. */
function every(hour: number, minute: number, run: () => void, weekday?: number) {
  const timer = setTimeout(() => {
    if (digestsOn) run();
    every(hour, minute, run, weekday);
  }, Math.min(LONGEST_WAIT, next(hour, minute, weekday) - Date.now()));
  digestTimers.push(timer);
}

/** Rebuilds every timer from the current lists: task reminders always, digests when they're on. */
export async function refreshDigests(items: TrackedItem[], enabled = true): Promise<void> {
  latest = items;
  digestsOn = enabled;
  const now = Date.now();
  const wanted = new Map<string, number>();
  for (const item of items) {
    if ((item.kind !== 'task' && item.kind !== 'shopping') || item.done || !item.dueDate) continue;
    const at = new Date(item.dueDate).getTime();
    if (at > now && at - now < LONGEST_WAIT) wanted.set(item.id, at);
  }
  for (const [id, set] of itemTimers) {
    if (wanted.get(id) !== set.at) {
      clearTimeout(set.timer);
      itemTimers.delete(id);
    }
  }
  for (const [id, at] of wanted) {
    if (itemTimers.has(id)) continue;
    const item = items.find((i) => i.id === id)!;
    itemTimers.set(id, { at, timer: setTimeout(() => remind(item), at - now) });
  }
  if (!digestTimers.length) {
    every(8, 30, morning);
    every(20, 30, evening);
    every(18, 0, checkIn, 0);
  }
}
