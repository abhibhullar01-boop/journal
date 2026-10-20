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

    if ((word === 'at' || word === 'around' || word === 'by') && i + 1 < tokens.length && /^\d+$/.test(tokens[i + 1]) && !/^(st|nd|rd|th)$/.test(tokens[i + 2] ?? '')) {
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

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, 'forty-five': 45,
};

function amount(token: string | undefined): number | null {
  if (!token) return null;
  if (/^\d+$/.test(token)) return Number(token);
  return NUMBER_WORDS[token] ?? null;
}

/** "in 2 hours", "in an hour", "in half an hour", "in 30 minutes", "in ten mins". */
function relativeOffset(tokens: string[]): number | null {
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i] !== 'in') continue;
    if (tokens[i + 1] === 'half' && tokens[i + 2] === 'an' && tokens[i + 3] === 'hour') return 30 * 60_000;
    // "in a couple of hours" is 2, "in a few hours" 3, "in a few minutes" 5.
    let j = i + 1;
    if (tokens[j] === 'a') j++;
    let n = amount(tokens[i + 1]);
    let fuzzy = false;
    if (tokens[j] === 'couple' || tokens[j] === 'few') {
      fuzzy = tokens[j] === 'few';
      n = tokens[j] === 'couple' ? 2 : 3;
      j++;
      if (tokens[j] === 'of') j++;
    } else {
      j = i + 2;
    }
    const unit = tokens[j] ?? '';
    if (n === null) continue;
    if (/^(hour|hours|hr|hrs)$/.test(unit)) return n * 3600_000;
    if (/^(minute|minutes|min|mins)$/.test(unit)) return (fuzzy ? 5 : n) * 60_000;
  }
  return null;
}

const MONTHS: Record<string, number> = {
  january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3, may: 4, june: 5, jun: 5,
  july: 6, jul: 6, august: 7, aug: 7, september: 8, sept: 8, sep: 8, october: 9, oct: 9, november: 10, nov: 10,
  december: 11, dec: 11,
};

/** "on 5 November", "November 5th", "the 5th of nov" -> that date (next year if it has passed). */
function calendarDate(tokens: string[], today: Date): Date | null {
  for (let i = 0; i < tokens.length; i++) {
    const month = MONTHS[tokens[i]];
    if (month === undefined || (tokens[i] === 'may' && !/^\d/.test(tokens[i + 1] ?? '') && !/^\d/.test(tokens[i - 1] ?? ''))) continue;
    const near = [tokens[i + 1], tokens[i - 1], tokens[i - 2]];
    for (const t of near) {
      const m = /^(\d{1,2})(st|nd|rd|th)?$/.exec(t ?? '');
      if (!m) continue;
      const n = Number(m[1]);
      if (n < 1 || n > 31) continue;
      let date = new Date(today.getFullYear(), month, n);
      if (date < today) date = new Date(today.getFullYear() + 1, month, n);
      return date;
    }
  }
  return null;
}

/** "on the 1st", "by the 25th", "the 3rd" -> the next date with that day of the month. */
function dayOfMonth(tokens: string[], today: Date): Date | null {
  for (const t of tokens) {
    const m = /^(\d{1,2})(st|nd|rd|th)$/.exec(t);
    if (!m) continue;
    const n = Number(m[1]);
    if (n < 1 || n > 31) continue;
    const date = new Date(today);
    date.setDate(1);
    if (n < today.getDate()) date.setMonth(date.getMonth() + 1);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(n, lastDay));
    return date;
  }
  return null;
}

/**
 * Finds a reminder time in phrases like "tomorrow", "tonight", "by Friday", "at 5 pm",
 * "next week", "this weekend", "in 2 hours", "on the 1st", "after work" or "end of the month".
 * Returns null when there is no time cue. Uses the device's local time zone.
 */
export function dueDateIn(sentence: string, now: Date = new Date()): Date | null {
  const tokens = words(sentence);
  const text = ` ${tokens.join(' ')} `;
  const has = (phrase: string) => text.includes(` ${phrase} `);

  const offset = relativeOffset(tokens);
  if (offset !== null) return new Date(now.getTime() + offset);
  if (has('asap') || has('right now') || has('right away')) return new Date(now.getTime() + 3600_000);

  const today = startOfDay(now);
  let day: Date | null = null;
  let hour: number | null = null;
  let minute = 0;
  const monthDay = calendarDate(tokens, today) ?? dayOfMonth(tokens, today);
  // "in 3 days", "in a week". Longer stretches ("in three weeks") usually describe something else, like a follow-up.
  const daysAhead = /\bin (\d+|a|one|two|three|four|five|six|seven|ten) (day|days|week)\b/.exec(text);
  // "it expires next month" says when something else happens, not when to be reminded.
  const otherEvent = /\b(expires|expire|expiring|expiry|ends|starts|arrives|is due|due)\b/.test(text);

  if (has('day after tomorrow')) {
    day = addDays(today, 2);
  } else if (has('tomorrow') || has('first thing in the morning')) {
    day = addDays(today, 1);
  } else if (monthDay) {
    day = monthDay;
  } else if (daysAhead) {
    const n = amount(daysAhead[1]) ?? 1;
    day = addDays(today, daysAhead[2].startsWith('week') ? n * 7 : n);
  } else if (has('end of the month') || has('end of month') || has('month end')) {
    day = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  } else if (has('end of the week') || has('end of week') || has('end of this week')) {
    day = today.getDay() === 5 ? today : nextWeekday(today, 5);
    hour = 17;
  } else if (has('next month') && !otherEvent) {
    day = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  } else if (has('this weekend') || has('weekend')) {
    day = nextWeekday(today, 6);
    hour = 10;
  } else if (has('next week')) {
    day = nextWeekday(today, 1);
  } else {
    const index = tokens.findIndex((t, i) => WEEKDAYS[t] !== undefined && tokens[i - 1] !== 'every');
    if (index >= 0) day = nextWeekday(today, WEEKDAYS[tokens[index]]);
  }

  const eveningish = has('tonight') || has('evening') || has('night');
  if (has('midnight')) {
    hour = 23;
    minute = 59;
  }
  else if (has('before bed') || has('bedtime') || has('before sleeping') || has('before i sleep')) hour = 22;
  else if (has('after dinner')) hour = 21;
  else if (has('before dinner')) hour = 19;
  else if (eveningish) hour = 19;
  else if (has('after work')) hour = 18;
  else if (has('after lunch') || has('afternoon')) hour = 14;
  else if (has('before lunch')) hour = 11;
  else if (has('morning')) hour = 8;
  else if (has('end of day') || has('eod') || has('later today') || has('later')) hour = 17;
  else if (has('dinner')) hour = 20;
  else if (has('lunch') || has('noon') || has('midday')) hour = 12;

  const clock = clockTime(tokens);
  if (clock) {
    hour = clock.hour;
    minute = clock.minute;
    if ((eveningish || has('afternoon') || has('dinner')) && hour < 12) hour += 12;
  }

  // A time of day with no day ("at 5", "in the afternoon", "after work", "today") means today.
  if (!day && (hour !== null || has('today'))) day = today;
  if (!day) return null;
  if (hour === null && has('today')) hour = 17;

  let date = new Date(day);
  date.setHours(hour ?? DEFAULT_HOUR, minute, 0, 0);

  // A time that already passed today moves to tomorrow (or an hour from now for "today").
  if (date <= now && day.getTime() === today.getTime()) {
    if (has('today') || has('tonight') || has('later') || has('end of day') || has('eod')) {
      date = new Date(now.getTime() + 3600_000);
    } else {
      date = addDays(date, 1);
    }
  }
  return date;
}
