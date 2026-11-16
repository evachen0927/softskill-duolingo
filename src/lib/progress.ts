import { CONFIG } from '../config';
import { addDays, daysBetween } from './date';
import type { Completions } from './practice';

/** 只有 done = true 的日子算完成（只做 1、2 題不算）。 */
export function isDone(c: Completions, date: string): boolean {
  return c[date]?.done === true;
}

/**
 * 目前連勝天數（Asia/Taipei 日曆日）。
 * - 今天已完成：從今天往回數。
 * - 今天還沒做：從昨天往回數，今天還不算中斷。
 * - STREAK_RESET_ON_MISS = true：中間缺一天就停止（歸零後重來）。
 *   設成 false 時，缺的日子略過不算，連勝不歸零（保留給之後的寬限規則）。
 */
export function currentStreak(c: Completions, today: string, resetOnMiss: boolean = CONFIG.STREAK_RESET_ON_MISS): number {
  let day = isDone(c, today) ? today : addDays(today, -1);
  if (resetOnMiss) {
    let n = 0;
    while (isDone(c, day)) {
      n++;
      day = addDays(day, -1);
    }
    return n;
  }
  return Object.keys(c).filter((d) => isDone(c, d) && d <= day).length;
}

/** 旅程 journey_start 起 JOURNEY_DAYS 天內（含開始日）完成的天數。 */
export function journeyCompleted(c: Completions, journeyStart: string | null, days: number = CONFIG.JOURNEY_DAYS): number {
  if (!journeyStart) return 0;
  return Object.keys(c).filter((d) => {
    const i = daysBetween(journeyStart, d);
    return isDone(c, d) && i >= 0 && i < days;
  }).length;
}

export interface CalendarCell {
  date: string; // YYYY-MM-DD
  day: number;
  done: boolean;
  isToday: boolean;
  isFuture: boolean;
  /** 使用者第一次使用（journey_start）之前的日子 */
  beforeStart: boolean;
}

/** 今天所在的那一週（週日開頭）的 7 個日期。 */
export function weekOf(today: string): string[] {
  const [y, m, d] = today.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const start = addDays(today, -weekday);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** 當月日曆：回傳週日開頭的週列，月初前、月底後補 null。 */
export function monthGrid(
  c: Completions,
  today: string,
  journeyStart: string | null = null,
): { year: number; month: number; weeks: (CalendarCell | null)[][] } {
  const [year, month] = today.split('-').map(Number);
  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0 = 週日
  const cells: (CalendarCell | null)[] = Array(firstWeekday).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = addDays(first, d - 1);
    cells.push({
      date,
      day: d,
      done: isDone(c, date),
      isToday: date === today,
      isFuture: date > today,
      beforeStart: journeyStart != null && date < journeyStart,
    });
  }
  while (cells.length % 7) cells.push(null);
  const weeks: (CalendarCell | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { year, month, weeks };
}
