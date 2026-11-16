import { describe, it, expect, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { App } from '../src/App';
import { getItem, setItem } from '../src/lib/storage';
import { todayStr } from '../src/lib/date';
import {
  advanceToLearn, finishExplanation, getPracticeState, sceneBrightness, setFeedback, submitAnswer, getCompletions,
} from '../src/lib/practice';
import { pickQuestions } from '../src/lib/dailySet';
import type { AppEvent } from '../src/lib/firebase';

/** 題目畫面不再掛方塊上司。這個等待留著，避免之後又把出場動畫加回來時測試提前點擊。 */
async function render(ui: Parameters<typeof rtlRender>[0]) {
  const r = rtlRender(ui);
  await waitFor(() => expect(screen.queryByTestId('boss-enter')).toBeNull(), { timeout: 2000 });
  return r;
}

function seeBothSteps(choice: string, now = DAY1) {
  submitAnswer(choice, now);
  advanceToLearn(now);
  return finishExplanation(now);
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
    expect(seeBothSteps('B')).toEqual({ done: false });
    expect(getCompletions()['2026-11-16'].done).toBe(false);

    expect(seeBothSteps('C')).toEqual({ done: false });
    expect(getCompletions()['2026-11-16']).toEqual({
      answers: [
        { question_id: 'u1q1', choice: 'B', correct: true },
        { question_id: 'u1q2', choice: 'C', correct: false },
      ],
      done: false,
    });
    expect(events().some((e) => e.type === 'day_complete')).toBe(false);

    expect(seeBothSteps('B')).toEqual({ done: true });
    expect(getCompletions()['2026-11-16'].done).toBe(true);
    expect(events().filter((e) => e.type === 'day_complete')).toHaveLength(1);
  });

  it('只停在第 1 步不算看完，也不能把當天記完成', () => {
    submitAnswer('A', DAY1);
    expect(getCompletions()['2026-11-16'].answers).toEqual([]);
    expect(getPracticeState(DAY1).pending?.phase).toBe('result');
    expect(() => finishExplanation(DAY1)).toThrow('這題還沒到第 2 步');
    advanceToLearn(DAY1);
    expect(getCompletions()['2026-11-16'].answers).toEqual([]);
    expect(getPracticeState(DAY1).pending?.phase).toBe('learn');
    expect(getPracticeState(DAY1).index).toBe(0);
  });

  it('中途離開再回來，從下一題繼續，做過的不重出', () => {
    seeBothSteps('B');
    const later = new Date('2026-11-16T12:00:00Z'); // 同一天晚上 8 點
    const s = getPracticeState(later);
    expect(s.index).toBe(1);
    expect(s.set.question_ids[s.index]).toBe('u1q2');
    expect(s.pending).toBeNull();
  });

  it('作答後離開（解析沒看完）再回來：停在同一題的第 1 步，選項不能改', () => {
    submitAnswer('D', DAY1);
    const s = getPracticeState(DAY1);
    expect(s.index).toBe(0);
    expect(s.pending).toMatchObject({ question_id: 'u1q1', choice: 'D', correct: false, slot: 1, phase: 'result' });
    expect(submitAnswer('B', DAY1)).toMatchObject({ choice: 'D' });
    expect(events().filter((e) => e.type === 'answer')).toHaveLength(1);
  });

  it('今天完成後不再出題', () => {
    for (let i = 0; i < 3; i++) seeBothSteps('B');
    expect(getPracticeState(DAY1).done).toBe(true);
    expect(() => submitAnswer('B', DAY1)).toThrow('今天已經完成');
  });

  it('隔天是新的一天：第 2 天接既有題目，題庫繞回後才標複習', () => {
    for (let i = 0; i < 3; i++) seeBothSteps('B');
    const day2 = new Date('2026-11-16T16:00:00Z'); // 台北 11/17 00:00
    const s = getPracticeState(day2);
    expect(s.date).toBe('2026-11-17');
    expect(s.done).toBe(false);
    expect(s.index).toBe(0);
    expect(s.set.question_ids).toEqual(['q001', 'q002', 'q003']);
    expect(s.set.review).toEqual([false, false, false]);
    const day3 = new Date('2026-11-17T16:00:00Z'); // 台北 11/18 00:00
    expect(getPracticeState(day3).set.review).toEqual([true, true, true]);
    expect(getPracticeState(day3).set.question_ids).toEqual(['u1q1', 'u1q2', 'u1q3']);
  });

  it('事件內容：answer 與 explanation_viewed 帶 slot、review、choice、correct', () => {
    seeBothSteps('C');
    const [answer, viewed] = events().filter((e) => e.type === 'answer' || e.type === 'explanation_viewed');
    expect(answer).toMatchObject({ type: 'answer', question_id: 'u1q1', choice: 'C', correct: false, slot: 1, review: false });
    expect(viewed).toMatchObject({ type: 'explanation_viewed', question_id: 'u1q1', choice: 'C', correct: false, slot: 1, review: false });
    expect(viewed).not.toHaveProperty('phase');
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

  const cont = () => fireEvent.click(screen.getByRole('button', { name: '繼續' }));

  it('顯示進度 1/3、縮短情境、通知卡、第 1 題插圖，不放方塊上司', async () => {
    await render(<App />);
    expect(screen.getByLabelText('第 1 題，共 3 題')).toHaveTextContent('1 / 3');
    expect(screen.getByText(/你是主管，下班前要決定明天活動照常或延期/)).toBeInTheDocument();
    expect(screen.getByText('哪一則讓你最快能做決定？')).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: '選項' })).getAllByRole('button')).toHaveLength(4);
    const note = screen.getByText('4 則新訊息：明天活動回報').parentElement!;
    expect(note).toHaveTextContent('通知');
    expect(note).not.toHaveTextContent('同事');
    expect(note.querySelector('svg')).toHaveAttribute('width', '12');
    expect(screen.queryByRole('img', { name: '方塊上司' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('boss')).not.toBeInTheDocument();
    expect(screen.queryByText('暫定文案')).not.toBeInTheDocument();
    expect(screen.getByTestId('scene-bg')).toHaveAttribute('data-brightness', '0.42');
    expect(screen.getByTestId('scene-bg')).toHaveAttribute('src', expect.stringContaining('scenes/scene-q1.svg'));
    expect(screen.queryByText('複習')).not.toBeInTheDocument();
  });

  it('點選項立刻送出第 1 步：只留所選項和一句話，不洩漏正解', async () => {
    await render(<App />);
    for (const n of ['確認答案', '確認', '送出', '提交']) expect(screen.queryByRole('button', { name: n })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^A/ }));

    expect(screen.queryByRole('list', { name: '選項' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('這題答錯了');
    expect(screen.getByRole('status')).toHaveTextContent('讀完還不知道結論，要自己拼。');
    expect(screen.getByTestId('chosen')).toHaveTextContent('我今天下午先打給場地');
    expect(screen.queryByText(/明天可以照常/)).not.toBeInTheDocument();
    expect(screen.queryByText('要學的技巧')).not.toBeInTheDocument();
    expect(screen.queryByTestId('boss')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '繼續' })).toBeInTheDocument();
    expect(events().filter((e) => e.type === 'answer')).toHaveLength(1);
    expect(getCompletions()[todayStr()].done).toBeFalsy();
  });

  it('第 2 步才出現技巧、正解、👍👎，其他選項預設收合', async () => {
    await render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^A/ }));
    cont();
    const explain = screen.getByRole('region', { name: '解析' });
    expect(explain).toHaveTextContent('要學的技巧');
    expect(explain).toHaveTextContent('聽的人最想先知道「所以呢？」');
    expect(explain).toHaveTextContent('正解是 B');
    expect(explain).toHaveTextContent('明天可以照常');
    expect(screen.getByRole('button', { name: '其他選項' })).toHaveAttribute('aria-expanded', 'false');
    expect(explain.querySelectorAll('li')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: '其他選項' }));
    expect(screen.getByRole('button', { name: '其他選項' })).toHaveAttribute('aria-expanded', 'true');
    const items = explain.querySelectorAll('li');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('你選的');
    expect(screen.queryByText('要學的技巧')).toBeInTheDocument();
    expect(events().filter((e) => e.type === 'explanation_viewed')).toHaveLength(0);
  });

  it('答對也走兩步：第 1 步答對了，第 2 步寫你選的就是正解', async () => {
    await render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^B/ }));
    expect(screen.getByRole('status')).toHaveTextContent('答對了！');
    expect(screen.queryByText(/正解是/)).not.toBeInTheDocument();
    cont();
    expect(screen.getByRole('region', { name: '解析' })).toHaveTextContent('你選的 B，就是正解');
    expect(screen.queryByText(/正解是/)).not.toBeInTheDocument();
  });

  it('👍👎 在第 2 步：非必填，可改選，再按同一個不重送', async () => {
    await render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^B/ }));
    expect(screen.queryByRole('button', { name: '有幫助' })).not.toBeInTheDocument();
    cont();
    const up = screen.getByRole('button', { name: '有幫助' });
    const down = screen.getByRole('button', { name: '沒幫助' });
    expect(up.textContent).toBe('👍');
    expect(down.textContent).toBe('👎');
    fireEvent.click(up);
    expect(screen.getByText('收到，謝謝你！')).toBeInTheDocument();
    fireEvent.click(down);
    expect(screen.getByText('收到，我們會改這題。')).toBeInTheDocument();
    fireEvent.click(down);
    expect(down).toHaveAttribute('aria-pressed', 'true');
    expect(up).toHaveAttribute('aria-pressed', 'false');
    expect(getItem('feedback', {})).toEqual({ u1q1: 'down' });
    expect(events().filter((e) => e.type === 'feedback')).toHaveLength(2);
    cont();
    expect(screen.getByLabelText('第 2 題，共 3 題')).toBeInTheDocument();
    expect(screen.getByText('上司')).toBeInTheDocument();
    expect(screen.getByText('官網改版現在怎樣？')).toBeInTheDocument();
  });

  it('跑完 3 題：背景逐題變亮、收尾後回首頁，三題都進過第 2 步才算完成', async () => {
    await render(<App />);
    const brightness: string[] = [];
    for (let i = 1; i <= 3; i++) {
      brightness.push(screen.getByTestId('scene-bg').getAttribute('data-brightness')!);
      fireEvent.click(screen.getByRole('button', { name: /^B/ }));
      expect(getCompletions()[todayStr()]?.done).not.toBe(true);
      cont();
      cont();
    }
    expect(brightness).toEqual(['0.42', '0.7', '1']);
    expect(screen.getByRole('heading', { name: /今天學會：先講結論/ })).toBeInTheDocument();
    expect(screen.getByText('明天會練「報告壞消息」。')).toBeInTheDocument();
    expect(screen.getByTestId('wrap-buddy')).toBeInTheDocument();
    expect(screen.queryByTestId('boss')).not.toBeInTheDocument();
    expect(getCompletions()[todayStr()].done).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '完成' }));
    expect(await screen.findByText('今天完成了')).toBeInTheDocument();
  });

  it('題庫繞回後標示「複習」', async () => {
    const start = new Date(Date.now() - 2 * 86_400_000);
    onboarded(todayStr(start));
    await render(<App />);
    expect(screen.getByText('複習')).toBeInTheDocument();
  });

  it('只做 2 題就離開：首頁顯示「今天 2/3」和「繼續練習」，回來從第 3 題開始', async () => {
    const { unmount } = await render(<App />);
    for (let i = 0; i < 2; i++) {
      fireEvent.click(screen.getByRole('button', { name: /^B/ }));
      cont();
      cont();
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
    expect(screen.getByText('客戶')).toBeInTheDocument();
    expect(screen.getByText('這週五能交件嗎？')).toBeInTheDocument();
    const scenario = screen.getByText(/客戶早上傳訊息來問/).closest('p')!;
    expect(scenario.textContent?.match(/你要回一則訊息/g)).toHaveLength(1);
    expect(scenario.querySelector('strong')?.textContent).toBe('你要回一則訊息。');
    expect(screen.getByTestId('scene-bg')).toHaveAttribute('src', expect.stringContaining('scenes/scene-q3.svg'));
    expect(screen.getByTestId('scene-bg')).toHaveAttribute('data-brightness', '1');
  });

  it('今天完成後再進 #/practice 不會出新題', async () => {
    for (let i = 0; i < 3; i++) seeBothSteps('B', new Date());
    await render(<App />);
    expect(screen.getByRole('heading', { name: /今天學會：先講結論/ })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: '選項' })).not.toBeInTheDocument();
  });
});
