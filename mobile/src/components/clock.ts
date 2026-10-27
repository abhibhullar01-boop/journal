import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** The time now, refreshed every `everyMs` and whenever the app comes back to the front. */
export function useNow(everyMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), everyMs);
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && setNow(new Date()));
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [everyMs]);
  return now;
}

/** Today's date as text. Changes only when the day does, so lists keyed on it don't redraw every minute. */
export function useToday(): string {
  const [day, setDay] = useState(() => new Date().toDateString());
  useEffect(() => {
    const check = () => setDay(new Date().toDateString());
    const timer = setInterval(check, 30_000);
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && check());
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  return day;
}

export function endOfDay(date: Date): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function startOfDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 5) return 'Still up?';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
