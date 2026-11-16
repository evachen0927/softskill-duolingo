/** Service worker 用的純函式（可單元測試）。 */
export const DEFAULT_TITLE = '軟實力多鄰國';
export const DEFAULT_BODY = '今天的 5 分鐘練習還沒完成，要不要現在練？';
export const DEFAULT_LINK = '#/practice';

export interface ReminderPayload {
  title: string;
  body: string;
  link: string;
}

/** 解析推播內容。FCM data 訊息是 { data: {...} }；也接受 { notification: {...} } 或直接的物件。 */
export function parsePushPayload(raw: unknown): ReminderPayload {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = (obj.data ?? obj.notification ?? obj) as Record<string, unknown>;
  const str = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v : fallback);
  const link = str(d.link, DEFAULT_LINK);
  return {
    title: str(d.title, DEFAULT_TITLE),
    body: str(d.body, DEFAULT_BODY),
    // 只允許 App 內的 hash 路由，避免推播內容把使用者導到外部網址
    link: link.startsWith('#/') ? link : DEFAULT_LINK,
  };
}

/** 點通知後要打開的網址：service worker 的 scope（含 GitHub Pages 子路徑）＋ hash 路由。 */
export function notificationUrl(scope: string, link: string): string {
  const base = scope.endsWith('/') ? scope : `${scope}/`;
  return `${base}${link.startsWith('#/') ? link : DEFAULT_LINK}`;
}
