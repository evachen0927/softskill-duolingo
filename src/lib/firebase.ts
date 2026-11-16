/**
 * 事件與 Firebase 設定。
 * - 沒有 VITE_FIREBASE_* 環境變數時（離線模式）：事件只進 event_queue，可在 #/debug 匯出。
 * - 有設定時：事件先進 event_queue，再由 flushQueue() 補送到 Firestore events/，送成功才移出佇列。
 * - 開發模式（npm run dev）一律連本機 Emulator，不會寫到真的 Firebase（見 backend.ts）。
 */
import { getDeviceId, getItem, setItem } from './storage';

export type EventType =
  | 'onboarding_done'
  | 'commit'
  | 'notif_permission'
  | 'answer'
  | 'explanation_viewed'
  | 'feedback'
  | 'day_complete';

export type Platform = 'ios' | 'android' | 'desktop';

/** notif_permission 事件的結果。前 4 個同 notif_status；後兩個是使用者沒看到系統權限框的情況。 */
export type PermissionResult = 'granted' | 'denied' | 'default' | 'unsupported' | 'skipped' | 'ios_needs_install';

export interface AppEvent {
  device_id: string;
  uid: string | null;
  type: EventType;
  question_id?: string | null;
  choice?: string | null;
  correct?: boolean | null;
  feedback?: 'up' | 'down' | null;
  slot?: number | null;
  review?: boolean | null;
  permission?: PermissionResult | null;
  platform: Platform;
  standalone: boolean;
  ts: string; // ISO 8601
}

export type EventInput = Omit<AppEvent, 'device_id' | 'uid' | 'platform' | 'standalone' | 'ts'>;

export interface FirebaseEnv {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  vapidKey: string;
}

/** 每次呼叫時才讀環境變數（測試可用 vi.stubEnv 切換）。 */
export function firebaseEnv(): FirebaseEnv {
  const e = import.meta.env;
  return {
    apiKey: e.VITE_FIREBASE_API_KEY ?? '',
    authDomain: e.VITE_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: e.VITE_FIREBASE_PROJECT_ID ?? '',
    storageBucket: e.VITE_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: e.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: e.VITE_FIREBASE_APP_ID ?? '',
    vapidKey: e.VITE_FIREBASE_VAPID_KEY ?? '',
  };
}

export function isFirebaseConfigured(): boolean {
  const c = firebaseEnv();
  return Boolean(c.apiKey && c.projectId && c.appId && c.messagingSenderId);
}

export function detectPlatform(ua: string = navigator.userAgent): Platform {
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return Boolean(nav.standalone) || (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches);
}

/** 記錄事件：先放進 event_queue，再試著補送（沒設定 Firebase 時什麼都不送）。 */
export function logEvent(input: EventInput, now: Date = new Date()): AppEvent {
  const event: AppEvent = {
    device_id: getDeviceId(),
    uid: null,
    platform: detectPlatform(),
    standalone: isStandalone(),
    ts: now.toISOString(),
    ...input,
  };
  const queue = getItem<AppEvent[]>('event_queue', []);
  queue.push(event);
  setItem('event_queue', queue);
  void flushQueue();
  return event;
}

let flushing: Promise<number> | null = null;

/** 補送佇列中的事件，回傳送出的筆數。斷線或失敗時留在佇列，下次再送。 */
export function flushQueue(): Promise<number> {
  if (!isFirebaseConfigured()) return Promise.resolve(0);
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve(0);
  if (flushing) return flushing;
  flushing = (async () => {
    let sent = 0;
    try {
      const backend = await import('./backend');
      const uid = await backend.ensureUser();
      // 一次處理一筆，送成功就從佇列移除，避免中途失敗重複送
      for (;;) {
        const queue = getItem<AppEvent[]>('event_queue', []);
        if (queue.length === 0) break;
        const [first, ...rest] = queue;
        await backend.addEvent({ ...first, uid });
        setItem('event_queue', rest);
        sent++;
      }
    } catch {
      /* 離線或後端錯誤：保留佇列，之後再送 */
    } finally {
      flushing = null;
    }
    return sent;
  })();
  return flushing;
}

/** App 啟動時呼叫：恢復連線時自動補送。 */
export function startAutoFlush(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', () => void flushQueue());
  void flushQueue();
}
