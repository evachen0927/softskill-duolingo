import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { getItem, setItem } from '../src/lib/storage';
import type { AppEvent } from '../src/lib/firebase';

// 後端一律 mock，不碰真的 Firebase
const backend = vi.hoisted(() => ({
  ensureUser: vi.fn(async () => 'uid-123'),
  addEvent: vi.fn(async () => undefined),
  savePushSub: vi.fn(async (_uid: string, _fields: Record<string, unknown>) => undefined),
  getFcmToken: vi.fn(async () => 'fcm-token-abc'),
}));
vi.mock('../src/lib/backend', () => backend);

import { askPermission, notifAvailability, skipPermission, syncPermissionFromBrowser } from '../src/lib/notify';
import { registerPush, syncPushSub } from '../src/lib/push';
import { flushQueue, logEvent } from '../src/lib/firebase';
import { finishExplanation, submitAnswer } from '../src/lib/practice';
import { App } from '../src/App';
import { REASSURE } from '../src/pages/NotifStep';

const events = () => getItem<AppEvent[]>('event_queue', []);
const UA = { iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1', android: 'Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile', desktop: navigator.userAgent };

/** 模擬瀏覽器的通知能力：permission 是目前狀態，answer 是使用者在權限框按的結果 */
function mockBrowser(opts: { ua?: string; standalone?: boolean; permission?: NotificationPermission; answer?: NotificationPermission; supported?: boolean } = {}) {
  const { ua = UA.desktop, standalone = false, permission = 'default', answer = 'granted', supported = true } = opts;
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua);
  Object.defineProperty(navigator, 'standalone', { value: standalone, configurable: true });
  const state = { permission };
  const requestPermission = vi.fn(async () => {
    state.permission = answer;
    return answer;
  });
  if (supported) {
    vi.stubGlobal('Notification', { get permission() { return state.permission; }, requestPermission });
    vi.stubGlobal('PushManager', function PushManager() {});
    Object.defineProperty(navigator, 'serviceWorker', { value: { ready: Promise.resolve({}) }, configurable: true });
  } else {
    // @ts-expect-error 測試：移除通知 API
    delete window.Notification;
    // @ts-expect-error 測試：移除 PushManager
    delete window.PushManager;
  }
  return { state, requestPermission };
}

function configureFirebase() {
  vi.stubEnv('VITE_FIREBASE_API_KEY', 'test-key');
  vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'demo-softskill');
  vi.stubEnv('VITE_FIREBASE_APP_ID', '1:1:web:1');
  vi.stubEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', '1');
}

beforeEach(() => {
  Object.values(backend).forEach((f) => f.mockClear());
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('notifAvailability', () => {
  it('iPhone 沒從主畫面開啟 → 要先加入主畫面（不請求權限）', () => {
    mockBrowser({ ua: UA.iphone, standalone: false });
    expect(notifAvailability()).toBe('ios_needs_install');
  });
  it('iPhone 從主畫面開啟 → 可以請求', () => {
    mockBrowser({ ua: UA.iphone, standalone: true });
    expect(notifAvailability()).toBe('supported');
  });
  it('沒有 Notification／PushManager → 不支援', () => {
    mockBrowser({ supported: false });
    expect(notifAvailability()).toBe('unsupported');
  });
});

describe('askPermission', () => {
  it('允許：存 granted、記 notif_permission（含 platform、standalone）', async () => {
    const { requestPermission } = mockBrowser({ ua: UA.android, answer: 'granted' });
    expect(await askPermission()).toBe('granted');
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(getItem('notif_status', null)).toBe('granted');
    expect(events().at(-1)).toMatchObject({ type: 'notif_permission', permission: 'granted', platform: 'android', standalone: false });
  });

  it('拒絕後再按也不會再跳系統權限框', async () => {
    const { requestPermission } = mockBrowser({ answer: 'denied' });
    expect(await askPermission()).toBe('denied');
    expect(await askPermission()).toBe('denied');
    expect(requestPermission).toHaveBeenCalledTimes(1);
  });

  it('不支援：記 unsupported，不呼叫任何權限 API', async () => {
    mockBrowser({ supported: false });
    expect(await askPermission()).toBe('unsupported');
    expect(events().at(-1)).toMatchObject({ permission: 'unsupported' });
  });

  it('iPhone 未加入主畫面：不請求權限', async () => {
    const { requestPermission } = mockBrowser({ ua: UA.iphone, standalone: false });
    expect(await askPermission()).toBe('default');
    expect(requestPermission).not.toHaveBeenCalled();
    expect(events().at(-1)).toMatchObject({ permission: 'ios_needs_install', platform: 'ios', standalone: false });
  });

  it('「先不要」記 skipped，狀態仍是 default，之後還能再開', () => {
    mockBrowser();
    expect(skipPermission('skipped')).toBe('default');
    expect(events().at(-1)).toMatchObject({ type: 'notif_permission', permission: 'skipped' });
  });

  it('使用者到系統設定改成允許：首頁開啟時同步回來（只讀，不跳框）', () => {
    const { state, requestPermission } = mockBrowser({ permission: 'denied' });
    setItem('notif_status', 'denied');
    state.permission = 'granted';
    expect(syncPermissionFromBrowser()).toBe('granted');
    expect(requestPermission).not.toHaveBeenCalled();
  });
});

describe('push_subs（後端 mock）', () => {
  it('沒設定 Firebase：什麼都不送', async () => {
    mockBrowser();
    setItem('notif_status', 'granted');
    expect(await registerPush()).toBe(false);
    expect(await syncPushSub({ reminder_time: '08:00' })).toBe(false);
    expect(backend.savePushSub).not.toHaveBeenCalled();
  });

  it('允許通知後：取得 FCM token，寫入 push_subs/{uid}', async () => {
    configureFirebase();
    mockBrowser();
    setItem('notif_status', 'granted');
    setItem('reminder_time', '21:30');
    expect(await registerPush()).toBe(true);
    expect(backend.savePushSub).toHaveBeenCalledWith('uid-123', {
      fcm_token: 'fcm-token-abc',
      reminder_time: '21:30',
      timezone: 'Asia/Taipei',
    });
  });

  it('沒開通知時不寫 push_subs', async () => {
    configureFirebase();
    setItem('notif_status', 'denied');
    expect(await syncPushSub({ reminder_time: '08:00' })).toBe(false);
    expect(backend.savePushSub).not.toHaveBeenCalled();
  });

  it('只做 2 題不更新 last_completed_date；3 題都完成才更新', async () => {
    configureFirebase();
    setItem('notif_status', 'granted');
    setItem('journey_start', '2026-11-16');
    const now = new Date('2026-11-16T04:00:00Z');
    for (let i = 0; i < 2; i++) {
      submitAnswer('B', now);
      finishExplanation(now);
    }
    await new Promise((r) => setTimeout(r, 0));
    expect(backend.savePushSub.mock.calls.some(([, f]) => 'last_completed_date' in f)).toBe(false);
    submitAnswer('B', now);
    finishExplanation(now);
    await vi.waitFor(() => expect(backend.savePushSub).toHaveBeenCalledWith('uid-123', { last_completed_date: '2026-11-16' }));
  });
});

describe('事件補送（後端 mock）', () => {
  it('沒設定 Firebase：事件留在 event_queue', async () => {
    logEvent({ type: 'commit' });
    expect(await flushQueue()).toBe(0);
    expect(events()).toHaveLength(1);
    expect(backend.addEvent).not.toHaveBeenCalled();
  });

  it('有設定：補送並帶上匿名 uid，送完清空佇列', async () => {
    configureFirebase();
    setItem('event_queue', [
      { device_id: 'd', uid: null, type: 'commit', platform: 'ios', standalone: true, ts: '2026-11-16T00:00:00.000Z' },
      { device_id: 'd', uid: null, type: 'answer', platform: 'ios', standalone: true, ts: '2026-11-16T00:01:00.000Z' },
    ]);
    expect(await flushQueue()).toBe(2);
    expect(backend.addEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'commit', uid: 'uid-123' }));
    expect(events()).toEqual([]);
  });

  it('送到一半失敗（斷線）：已送的移除，沒送的留著下次補', async () => {
    configureFirebase();
    backend.addEvent.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('offline'));
    setItem('event_queue', [
      { device_id: 'd', uid: null, type: 'commit', platform: 'ios', standalone: true, ts: 'a' },
      { device_id: 'd', uid: null, type: 'answer', platform: 'ios', standalone: true, ts: 'b' },
    ]);
    expect(await flushQueue()).toBe(1);
    expect(events().map((e) => e.ts)).toEqual(['b']);
  });

  it('瀏覽器離線時不嘗試送', async () => {
    configureFirebase();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    setItem('event_queue', [{ device_id: 'd', uid: null, type: 'commit', platform: 'ios', standalone: true, ts: 'a' }]);
    expect(await flushQueue()).toBe(0);
    expect(backend.ensureUser).not.toHaveBeenCalled();
  });
});

describe('擊掌後的通知步驟（畫面）', () => {
  const toNotif = () => {
    setItem('pain_points', ['unsure']);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /擊掌/ }));
    fireEvent.click(screen.getByRole('button', { name: '開始第一題' }));
  };

  it('文案說明不是行銷推播；允許 → 設定好了 → 進第一題', async () => {
    mockBrowser({ answer: 'granted' });
    toNotif();
    expect(screen.getByRole('heading', { name: '要讓雲朵夥伴每天提醒你嗎？' })).toBeInTheDocument();
    expect(screen.getByText(/提醒是為了陪你一起完成 30 天，不是行銷推播/)).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '開啟提醒' })));
    expect(screen.getByRole('heading', { name: '設定好了！' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '開始第一題' }));
    expect(await screen.findByRole('heading', { name: '今天的練習' })).toBeInTheDocument();
  });

  it('拒絕 → 安撫文案 → 不擋流程進第一題', async () => {
    mockBrowser({ answer: 'denied' });
    toNotif();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '開啟提醒' })));
    expect(screen.getByRole('status')).toHaveTextContent(REASSURE);
    expect(REASSURE).toBe('沒關係，還是可以開始；今天沒練的話，回到 App 也會看到提醒。');
    fireEvent.click(screen.getByRole('button', { name: '開始第一題' }));
    expect(await screen.findByRole('heading', { name: '今天的練習' })).toBeInTheDocument();
  });

  it('不支援 → 直接顯示安撫文案，不跳任何框', async () => {
    mockBrowser({ supported: false });
    toNotif();
    expect(screen.getByRole('status')).toHaveTextContent(REASSURE);
    expect(screen.getByText('這個瀏覽器不支援系統通知。')).toBeInTheDocument();
  });

  it('iPhone 未加入主畫面 → 顯示加入主畫面教學，不請求權限', () => {
    const { requestPermission } = mockBrowser({ ua: UA.iphone, standalone: false });
    toNotif();
    expect(screen.getByRole('heading', { name: 'iPhone 要先加入主畫面' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: '加入主畫面的步驟' })).toHaveTextContent('分享');
    expect(screen.getByRole('list', { name: '加入主畫面的步驟' })).toHaveTextContent('加入主畫面');
    fireEvent.click(screen.getByRole('button', { name: '我知道了，先開始第一題' }));
    expect(requestPermission).not.toHaveBeenCalled();
  });
});

describe('首頁的後備提醒與通知入口', () => {
  beforeEach(() => {
    setItem('pain_points', ['unsure']);
    setItem('committed_at', '2026-11-16T03:00:00.000Z');
    setItem('journey_start', '2026-11-16');
    setItem('reminder_time', '20:00');
  });

  it('今天沒完成：顯示「今天的 5 分鐘還沒練」橫幅', () => {
    mockBrowser();
    render(<App />);
    expect(screen.getByText('今天的 5 分鐘還沒練')).toBeInTheDocument();
  });

  it('被拒絕：說明怎麼到系統設定打開，沒有會跳框的按鈕', () => {
    mockBrowser({ ua: UA.iphone, standalone: true, permission: 'denied' });
    setItem('notif_status', 'denied');
    render(<App />);
    const state = screen.getByTestId('notif-state');
    expect(state).toHaveTextContent('系統通知目前是關閉的');
    expect(state).toHaveTextContent('打開 iPhone 的「設定」');
    expect(screen.queryByRole('button', { name: '開啟通知' })).not.toBeInTheDocument();
  });

  it('先不要／還沒開：提供「開啟通知」入口', async () => {
    const { requestPermission } = mockBrowser({ answer: 'granted' });
    setItem('notif_status', 'default');
    render(<App />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '開啟通知' })));
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('notif-state')).toHaveTextContent('系統通知已開啟');
  });

  it('iPhone 未加入主畫面：提供加入主畫面教學', () => {
    mockBrowser({ ua: UA.iphone, standalone: false });
    setItem('notif_status', 'default');
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '看怎麼加入主畫面' }));
    expect(screen.getByRole('list', { name: '加入主畫面的步驟' })).toBeInTheDocument();
  });
});
