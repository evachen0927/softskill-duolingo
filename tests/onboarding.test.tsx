import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { App } from '../src/App';
import { getItem, setItem } from '../src/lib/storage';
import { togglePain, getStage, PAIN_POINTS, REMINDER_OPTIONS, commit } from '../src/lib/onboarding';
import { eventsCSV, localDataCSV, toCSV } from '../src/lib/exporter';
import type { AppEvent } from '../src/lib/firebase';

const events = () => getItem<AppEvent[]>('event_queue', []);
const go = (hash: string) =>
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('4.1 痛點選擇：規則', () => {
  it('可複選；「還不確定」和其他項互斥（兩個方向都成立）', () => {
    let s = togglePain([], 'no_structure');
    s = togglePain(s, 'bad_news');
    expect(s).toEqual(['no_structure', 'bad_news']);
    s = togglePain(s, 'unsure');
    expect(s).toEqual(['unsure']);
    s = togglePain(s, 'disagree');
    expect(s).toEqual(['disagree']);
    expect(togglePain(['disagree'], 'disagree')).toEqual([]); // 再點一次取消
  });

  it('六個選項文案照規格，不顯示括號內的內部對應', () => {
    expect(PAIN_POINTS.map((p) => p.label)).toEqual([
      '想法很多，但講出來沒重點、沒邏輯',
      '被主管突然提問，臨場講不快、講不準',
      '要報告壞消息或進度落後，不知道怎麼開口',
      '請主管做決定時，講不清楚利弊',
      '想提出不同意見，怕被覺得頂撞',
      '想練，可是沒地方練、也沒人糾正我',
    ]);
    PAIN_POINTS.forEach((p) => expect(p.label).not.toMatch(/對應|白板|學習路徑/));
  });
});

describe('4.1 痛點選擇：畫面', () => {
  it('第一次開啟必經此步，用網址也跳不到首頁或其他 tab，也沒有底部 tab', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: '你在職場溝通上，最常卡在哪裡？' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: '主要導覽' })).not.toBeInTheDocument();
    for (const h of ['#/', '#/library', '#/practice', '#/me']) {
      go(h);
      expect(screen.getByRole('heading', { name: '你在職場溝通上，最常卡在哪裡？' })).toBeInTheDocument();
    }
  });

  it('選項一次呈現；沒選不能繼續；選完存 id、記 onboarding_done', () => {
    render(<App />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(7);
    const next = screen.getByRole('button', { name: '下一步' });
    expect(next).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: '要報告壞消息或進度落後，不知道怎麼開口' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '想提出不同意見，怕被覺得頂撞' }));
    expect(next).toBeEnabled();
    fireEvent.click(next);

    expect(getItem('pain_points', [])).toEqual(['bad_news', 'disagree']);
    expect(events().map((e) => e.type)).toEqual(['onboarding_done']);
    expect(screen.getByRole('heading', { name: '跟雲朵夥伴約定好，一起練' })).toBeInTheDocument();
  });

  it('畫面上點「還不確定」會取消其他項', () => {
    render(<App />);
    const a = screen.getByRole('checkbox', { name: '想法很多，但講出來沒重點、沒邏輯' });
    const unsure = screen.getByRole('checkbox', { name: '還不確定，先從基礎開始' });
    fireEvent.click(a);
    fireEvent.click(unsure);
    expect(a).toHaveAttribute('aria-checked', 'false');
    expect(unsure).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(a);
    expect(unsure).toHaveAttribute('aria-checked', 'false');
  });
});

describe('4.2 擊掌承諾（不含通知）', () => {
  const toCommit = () => {
    setItem('pain_points', ['unsure']);
    render(<App />);
  };

  it('雲朵夥伴在場、寫出「每天約 5 分鐘、一起練 30 天」、預設提醒 20:00、每 15 分鐘一格', () => {
    toCommit();
    expect(screen.getByText('每天約 5 分鐘、一起練 30 天')).toBeInTheDocument();
    expect(screen.getByTestId('buddy')).toHaveAttribute('data-name', 'orca-idle');
    expect(screen.getByLabelText('每天幾點提醒你？')).toHaveValue('20:00');
    expect(REMINDER_OPTIONS).toHaveLength(96);
    expect(REMINDER_OPTIONS.every((t) => /^\d\d:(00|15|30|45)$/.test(t))).toBe(true);
  });

  it('沒擊掌前沒有「開始第一題」，也沒存承諾', () => {
    toCommit();
    expect(screen.queryByRole('button', { name: '開始第一題' })).not.toBeInTheDocument();
    expect(screen.getByText('擊掌之後才能開始')).toBeInTheDocument();
    expect(getItem('committed_at', null)).toBeNull();
    expect(getStage()).toBe('commit');
  });

  it('點擊擊掌：換成 highfive 圖、震動、存承諾與時間、記 commit 事件，之後才能開始第一題', async () => {
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { ...navigator, vibrate, userAgent: navigator.userAgent, maxTouchPoints: 0 });
    toCommit();
    fireEvent.change(screen.getByLabelText('每天幾點提醒你？'), { target: { value: '07:45' } });
    fireEvent.click(screen.getByRole('button', { name: '跟雲朵夥伴擊掌' }));

    const btn = screen.getByRole('button', { name: '已和雲朵夥伴擊掌' });
    expect(screen.getByTestId('buddy')).toHaveAttribute('data-name', 'orca-highfive');
    expect(screen.getByTestId('buddy')).toHaveClass('highfive', 'no-blink'); // 閉眼不眨
    expect(screen.getByRole('status')).toHaveTextContent('擊掌成功');
    expect(vibrate).toHaveBeenCalled();
    expect(getItem('reminder_time', '')).toBe('07:45');
    expect(getItem('committed_at', null)).not.toBeNull();
    expect(screen.getByLabelText('每天幾點提醒你？')).toBeDisabled();

    // 再點一次不會重複記事件
    fireEvent.click(btn);
    expect(events().filter((e) => e.type === 'commit')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: '開始第一題' }));
    // 第 4 批：擊掌後先到通知權限步驟（這個測試環境不支援通知 → 直接顯示安撫文案）
    expect(screen.getByRole('status')).toHaveTextContent('沒關係，還是可以開始');
    fireEvent.click(screen.getByRole('button', { name: '開始第一題' }));
    expect(window.location.hash).toBe('#/practice');
    expect(await screen.findByRole('heading', { name: '今天的練習' })).toBeInTheDocument();
    // 出題畫面照設計不放底部 tab，改由左上角回首頁
    expect(screen.getByRole('link', { name: '回到首頁' })).toHaveAttribute('href', '#/');
  });

  it('滑動也能擊掌（只記一次）', () => {
    toCommit();
    const btn = screen.getByRole('button', { name: '跟雲朵夥伴擊掌' });
    fireEvent.pointerDown(btn, { clientX: 100, clientY: 100 });
    expect(screen.getByTestId('buddy')).toHaveAttribute('data-name', 'orca-raise');
    fireEvent.pointerMove(btn, { clientX: 160, clientY: 90 });
    fireEvent.pointerUp(btn, { clientX: 160, clientY: 90 });
    fireEvent.click(btn);
    expect(screen.getByRole('button', { name: '已和雲朵夥伴擊掌' })).toBeInTheDocument();
    expect(events().filter((e) => e.type === 'commit')).toHaveLength(1);
  });

  it('沒有 navigator.vibrate 的瀏覽器（例如 iOS Safari）也能擊掌', () => {
    vi.stubGlobal('navigator', { ...navigator, vibrate: undefined, userAgent: navigator.userAgent, maxTouchPoints: 0 });
    toCommit();
    fireEvent.click(screen.getByRole('button', { name: '跟雲朵夥伴擊掌' }));
    expect(screen.getByRole('button', { name: '開始第一題' })).toBeInTheDocument();
  });

  it('journey_start 用台北日期：UTC 16:30 已經是台北隔天', () => {
    commit('20:00', new Date('2026-11-16T16:30:00Z'));
    expect(getItem('journey_start', '')).toBe('2026-11-17');
    expect(getItem('committed_at', '')).toBe('2026-11-16T16:30:00.000Z');
  });
});

describe('持久化與 #/debug', () => {
  it('重新整理後引導狀態仍在：做到一半回到承諾頁；做完直接到首頁', () => {
    setItem('pain_points', ['impromptu']);
    const { unmount } = render(<App />);
    expect(screen.getByRole('heading', { name: '跟雲朵夥伴約定好，一起練' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '跟雲朵夥伴擊掌' }));
    unmount();

    render(<App />); // 模擬重新開啟
    expect(screen.getByRole('heading', { name: '軟實力多鄰國' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '首頁' })).toHaveAttribute('aria-current', 'page');
  });

  it('#/debug 清除資料要按兩次，清除後重新進入引導', async () => {
    setItem('pain_points', ['unsure']);
    setItem('committed_at', '2026-11-16T12:00:00.000Z');
    render(<App />);
    go('#/debug');
    expect(screen.getByTestId('debug-dump')).toHaveTextContent('pain_points');

    fireEvent.click(screen.getByRole('button', { name: '清除全部本機資料' }));
    expect(getItem('pain_points', null)).not.toBeNull(); // 第一次只是確認
    fireEvent.click(screen.getByRole('button', { name: '再按一次，確定清除' }));

    expect(getItem('pain_points', null)).toBeNull();
    expect(window.location.hash).toBe('#/');
    expect(await screen.findByRole('heading', { name: '你在職場溝通上，最常卡在哪裡？' })).toBeInTheDocument();
  });

  it('#/debug 在引導中也進得去', () => {
    render(<App />);
    go('#/debug');
    expect(screen.getByRole('heading', { name: 'Debug' })).toBeInTheDocument();
  });
});

describe('匯出 CSV', () => {
  it('跳脫逗號、引號、換行', () => {
    expect(toCSV(['a', 'b'], [['x,y', 'say "hi"\nok']])).toBe('a,b\r\n"x,y","say ""hi""\nok"\r\n');
  });

  it('事件 CSV 欄位固定，一列一個事件', () => {
    const csv = eventsCSV([
      { device_id: 'd1', uid: null, type: 'commit', platform: 'ios', standalone: true, ts: '2026-11-16T12:00:00.000Z' },
    ]);
    const [header, row] = csv.trim().split('\r\n');
    expect(header).toBe('device_id,uid,type,question_id,choice,correct,feedback,slot,review,permission,platform,standalone,ts');
    expect(row).toBe('d1,,commit,,,,,,,,ios,true,2026-11-16T12:00:00.000Z');
  });

  it('本機資料 CSV 一列一個 key，不重複放事件', () => {
    const csv = localDataCSV({ pain_points: ['unsure'], reminder_time: '20:00', event_queue: [{}] });
    expect(csv).toBe('key,value_json\r\npain_points,"[""unsure""]"\r\nreminder_time,"""20:00"""\r\n');
  });
});
