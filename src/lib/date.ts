import { CONFIG } from '../config';

/** 以指定時區（預設 Asia/Taipei）取得日期字串 YYYY-MM-DD，不受執行環境時區影響。 */
export function todayStr(now: Date = new Date(), timeZone: string = CONFIG.TIMEZONE): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** 兩個 YYYY-MM-DD 之間相差幾個日曆日（b - a）。 */
export function daysBetween(a: string, b: string): number {
  const toUTC = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUTC(b) - toUTC(a)) / 86_400_000);
}

/** 在 YYYY-MM-DD 上加減天數。 */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}
