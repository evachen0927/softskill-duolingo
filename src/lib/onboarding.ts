import { CONFIG } from '../config';
import { todayStr } from './date';
import { getItem, setItem } from './storage';
import { logEvent } from './firebase';

export interface PainPoint {
  id: string;
  label: string;
}

/** 規格 4.1 的六個選項（括號內的內部對應不顯示給使用者）。 */
export const PAIN_POINTS: PainPoint[] = [
  { id: 'no_structure', label: '想法很多，但講出來沒重點、沒邏輯' },       // 白板問題 1
  { id: 'impromptu', label: '被主管突然提問，臨場講不快、講不準' },        // 白板問題 2
  { id: 'bad_news', label: '要報告壞消息或進度落後，不知道怎麼開口' },     // 學習路徑第 2 關
  { id: 'ask_decision', label: '請主管做決定時，講不清楚利弊' },            // 學習路徑第 3 關
  { id: 'disagree', label: '想提出不同意見，怕被覺得頂撞' },                // 學習路徑第 5 關
  { id: 'no_practice', label: '想練，可是沒地方練、也沒人糾正我' },         // 白板問題 3
];

export const UNSURE: PainPoint = { id: 'unsure', label: '還不確定，先從基礎開始' };

/** 點一個選項後的新選取狀態：「還不確定」與其他選項互斥。 */
export function togglePain(selected: string[], id: string): string[] {
  if (selected.includes(id)) return selected.filter((x) => x !== id);
  if (id === UNSURE.id) return [UNSURE.id];
  return [...selected.filter((x) => x !== UNSURE.id), id];
}

export type Stage = 'pain_points' | 'commit' | 'done';

/** 引導進行到哪一步，全部從 localStorage 推算，重新整理後仍在。 */
export function getStage(): Stage {
  const pains = getItem<string[]>('pain_points', []);
  if (pains.length === 0) return 'pain_points';
  if (!getItem<string | null>('committed_at', null)) return 'commit';
  return 'done';
}

export function savePainPoints(ids: string[]): void {
  if (ids.length === 0) throw new Error('至少要選 1 項');
  setItem('pain_points', ids);
  logEvent({ type: 'onboarding_done' });
}

/** 擊掌完成：存承諾時間、旅程開始日（台北日期）、提醒時間，並記 commit 事件。 */
export function commit(reminderTime: string, now: Date = new Date()): void {
  setItem('committed_at', now.toISOString());
  setItem('journey_start', todayStr(now));
  setItem('reminder_time', reminderTime);
  logEvent({ type: 'commit' }, now);
}

/**
 * 提醒時間選項：每 15 分鐘一格。
 * 推播排程每 15 分鐘跑一次，只開放整刻鐘，實際送達時間才不會和使用者選的差太多。
 */
export const REMINDER_OPTIONS: string[] = Array.from({ length: 96 }, (_, i) => {
  const h = String(Math.floor(i / 4)).padStart(2, '0');
  const m = String((i % 4) * 15).padStart(2, '0');
  return `${h}:${m}`;
});

export function defaultReminderTime(): string {
  return getItem<string>('reminder_time', CONFIG.DEFAULT_REMINDER_TIME);
}
