import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { currentStreak, journeyCompleted, monthGrid } from '../src/lib/progress';
import { addDays } from '../src/lib/date';
import { setItem, getItem } from '../src/lib/storage';
import type { Completions } from '../src/lib/practice';
import { App } from '../src/App';

const ANS = [{ question_id: 'q001', choice: 'B', correct: true }];
/** 建立 completions：done 的日子 3 題、partial 的日子只做 2 題 */
function build(done: string[], partial: string[] = []): Completions {
  const c: Completions = {};
  for (const d of done) c[d] = { answers: [ANS[0], ANS[0], ANS[0]], done: true };
  for (const d of partial) c[d] = { answers: [ANS[0], ANS[0]], done: false };
  return c;
}

describe('連勝（currentStreak）', () => {
  it('連續 3 天（含今天）= 3', () => {
    expect(currentStreak(build(['2026-11-14', '2026-11-15', '2026-11-16']), '2026-11-16')).toBe(3);
  });

  it('今天還沒做：從昨天往回算，不算中斷', () => {
    expect(currentStreak(build(['2026-11-14', '2026-11-15']), '2026-11-16')).toBe(2);
  });

  it('今天只做 2 題：今天不算，連勝仍是昨天以前的天數', () => {
    const c = build(['2026-11-14', '2026-11-15'], ['2026-11-16']);
    expect(currentStreak(c, '2026-11-16')).toBe(2);
  });

  it('只做 2 題的日子會中斷連勝', () => {
    const c = build(['2026-11-13', '2026-11-15'], ['2026-11-14']);
    expect(currentStreak(c, '2026-11-15')).toBe(1);
  });

  it('中斷一天後重來：歸零，隔天再完成從 1 開始', () => {
    const c = build(['2026-11-10', '2026-11-11', '2026-11-12']); // 11/13 沒練
    expect(currentStreak(c, '2026-11-14')).toBe(0); // 昨天(11/13)沒做 → 0
    c['2026-11-14'] = { answers: [ANS[0], ANS[0], ANS[0]], done: true };
    expect(currentStreak(c, '2026-11-14')).toBe(1);
    c['2026-11-15'] = { answers: [ANS[0], ANS[0], ANS[0]], done: true };
    expect(currentStreak(c, '2026-11-15')).toBe(2);
  });

  it('跨月：10/30、10/31、11/1 連續 = 3', () => {
    expect(currentStreak(build(['2026-10-30', '2026-10-31', '2026-11-01']), '2026-11-01')).toBe(3);
  });

  it('跨年：12/30、12/31、1/1 連續 = 3；1/2 還沒做也維持 3', () => {
    const c = build(['2026-12-30', '2026-12-31', '2027-01-01']);
    expect(currentStreak(c, '2027-01-01')).toBe(3);
    expect(currentStreak(c, '2027-01-02')).toBe(3);
    expect(currentStreak(c, '2027-01-03')).toBe(0);
  });

  it('STREAK_RESET_ON_MISS = false 時，缺的日子不歸零（保留給之後的寬限規則）', () => {
    const c = build(['2026-11-10', '2026-11-12']);
    expect(currentStreak(c, '2026-11-12', false)).toBe(2);
    expect(currentStreak(c, '2026-11-12', true)).toBe(1);
  });
});

describe('已完成 X／30（journeyCompleted）', () => {
  const start = '2026-11-16';
  it('只算 journey_start 起 30 天內、done 的日子', () => {
    const c = build(['2026-11-16', '2026-11-17', '2026-11-20'], ['2026-11-18']);
    expect(journeyCompleted(c, start)).toBe(3);
  });

  it('第 30 天算、第 31 天不算；開始日之前也不算', () => {
    const day30 = addDays(start, 29); // 2026-12-15
    const day31 = addDays(start, 30); // 2026-12-16
    expect(day30).toBe('2026-12-15');
    const c = build(['2026-11-15', start, day30, day31]);
    expect(journeyCompleted(c, start)).toBe(2);
  });

  it('沒有 journey_start 時是 0', () => {
    expect(journeyCompleted(build(['2026-11-16']), null)).toBe(0);
  });
});

describe('當月日曆（monthGrid）', () => {
  it('2026 年 11 月：週日開頭，30 天，完成日與今天標記正確', () => {
    const g = monthGrid(build(['2026-11-02', '2026-11-16']), '2026-11-16');
    expect(g).toMatchObject({ year: 2026, month: 11 });
    const cells = g.weeks.flat().filter(Boolean);
    expect(cells).toHaveLength(30);
    expect(g.weeks[0][0]!.date).toBe('2026-11-01'); // 2026/11/1 是週日
    expect(cells.filter((x) => x!.done).map((x) => x!.date)).toEqual(['2026-11-02', '2026-11-16']);
    expect(cells.find((x) => x!.isToday)!.date).toBe('2026-11-16');
    expect(cells.find((x) => x!.date === '2026-11-17')!.isFuture).toBe(true);
  });

  it('只做 2 題的日子不打勾', () => {
    const g = monthGrid(build([], ['2026-11-10']), '2026-11-16');
    expect(g.weeks.flat().find((x) => x?.date === '2026-11-10')!.done).toBe(false);
  });

  it('第一次使用之前的日子標成 beforeStart，當天和之後不是', () => {
    const g = monthGrid({}, '2026-11-16', '2026-11-16');
    const cells = g.weeks.flat().filter((x) => x);
    expect(cells.find((x) => x!.date === '2026-11-15')!.beforeStart).toBe(true);
    expect(cells.find((x) => x!.date === '2026-11-16')!.beforeStart).toBe(false);
    expect(cells.find((x) => x!.date === '2026-11-17')!.beforeStart).toBe(false);
    expect(cells.find((x) => x!.date === '2026-11-17')!.isFuture).toBe(true);
  });

  it('跨年的 1 月：2027/1/1 是週五，前面補 5 格', () => {
    const g = monthGrid({}, '2027-01-01');
    expect(g.weeks[0].slice(0, 5)).toEqual([null, null, null, null, null]);
    expect(g.weeks[0][5]!.date).toBe('2027-01-01');
    expect(g.weeks.flat().filter(Boolean)).toHaveLength(31);
  });
});

describe('首頁畫面（假時間：台北 2026-11-16 21:00）', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-16T13:00:00Z'));
    setItem('pain_points', ['unsure']);
    setItem('committed_at', '2026-11-14T03:00:00.000Z');
    setItem('journey_start', '2026-11-14');
    setItem('reminder_time', '20:00');
  });
  afterEach(() => vi.useRealTimers());

  it('今天還沒做：顯示入口「今天 0/3」、連勝從昨天算、已完成 2／30、日曆標記', () => {
    setItem('completions', build(['2026-11-14', '2026-11-15']));
    render(<App />);
    expect(screen.getByText('今天 0/3')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '開始今天的練習' })).toHaveAttribute('href', '#/practice');
    expect(screen.getByTestId('streak')).toHaveTextContent('2');
    expect(screen.getByTestId('journey')).toHaveTextContent('已完成 2／30');
    expect(screen.getByRole('heading', { name: '2026 年 11 月' })).toBeInTheDocument();
    expect(screen.getByLabelText('11 月 15 日，已完成')).toBeInTheDocument();
    expect(screen.getByLabelText('11 月 16 日，今天')).toBeInTheDocument();
    expect(screen.getByLabelText('11 月 13 日，開始使用前')).toHaveAttribute('data-before-start', 'true');
    expect(screen.getByLabelText('11 月 13 日，開始使用前')).not.toHaveAttribute('data-done');
  });

  it('今天只做 2 題：「今天 2/3」＋「繼續練習」，連勝和 X／30 不算今天', () => {
    setItem('completions', build(['2026-11-14', '2026-11-15'], ['2026-11-16']));
    render(<App />);
    expect(screen.getByText('今天 2/3')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '繼續練習' })).toBeInTheDocument();
    expect(screen.getByTestId('streak')).toHaveTextContent('2');
    expect(screen.getByTestId('journey')).toHaveTextContent('已完成 2／30');
    expect(screen.getByLabelText('11 月 16 日，今天')).not.toHaveAttribute('data-done');
  });

  it('今天完成：顯示完成狀態、沒有練習入口、連勝 3、日曆今天打勾', () => {
    setItem('completions', build(['2026-11-14', '2026-11-15', '2026-11-16']));
    render(<App />);
    expect(screen.getByText('今天完成了')).toBeInTheDocument();
    for (const n of ['開始今天的練習', '繼續練習']) expect(screen.queryByRole('link', { name: n })).not.toBeInTheDocument();
    expect(screen.getByTestId('streak')).toHaveTextContent('3');
    expect(screen.getByTestId('journey')).toHaveTextContent('已完成 3／30');
    expect(screen.getByLabelText('11 月 16 日，今天，已完成')).toHaveAttribute('data-done', 'true');
  });

  it('未完成的日子不放有壓力的文案', () => {
    setItem('completions', build(['2026-11-10']));
    render(<App />);
    // 日曆和連勝區（「今天的 5 分鐘還沒練」橫幅是規格 4.3 指定的後備提醒，不在此限）
    const text = screen.getByRole('region', { name: '進度' }).textContent! + screen.getByRole('grid').textContent!;
    for (const w of ['錯過', '中斷', '失敗', '沒練', '可惜', '斷了']) expect(text).not.toContain(w);
    expect(screen.getByTestId('streak')).toHaveTextContent('0');
    expect(screen.getByText('今天練完就開始累積')).toBeInTheDocument();
  });

  it('第 31 天：已完成 X／30 不再增加', () => {
    vi.setSystemTime(new Date('2026-12-14T13:00:00Z')); // 2026-12-14 = 旅程第 31 天
    const days = Array.from({ length: 31 }, (_, i) => addDays('2026-11-14', i));
    setItem('completions', build(days));
    render(<App />);
    expect(screen.getByTestId('journey')).toHaveTextContent('已完成 30／30');
    expect(screen.getByTestId('streak')).toHaveTextContent('31');
  });

  it('修改提醒時間：可改、可取消，儲存後寫入 reminder_time', () => {
    render(<App />);
    const section = screen.getByRole('region', { name: '提醒設定' });
    expect(within(section).getByTestId('reminder-time')).toHaveTextContent('20:00');

    fireEvent.click(within(section).getByRole('button', { name: '修改時間' }));
    fireEvent.change(within(section).getByLabelText('每天幾點提醒你？'), { target: { value: '08:15' } });
    fireEvent.click(within(section).getByRole('button', { name: '取消' }));
    expect(within(section).getByTestId('reminder-time')).toHaveTextContent('20:00');
    expect(getItem('reminder_time', '')).toBe('20:00');

    fireEvent.click(within(section).getByRole('button', { name: '修改時間' }));
    fireEvent.change(within(section).getByLabelText('每天幾點提醒你？'), { target: { value: '08:15' } });
    fireEvent.click(within(section).getByRole('button', { name: '儲存' }));
    expect(within(section).getByTestId('reminder-time')).toHaveTextContent('08:15');
    expect(within(section).getByRole('status')).toHaveTextContent('已改成 08:15');
    expect(getItem('reminder_time', '')).toBe('08:15');
  });

  it('資料存在本機，重新開啟後仍在', () => {
    setItem('completions', build(['2026-11-15', '2026-11-16']));
    const { unmount } = render(<App />);
    unmount();
    render(<App />);
    expect(screen.getByTestId('streak')).toHaveTextContent('2');
  });
});
