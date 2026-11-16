import { CONFIG } from '../config';
import { daysBetween, todayStr } from './date';
import { getItem, setItem } from './storage';
import questions from '../data/questions.json';

export interface DailySet {
  date: string;
  question_ids: string[];
  review: boolean[];
}

/**
 * 純函式：第 dayNumber 天（從 1 起算）要出哪些題。
 * 題目依題庫順序排成一列，第 N 天出第 (N-1)×k+1 到 N×k 題，k = min(每日題數, 題庫數)。
 * 超過題庫長度就從頭繞回，繞回來的題目 review = true。
 */
export function pickQuestions(
  bank: string[],
  dayNumber: number,
  perDay: number = CONFIG.QUESTIONS_PER_DAY,
): { question_ids: string[]; review: boolean[] } {
  if (bank.length === 0 || dayNumber < 1) return { question_ids: [], review: [] };
  const k = Math.min(perDay, bank.length); // 題庫少於每日題數時，只出題庫有的題數，且同一天不重複
  const start = (dayNumber - 1) * k;
  const question_ids: string[] = [];
  const review: boolean[] = [];
  for (let i = 0; i < k; i++) {
    const g = start + i; // 在「無限延伸的題目列」中的位置
    question_ids.push(bank[g % bank.length]);
    review.push(g >= bank.length);
  }
  return { question_ids, review };
}

/** 旅程第幾天（journey_start 當天為第 1 天）。 */
export function journeyDay(journeyStart: string, today: string): number {
  return Math.max(1, daysBetween(journeyStart, today) + 1);
}

export const QUESTION_BANK: string[] = questions.map((q) => q.id);

/**
 * 取得今天的題組：今天已有就沿用（中途離開回來也是同一組），沒有才產生並存進 daily_set。
 */
export function getOrCreateDailySet(now: Date = new Date(), bank: string[] = QUESTION_BANK): DailySet {
  const today = todayStr(now);
  const existing = getItem<DailySet | null>('daily_set', null);
  if (existing && existing.date === today) return existing;
  const start = getItem<string | null>('journey_start', null) ?? today;
  const set: DailySet = { date: today, ...pickQuestions(bank, journeyDay(start, today)) };
  setItem('daily_set', set);
  return set;
}
