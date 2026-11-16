/** 每日提醒的判斷邏輯（純函式，不碰 Firebase，方便用假時間測試）。 */
export const NOTIFICATION = {
  title: '軟實力多鄰國',
  body: '今天的 5 分鐘練習還沒完成，要不要現在練？',
  link: '#/practice',
} as const;

export const DEFAULT_TIMEZONE = 'Asia/Taipei';

export interface PushSub {
  fcm_token?: string;
  reminder_time?: string; // HH:mm
  timezone?: string;
  last_completed_date?: string; // YYYY-MM-DD
  last_notified_date?: string;  // YYYY-MM-DD
}

/** 某時區的「今天日期」和「現在時刻 HH:mm」。 */
export function localNow(now: Date, timeZone: string = DEFAULT_TIMEZONE): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

export type Decision =
  | { send: true; date: string }
  | { send: false; reason: 'no_token' | 'bad_time' | 'not_yet' | 'completed_today' | 'notified_today' };

/**
 * 要不要發：用「已經超過提醒時間、今天還沒發」判斷，不是「剛好在這 15 分鐘內」。
 * GitHub Actions 的 cron 可能延遲 5–15 分鐘以上，這樣才不會漏發。
 */
export function decide(sub: PushSub, now: Date): Decision {
  if (!sub.fcm_token) return { send: false, reason: 'no_token' };
  if (!sub.reminder_time || !/^([01]\d|2[0-3]):[0-5]\d$/.test(sub.reminder_time)) return { send: false, reason: 'bad_time' };
  const { date, time } = localNow(now, sub.timezone || DEFAULT_TIMEZONE);
  if (time < sub.reminder_time) return { send: false, reason: 'not_yet' };
  if (sub.last_completed_date === date) return { send: false, reason: 'completed_today' };
  if (sub.last_notified_date === date) return { send: false, reason: 'notified_today' };
  return { send: true, date };
}

/** FCM 回傳這些錯誤代表 token 已失效，要刪掉訂閱。 */
export const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

export interface Deps {
  listSubs(): Promise<Array<{ id: string; data: PushSub }>>;
  send(token: string): Promise<void>;
  markNotified(id: string, date: string): Promise<void>;
  remove(id: string): Promise<void>;
  log(msg: string): void;
}

export interface Summary {
  checked: number;
  sent: number;
  skipped: number;
  removed: number;
  failed: number;
  wouldSend: string[]; // dry-run 時會發給誰（doc id）
}

export async function runReminders(deps: Deps, now: Date, dryRun: boolean): Promise<Summary> {
  const subs = await deps.listSubs();
  const summary: Summary = { checked: subs.length, sent: 0, skipped: 0, removed: 0, failed: 0, wouldSend: [] };
  for (const { id, data } of subs) {
    const d = decide(data, now);
    if (!d.send) {
      summary.skipped++;
      continue;
    }
    if (dryRun) {
      summary.wouldSend.push(id);
      deps.log(`[dry-run] 會發送給 ${id}（提醒時間 ${data.reminder_time}，${d.date}）`);
      continue;
    }
    try {
      await deps.send(data.fcm_token!);
      await deps.markNotified(id, d.date);
      summary.sent++;
    } catch (err) {
      const code = (err as { code?: string; errorInfo?: { code?: string } })?.code ?? (err as { errorInfo?: { code?: string } })?.errorInfo?.code;
      if (code && INVALID_TOKEN_CODES.has(code)) {
        await deps.remove(id);
        summary.removed++;
        deps.log(`token 失效，已刪除訂閱 ${id}（${code}）`);
      } else {
        summary.failed++;
        deps.log(`發送失敗 ${id}：${code ?? String(err)}`);
      }
    }
  }
  return summary;
}
