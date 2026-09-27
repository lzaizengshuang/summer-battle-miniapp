import {
  format,
  parseISO,
  addDays,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isToday as dfIsToday,
  isBefore,
  isSameDay,
} from 'date-fns';
import { zhCN } from 'date-fns/locale';

export const toISODate = (date: Date): string => format(date, 'yyyy-MM-dd');

export const parseDate = (date: string | Date): Date =>
  typeof date === 'string' ? parseISO(date) : date;

export const formatDateCN = (date: string | Date): string =>
  format(parseDate(date), 'MM月dd日 EEEE', { locale: zhCN });

export const formatMonthCN = (year: number, month: number): string =>
  format(new Date(year, month - 1), 'yyyy年MM月');

export const isToday = (date: string | Date): boolean =>
  dfIsToday(parseDate(date));

export const isPastDay = (date: string | Date): boolean => {
  const d = parseDate(date);
  return isBefore(d, new Date()) && !dfIsToday(d);
};

export const addISODays = (date: string | Date, days: number): string =>
  toISODate(addDays(parseDate(date), days));

export const eachISODay = (start: string, end: string): string[] =>
  eachDayOfInterval({
    start: parseISO(start),
    end: parseISO(end),
  }).map(toISODate);

export const getCalendarDays = (year: number, month: number): string[] => {
  const base = new Date(year, month - 1);
  const start = startOfWeek(startOfMonth(base), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(base), { weekStartsOn: 0 });
  return eachDayOfInterval({ start, end }).map(toISODate);
};

export const getTodayISO = (): string => toISODate(new Date());

export const getWeekdayName = (date: string | Date): string =>
  format(parseDate(date), 'EEE', { locale: zhCN });

export const getDaysBetween = (start: string, end: string): number => {
  const s = parseISO(start);
  const e = parseISO(end);
  return Math.max(0, Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));
};

export const clampDate = (
  date: string,
  min: string | undefined,
  max: string | undefined,
): string => {
  if (min && date < min) return min;
  if (max && date > max) return max;
  return date;
};

export const isSameISODay = (a: string | Date, b: string | Date): boolean =>
  isSameDay(parseDate(a), parseDate(b));
