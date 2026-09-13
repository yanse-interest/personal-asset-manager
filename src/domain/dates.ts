import type { LocalDate } from './types';

const DAY_MS = 86_400_000;

export function calendarOrdinal(value: LocalDate): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('日期必须为 YYYY-MM-DD');
  const [year, month, day] = value.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined || year < 1900 || year > 9999) {
    throw new Error('日期超出允许范围');
  }
  const utc = new Date(0);
  utc.setUTCHours(0, 0, 0, 0);
  utc.setUTCFullYear(year, month - 1, day);
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) {
    throw new Error('日期不是有效公历日期');
  }
  return utc.getTime() / DAY_MS;
}

export function isLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== 'string') return false;
  try { calendarOrdinal(value); return true; } catch { return false; }
}

export function localToday(now: Date = new Date()): LocalDate {
  const year = String(now.getFullYear()).padStart(4, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function daysOwned(purchaseDate: LocalDate, today: LocalDate): number {
  return Math.max(1, calendarOrdinal(today) - calendarOrdinal(purchaseDate) + 1);
}

export type ExpiryStatus =
  | { kind: 'none' }
  | { kind: 'future'; days: number }
  | { kind: 'today' }
  | { kind: 'past'; days: number };

export function expiryStatus(expiryDate: LocalDate | null, today: LocalDate): ExpiryStatus {
  if (expiryDate === null) return { kind: 'none' };
  const delta = calendarOrdinal(expiryDate) - calendarOrdinal(today);
  if (delta > 0) return { kind: 'future', days: delta };
  if (delta < 0) return { kind: 'past', days: -delta };
  return { kind: 'today' };
}
