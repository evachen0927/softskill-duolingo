/** push_subs/{uid} 的同步。沒設定 Firebase 或沒開通知時一律什麼都不做。 */
import { CONFIG } from '../config';
import { getItem } from './storage';
import { isFirebaseConfigured } from './firebase';
import type { PushSubFields } from './backend';
import { getCompletions } from './practice';
import { todayStr } from './date';

function notifGranted(): boolean {
  return getItem<string | null>('notif_status', null) === 'granted';
}

/** 允許通知後：取得 FCM token，寫入完整的 push_subs。回傳是否有寫入。 */
export async function registerPush(): Promise<boolean> {
  if (!isFirebaseConfigured() || !notifGranted()) return false;
  if (!('serviceWorker' in navigator)) return false;
  try {
    const backend = await import('./backend');
    const registration = await navigator.serviceWorker.ready;
    const token = await backend.getFcmToken(registration);
    if (!token) return false;
    const uid = await backend.ensureUser();
    const fields: PushSubFields = {
      fcm_token: token,
      reminder_time: getItem<string>('reminder_time', CONFIG.DEFAULT_REMINDER_TIME),
      timezone: CONFIG.TIMEZONE,
    };
    const today = todayStr();
    if (getCompletions()[today]?.done) fields.last_completed_date = today;
    await backend.savePushSub(uid, fields);
    return true;
  } catch {
    return false; // 失敗不影響練習；首頁仍有 App 內提醒
  }
}

/** 部分更新：改提醒時間、今天 3 題完成時呼叫。 */
export async function syncPushSub(fields: PushSubFields): Promise<boolean> {
  if (!isFirebaseConfigured() || !notifGranted()) return false;
  try {
    const backend = await import('./backend');
    const uid = await backend.ensureUser();
    await backend.savePushSub(uid, fields);
    return true;
  } catch {
    return false;
  }
}
