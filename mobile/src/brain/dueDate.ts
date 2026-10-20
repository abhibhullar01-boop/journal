import { words } from './tokenizer';

const WEEKDAYS: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};
const DEFAULT_HOUR = 9;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** The next given weekday strictly after `date` (0 = Sunday ... 6 = Saturday). */
function nextWeekday(date: Date, weekday: number): Date {
  let delta = (weekday - date.getDay() + 7) % 7;
  if (delta === 0) delta = 7;
  return addDays(date, delta);
}

/** "at 5", "at 5 pm", "at 3 30", "5pm", "10am", "at 9 a.m." */
export function clockTime(tokens: string[]): { hour: number; minute: number } | null {
  for (let i = 0; i < tokens.length; i++) {
    const word = tokens[i];
    let hourText: string | null = null;
    let suffix: string | null = null;
    let cursor = i + 1;

    if (word === 'at' && i + 1 < tokens.length && /^\d+$/.test(tokens[i + 1])) {
      hourText = tokens[i + 1];
      cursor = i + 2;
    } else if (/^\d+(am|pm)$/.test(word)) {
      hourText = word.slice(0, -2);
      suffix = word.slice(-2);
    }
    if (hourText === null) continue;
    const rawHour = Number(hourText);
    if (rawHour < 0 || rawHour > 23) continue;

    let minute = 0;
    if (cursor < tokens.length && /^\d\d$/.test(tokens[cursor]) && Number(tokens[cursor]) < 60) {
      minute = Number(tokens[cursor]);
      cursor++;
    }
    if (suffix === null && cursor < tokens.length) {
      const next = tokens[cursor];
      if (next === 'am' || next === 'pm') suffix = next;
      else if ((next === 'a' || next === 'p') && tokens[cursor + 1] === 'm') suffix = `${next}m`;
    }

    let hour = rawHour;
    if (suffix === 'pm' && hour < 12) hour += 12;
    else if (suffix === 'am' && hour === 12) hour = 0;
    else if (suffix === null && hour >= 1 && hour <= 6) hour += 12; // "at 3" in a journal means 3 pm
    return { hour, minute };
  }
  return null;
}

/**
 * Finds a reminder time in phrases like "tomorrow", "tonight", "by Friday", "at 5 pm",
 * "next week" or "this weekend". Returns null when there is no time cue. Uses the
 * device's local time zone.
 */
export function dueDateIn(sentence: string, now: Date = new Date()): Date | null {
  const tokens = words(sentence);
  const text = ` ${tokens.join(' ')} `;
  const has = (phrase: string) => text.includes(` ${phrase} `);

  const today = startOfDay(now);
  let day: Date | null = null;
  let hour: number | null = null;
  let minute = 0;

  if (has('tomorrow') || has('first thing in the morning')) {
    day = addDays(today, 1);
  } else if (has('tonight') || has('today') || has('this afternoon') || has('this evening') || has('end of day') || has('later')) {
    day = today;
  } else if (has('this weekend') || has('weekend')) {
    day = nextWeekday(today, 6);
    hour = 10;
  } else if (has('next week')) {
    day = nextWeekday(today, 1);
  } else {
    const weekday = tokens.map((t) => WEEKDAYS[t]).find((d) => d !== undefined);
    if (weekday !== undefined) day = nextWeekday(today, weekday);
  }

  if (has('tonight') || has('evening') || has('night')) hour = 19;
  else if (has('afternoon')) hour = 14;
  else if (has('morning')) hour = 8;
  else if (has('end of day') || has('later today') || has('later')) hour = 17;
  else if (has('lunch') || has('noon')) hour = 12;

  const clock = clockTime(tokens);
  if (clock) {
    hour = clock.hour;
    minute = clock.minute;
    if (!day) day = today;
  }

  if (!day) return null;
  let date = new Date(day);
  date.setHours(hour ?? DEFAULT_HOUR, minute, 0, 0);

  // A time that already passed today moves to tomorrow (or an hour from now for "today").
  if (date <= now && day.getTime() === today.getTime()) {
    if (has('today') || has('tonight') || has('later') || has('end of day')) {
      date = new Date(now.getTime() + 3600_000);
    } else {
      date = addDays(date, 1);
    }
  }
  return date;
}
