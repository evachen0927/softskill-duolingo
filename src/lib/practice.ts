import { CONFIG } from '../config';
import { todayStr } from './date';
import { getItem, setItem } from './storage';
import { getOrCreateDailySet, type DailySet } from './dailySet';
import { getQuestion } from './questions';
import { logEvent } from './firebase';
import { syncPushSub } from './push';

export interface Answer {
  question_id: string;
  choice: string;
  correct: boolean;
}

/**
 * 已作答、但兩步解析還沒看完的那一題。存起來，離開再回來也不能改選。
 * result = 第 1 步（對錯＋一句話）；learn = 第 2 步（技巧與正解）。
 * 題目要進到 learn 再按繼續，才算看完解析。
 */
export interface Pending extends Answer {
  slot: number; // 1 起算
  phase: 'result' | 'learn';
}

export interface DayRecord {
  answers: Answer[]; // 看完解析才加一筆
  done: boolean;     // 當天所有題的解析都看完才是 true
  pending?: Pending;
}

export type Completions = Record<string, DayRecord>;
export type Feedback = 'up' | 'down';

export function getCompletions(): Completions {
  return getItem<Completions>('completions', {});
}

function getDay(date: string): DayRecord {
  return getCompletions()[date] ?? { answers: [], done: false };
}

function saveDay(date: string, day: DayRecord): void {
  const all = getCompletions();
  all[date] = day;
  setItem('completions', all);
}

export interface PracticeState {
  date: string;
  set: DailySet;
  total: number;
  /** 目前這題在當天的位置，0 起算；done 時等於 total */
  index: number;
  /** 這題已作答、正在看解析 */
  pending: Pending | null;
  done: boolean;
}

/** 從 localStorage 推算現在該出哪一題（中途離開再回來，從下一題繼續）。 */
export function getPracticeState(now: Date = new Date()): PracticeState {
  const date = todayStr(now);
  const set = getOrCreateDailySet(now);
  const day = getDay(date);
  const total = set.question_ids.length;
  return {
    date,
    set,
    total,
    index: Math.min(day.answers.length, total),
    pending: normalizePending(day.pending),
    done: day.done,
  };
}

/** 舊版 pending 沒有 phase，回來時停在第 1 步。 */
function normalizePending(p: Pending | undefined): Pending | null {
  if (!p) return null;
  return { ...p, phase: p.phase === 'learn' ? 'learn' : 'result' };
}

/** 點選項：直接送出，記 answer 事件。已作答過這題就忽略（不能改選）。 */
export function submitAnswer(choice: string, now: Date = new Date()): Pending {
  const s = getPracticeState(now);
  if (s.done) throw new Error('今天已經完成');
  if (s.pending) return s.pending; // 已送出，不能改選
  const question_id = s.set.question_ids[s.index];
  const q = getQuestion(question_id);
  if (!q.options.some((o) => o.key === choice)) throw new Error(`選項 ${choice} 不存在`);
  const pending: Pending = { question_id, choice, correct: choice === q.answer, slot: s.index + 1, phase: 'result' };
  saveDay(s.date, { ...getDay(s.date), pending });
  logEvent({ type: 'answer', question_id, choice, correct: pending.correct, slot: pending.slot, review: s.set.review[s.index] }, now);
  return pending;
}

/** 按第 1 步的「繼續」：進入第 2 步。這時還沒算看完，當天也不會完成。 */
export function advanceToLearn(now: Date = new Date()): Pending {
  const s = getPracticeState(now);
  if (s.done) throw new Error('今天已經完成');
  if (!s.pending) throw new Error('這題還沒作答');
  if (s.pending.phase === 'learn') return s.pending;
  const pending: Pending = { ...s.pending, phase: 'learn' };
  saveDay(s.date, { ...getDay(s.date), pending });
  return pending;
}

/**
 * 按第 2 步的「繼續」：這題解析看完。
 * 3 題都進過第 2 步並離開，當天才算完成。只停在第 1 步不算。
 */
export function finishExplanation(now: Date = new Date()): { done: boolean } {
  const s = getPracticeState(now);
  if (!s.pending) throw new Error('這題還沒作答');
  if (s.pending.phase !== 'learn') throw new Error('這題還沒到第 2 步');
  const { slot, question_id, choice, correct } = s.pending;
  const answer: Answer = { question_id, choice, correct };
  const day = getDay(s.date);
  const answers = [...day.answers, answer];
  const done = answers.length >= s.total;
  saveDay(s.date, { answers, done });
  logEvent({ type: 'explanation_viewed', ...answer, slot, review: s.set.review[slot - 1] }, now);
  if (done) {
    logEvent({ type: 'day_complete' }, now);
    // 3 題都看完才更新；只做 1、2 題時，排程照常提醒
    void syncPushSub({ last_completed_date: s.date });
  }
  return { done };
}

/** 👍👎：同一題只保留最後一次；每次點擊都記一筆 feedback 事件（分析時取最新一筆）。 */
export function setFeedback(answer: Answer, value: Feedback, now: Date = new Date()): void {
  const all = getItem<Record<string, Feedback>>('feedback', {});
  all[answer.question_id] = value;
  setItem('feedback', all);
  logEvent({ type: 'feedback', question_id: answer.question_id, choice: answer.choice, correct: answer.correct, feedback: value }, now);
}

/** 當天第 index 題（0 起算）的背景亮度。題數少於 3 時，最後一題一樣是全亮。 */
export function sceneBrightness(index: number, total: number): number {
  const levels = CONFIG.SCENE_BRIGHTNESS;
  if (total <= 1) return levels[levels.length - 1];
  const i = Math.round((Math.min(index, total - 1) * (levels.length - 1)) / (total - 1));
  return levels[i];
}
