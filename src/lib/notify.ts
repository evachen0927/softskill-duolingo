/** 通知權限：只在使用者按下按鈕時才請求，被拒絕後不會再跳系統權限框。 */
import { getItem, setItem } from './storage';
import { detectPlatform, isStandalone, logEvent, type PermissionResult } from './firebase';
import { registerPush } from './push';

export type NotifStatus = 'granted' | 'denied' | 'unsupported' | 'default';
export type Availability = 'supported' | 'unsupported' | 'ios_needs_install';

/** 這台裝置現在能不能請求通知權限。 */
export function notifAvailability(): Availability {
  // iOS 的網頁推播只在「加入主畫面」後從主畫面開啟時可用
  if (detectPlatform() === 'ios' && !isStandalone()) return 'ios_needs_install';
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'unsupported';
  }
  return 'supported';
}

export function getNotifStatus(): NotifStatus | null {
  return getItem<NotifStatus | null>('notif_status', null);
}

function record(status: NotifStatus, permission: PermissionResult = status): NotifStatus {
  setItem('notif_status', status);
  logEvent({ type: 'notif_permission', permission });
  return status;
}

/**
 * 使用者按「開啟提醒」時呼叫。
 * - 不支援：記 unsupported，不跳任何框。
 * - 瀏覽器已經是 granted／denied：直接沿用，不再跳系統權限框。
 * - 允許後註冊 FCM、寫入 push_subs（沒設定 Firebase 時略過）。
 */
export async function askPermission(): Promise<NotifStatus> {
  const avail = notifAvailability();
  if (avail === 'unsupported') return record('unsupported');
  if (avail === 'ios_needs_install') return record('default', 'ios_needs_install');

  let result: NotificationPermission = Notification.permission;
  if (result === 'default') {
    try {
      result = await Notification.requestPermission();
    } catch {
      result = 'denied';
    }
  }
  const status = record(result as NotifStatus);
  if (status === 'granted') void registerPush();
  return status;
}

/** 使用者在承諾後選「先不要」或看完 iOS 教學先跳過：記事件，之後可以在首頁再開。 */
export function skipPermission(reason: 'skipped' | 'ios_needs_install' | 'unsupported'): NotifStatus {
  return record(reason === 'unsupported' ? 'unsupported' : 'default', reason);
}

/**
 * 首頁開啟時，把瀏覽器實際的權限同步回來（使用者可能在系統設定改過）。
 * 只讀取、不請求，所以不會跳框。
 */
export function syncPermissionFromBrowser(): NotifStatus | null {
  const stored = getNotifStatus();
  if (notifAvailability() !== 'supported') return stored;
  const actual = Notification.permission as NotifStatus;
  if (stored !== null && actual !== stored && !(stored === 'unsupported')) {
    setItem('notif_status', actual);
    logEvent({ type: 'notif_permission', permission: actual });
    if (actual === 'granted') void registerPush();
    return actual;
  }
  return stored;
}
