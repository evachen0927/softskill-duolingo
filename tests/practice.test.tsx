import { describe, it, expect, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { App } from '../src/App';
import { getItem, setItem } from '../src/lib/storage';
import { todayStr } from '../src/lib/date';
import {
  finishExplanation, getPracticeState, sceneBrightness, setFeedback, submitAnswer, getCompletions,
} from '../src/lib/practice';
import { pickQuestions } from '../src/lib/dailySet';
import type { AppEvent } from '../src/lib/firebase';

/** 第 1 題有方塊上司出場動畫（480ms＋120ms），等它播完選項才能點 */
async function render(ui: Parameters<typeof rtlRender>[0]) {
  const r = rtlRender(ui);
  await waitFor(() => expect(screen.queryByTestId('boss-enter')).toBeNull(), { timeout: 2000 });
  return r;
}

const DAY1 = new Date('2026-11-16T04:00:00Z'); // 台北 11/16 12:00，旅程第 1 天
const events = () => getItem<AppEvent[]>('event_queue', []);

function onboarded(start = '2026-11-16') {
  setItem('pain_points', ['unsure']);
  setItem('committed_at', '2026-11-16T03:00:00.000Z');
  setItem('journey_start', start);
  setItem('reminder_time', '20:00');
}

describe('practice.ts：一天 3 題的完成規則', () => {
  beforeEach(() => onboarded());

  it('做完 1、2 題不算完成，做完 3 題才算完成', () => {
    submitAnswer('B', DAY1);
    expect(finishExplanation(DAY1)).toEqual({ done: false });
    expect(getCompletions()['2026-11-16'].done).toBe(false);

    submitAnswer('C', DAY1);
    expect(finishExplanation(DAY1)).toEqual({ done: false });
    expect(getCompletions()['2026-11-16']).toEqual({
      answers: [
        { question_id: 'q001', choice: 'B', correct: true },
        { question_id: 'q002', choice: 'C', correct: false },
      ],
      done: false,
    });
    expect(events().some((e) => e.type === 'day_complete')).toBe(false);

    submitAnswer('B', DAY1);
    expect(finishExplanation(DAY1)).toEqual({ done: true });
    expect(getCompletions()['2026-11-16'].done).toBe(true);
    expect(events().filter((e) => e.type === 'day_complete')).toHaveLength(1);
  });

  it('作答但沒看完解析，不會加進 answers', () => {
    submitAnswer('A', DAY1);
    expect(getCompletions()['2026-11-16'].answers).toEqual([]);
    expect(getPracticeState(DAY1).index).toBe(0);
  });

  it('中途離開再回來，從下一題繼續，做過的不重出', () => {
    submitAnswer('B', DAY1);
    finishExplanation(DAY1);
    const later = new Date('2026-11-16T12:00:00Z'); // 同一天晚上 8 點
    const s = getPracticeState(later);
    expect(s.index).toBe(1);
    expect(s.set.question_ids[s.index]).toBe('q002');
    expect(s.pending).toBeNull();
  });

  it('作答後離開（解析沒看完）再回來：停在同一題的解析，選項不能改', () => {
    submitAnswer('D', DAY1);
    const s = getPracticeState(DAY1);
    expect(s.index).toBe(0);
    expect(s.pending).toMatchObject({ question_id: 'q001', choice: 'D', correct: false, slot: 1 });
    // 再送一次別的答案會被忽略
    expect(submitAnswer('B', DAY1)).toMatchObject({ choice: 'D' });
    expect(events().filter((e) => e.type === 'answer')).toHaveLength(1);
  });

  it('今天完成後不再出題', () => {
    for (let i = 0; i < 3; i++) {
      submitAnswer('B', DAY1);
      finishExplanation(DAY1);
    }
    expect(getPracticeState(DAY1).done).toBe(true);
    expect(() => submitAnswer('B', DAY1)).toThrow('今天已經完成');
  });

  it('隔天（台北午夜後）是新的一天，第 2 天三題都標示複習', () => {
    for (let i = 0; i < 3; i++) {
      submitAnswer('B', DAY1);
      finishExplanation(DAY1);
    }
    const day2 = new Date('2026-11-16T16:00:00Z'); // 台北 11/17 00:00
    const s = getPracticeState(day2);
    expect(s.date).toBe('2026-11-17');
    expect(s.done).toBe(false);
    expect(s.index).toBe(0);
    expect(s.set.review).toEqual([true, true, true]);
  });

  it('事件內容：answer 與 explanation_viewed 帶 slot、review、choice、correct', () => {
    submitAnswer('C', DAY1);
    finishExplanation(DAY1);
    const [answer, viewed] = events().filter((e) => e.type === 'answer' || e.type === 'explanation_viewed');
    expect(answer).toMatchObject({ type: 'answer', question_id: 'q001', choice: 'C', correct: false, slot: 1, review: false });
    expect(viewed).toMatchObject({ type: 'explanation_viewed', question_id: 'q001', choice: 'C', correct: false, slot: 1, review: false });
  });

  it('👍👎 只保留最後一次，每次點擊都記事件且帶當時選項與對錯', () => {
    const a = { question_id: 'q001', choice: 'C', correct: false };
    setFeedback(a, 'up', DAY1);
    setFeedback(a, 'down', DAY1);
    expect(getItem('feedback', {})).toEqual({ q001: 'down' });
    const fb = events().filter((e) => e.type === 'feedback');
    expect(fb.map((e) => e.feedback)).toEqual(['up', 'down']);
    expect(fb[1]).toMatchObject({ question_id: 'q001', choice: 'C', correct: false });
  });
});

describe('背景亮度：當天從昏暗漸漸變亮', () => {
  it('3 題：第 1 題最暗、第 3 題全亮，逐題遞增', () => {
    const b = [0, 1, 2].map((i) => sceneBrightness(i, 3));
    expect(b).toEqual([0.42, 0.7, 1]);
  });
  it('題庫少於 3 題時，最後一題一樣全亮', () => {
    expect([0, 1].map((i) => sceneBrightness(i, 2))).toEqual([0.42, 1]);
    expect(sceneBrightness(0, 1)).toBe(1);
  });
  it('pickQuestions 仍照每日出題規則', () => {
    expect(pickQuestions(['a', 'b', 'c'], 1).question_ids).toEqual(['a', 'b', 'c']);
  });
});

describe('出題畫面', () => {
  beforeEach(() => {
    onboarded(todayStr());
    window.location.hash = '#/practice';
  });

  it('顯示進度 1/3、情境、四個選項、上司角色名稱、背景最暗', async () => {
    await render(<App />);
    expect(screen.getByLabelText('第 1 題，共 3 題')).toHaveTextContent('1 / 3');
    expect(screen.getByText(/週一早上的週會/)).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: '選項' })).getAllByRole('button')).toHaveLength(4);
    expect(screen.getByRole('img', { name: '方塊上司' })).toBeInTheDocument();
    expect(screen.getByText(/^方塊上司問：/).parentElement).toHaveTextContent(/^方塊上司問：官網改版那個專案現在怎樣？$/); // 對話泡泡
    expect(screen.queryByText(/部長/)).not.toBeInTheDocument();
    expect(screen.getByTestId('scene-bg')).toHaveAttribute('data-brightness', '0.42');
    expect(screen.getByTestId('scene-bg').style.backgroundImage).toContain('backgrounds/weekly-meeting.svg');
    expect(screen.queryByText('複習')).not.toBeInTheDocument();
  });

  it('點選項立刻送出、顯示解析、不能改選（沒有確認按鈕）', async () => {
    await render(<App />);
    for (const n of ['確認答案', '確認', '送出', '提交']) expect(screen.queryByRole('button', { name: n })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^C/ }));

    expect(screen.queryByRole('list', { name: '選項' })).not.toBeInTheDocument(); // 選項收起，無法再點
    expect(screen.getByRole('status')).toHaveTextContent('這題答錯了');
    expect(screen.getByTestId('boss')).toHaveAttribute('data-name', 'boss-wrong');
    expect(events().filter((e) => e.type === 'answer')).toHaveLength(1);
  });

  it('答錯的解析順序：對錯 → 所選理由 → 正解 → 其他選項一句話 → 要學的技巧', async () => {
    await render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^C/ }));
    const explain = screen.getByRole('region', { name: '解析' });
    const text = explain.textContent!;
    const order = ['這題答錯了', '你選的 C：看起來合理，但問題在這裡', '用「一點點」', '正解是 B', '正解。先講結論', '其他選項', '依時間順序講過程', '先講原因且把責任', '要學的技巧・金字塔原理', '先講結論（金字塔原理）：結論'];
    let pos = -1;
    for (const s of order) {
      const p = text.indexOf(s);
      expect(p, s).toBeGreaterThan(pos);
      pos = p;
    }
  });

  it('答對：標示答對、上司換成 boss-correct、不重複列正解', async () => {
    await render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^B/ }));
    expect(screen.getByRole('status')).toHaveTextContent('答對了！');
    expect(screen.getByTestId('boss')).toHaveAttribute('data-name', 'boss-correct');
    expect(screen.queryByText(/正解是/)).not.toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: '解析' })).getByText('其他選項').parentElement!.querySelectorAll('li')).toHaveLength(3);
  });

  it('👍👎：非必填，可改選，按鈕不顯示總數', async () => {
    await render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^B/ }));
    const up = screen.getByRole('button', { name: '有幫助' });
    const down = screen.getByRole('button', { name: '沒幫助' });
    expect(up.textContent).toBe('👍');
    expect(down.textContent).toBe('👎');
    fireEvent.click(up);
    fireEvent.click(down);
    expect(down).toHaveAttribute('aria-pressed', 'true');
    expect(up).toHaveAttribute('aria-pressed', 'false');
    expect(getItem('feedback', {})).toEqual({ q001: 'down' });
    // 不按也能往下
    fireEvent.click(screen.getByRole('button', { name: '下一題' }));
    expect(screen.getByLabelText('第 2 題，共 3 題')).toBeInTheDocument();
  });

  it('跑完 3 題：背景逐題變亮、第 3 題按鈕寫「完成」、完成後回首頁顯示完成狀態', async () => {
    await render(<App />);
    const brightness: string[] = [];
    for (let i = 1; i <= 3; i++) {
      brightness.push(screen.getByTestId('scene-bg').getAttribute('data-brightness')!);
      fireEvent.click(screen.getByRole('button', { name: /^B/ }));
      fireEvent.click(screen.getByRole('button', { name: i === 3 ? '完成' : '下一題' }));
    }
    expect(brightness).toEqual(['0.42', '0.7', '1']);
    expect(await screen.findByText('今天完成了')).toBeInTheDocument();
    expect(getCompletions()[todayStr()].done).toBe(true);
  });

  it('第 2 天：每題都標示「複習」', async () => {
    const start = new Date(Date.now() - 86_400_000);
    onboarded(todayStr(start));
    await render(<App />);
    expect(screen.getByText('複習')).toBeInTheDocument();
  });

  it('只做 2 題就離開：首頁顯示「今天 2/3」和「繼續練習」，回來從第 3 題開始', async () => {
    const { unmount } = await render(<App />);
    for (let i = 0; i < 2; i++) {
      fireEvent.click(screen.getByRole('button', { name: /^B/ }));
      fireEvent.click(screen.getByRole('button', { name: '下一題' }));
    }
    unmount();
    window.location.hash = '#/';
    const home = await render(<App />);
    expect(screen.getByText('今天 2/3')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '繼續練習' })).toHaveAttribute('href', '#/practice');
    home.unmount();
    window.location.hash = '#/practice';
    await render(<App />);
    expect(screen.getByLabelText('第 3 題，共 3 題')).toBeInTheDocument();
    expect(screen.getByText(/簡化版搜尋/)).toBeInTheDocument();
    expect(screen.getByTestId('scene-bg')).toHaveAttribute('data-brightness', '1');
  });

  it('今天完成後再進 #/practice 不會出新題', async () => {
    for (let i = 0; i < 3; i++) {
      submitAnswer('B');
      finishExplanation();
    }
    await render(<App />);
    expect(screen.getByRole('heading', { name: '今天的 3 題都完成了' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: '選項' })).not.toBeInTheDocument();
  });
});
