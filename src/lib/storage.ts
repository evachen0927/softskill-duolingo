/** localStorage 讀寫，所有 key 自動加上 softskill_ 前綴，值以 JSON 存。 */
export const PREFIX = 'softskill_';

export type StorageKey =
  | 'device_id'
  | 'pain_points'
  | 'committed_at'
  | 'reminder_time'
  | 'notif_status'
  | 'daily_set'
  | 'completions'
  | 'feedback'
  | 'journey_start'
  | 'event_queue'
  | 'feature_interest';

export function getItem<T>(key: StorageKey, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function setItem<T>(key: StorageKey, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* 私密模式或容量滿時略過，不讓 App 壞掉 */
  }
}

export function removeItem(key: StorageKey): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

/** 取出所有 softskill_ 開頭的資料（給 #/debug 匯出用）。 */
export function dumpAll(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(PREFIX)) continue;
    const raw = localStorage.getItem(k);
    try {
      out[k.slice(PREFIX.length)] = raw === null ? null : JSON.parse(raw);
    } catch {
      out[k.slice(PREFIX.length)] = raw;
    }
  }
  return out;
}

/** 清除所有 softskill_ 資料（給 #/debug 用）。 */
export function clearAll(): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
}

/** 第一次呼叫時產生 device_id，之後沿用。 */
export function getDeviceId(): string {
  let id = getItem<string | null>('device_id', null);
  if (!id) {
    id = crypto.randomUUID();
    setItem('device_id', id);
  }
  return id;
}
