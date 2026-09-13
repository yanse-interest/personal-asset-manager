import { useCallback, useEffect, useState } from 'react';
import { localToday } from '../domain/dates';

export function millisecondsUntilNextLocalDay(now: Date): number {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return Math.max(1, next.getTime() - now.getTime());
}

export function useToday(): string {
  const [today, setToday] = useState(() => localToday());
  const refresh = useCallback(() => setToday(localToday()), []);
  useEffect(() => {
    let timer = 0;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { refresh(); schedule(); }, millisecondsUntilNextLocalDay(new Date()) + 50);
    };
    const reschedule = () => { refresh(); schedule(); };
    const visibility = () => { if (document.visibilityState === 'visible') reschedule(); };
    schedule();
    window.addEventListener('focus', reschedule); document.addEventListener('visibilitychange', visibility);
    return () => { window.clearTimeout(timer); window.removeEventListener('focus', reschedule); document.removeEventListener('visibilitychange', visibility); };
  }, [refresh]);
  return today;
}
