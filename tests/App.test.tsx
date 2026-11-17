import { describe, it, expect, beforeEach } from 'vitest';
import { getItem, setItem } from '../src/lib/storage';
import type { AppEvent } from '../src/lib/firebase';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { App } from '../src/App';

function go(hash: string) {
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

describe('底部四個 tab（引導完成後）', () => {
  beforeEach(() => {
    setItem('pain_points', ['unsure']);
    setItem('committed_at', '2026-11-16T12:00:00.000Z');
    setItem('journey_start', '2026-11-16');
    setItem('reminder_time', '20:00');
  });

  it('四個 tab 都在，首頁預設選中', () => {
    render(<App />);
    const nav = screen.getByRole('navigation', { name: '主要導覽' });
    const links = nav.querySelectorAll('a');
    expect([...links].map((a) => a.textContent)).toEqual(['首頁', '題庫', 'AI 對話練習', '關於我']);
    expect(screen.getByRole('link', { name: '首頁' })).toHaveAttribute('aria-current', 'page');
  });

  it.each([
    ['#/library', '題庫'],
    ['#/ai', 'AI 對話練習'],
    ['#/me', '關於我'],
  ])('%s：佔位頁顯示「即將推出」、tab 有選中狀態、可回首頁', (hash, label) => {
    render(<App />);
    go(hash);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(label);
    expect(screen.getByText('即將推出')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '首頁' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: '回到首頁' })).toHaveAttribute('href', '#/');
    expect(screen.getByRole('button', { name: '我想要這個功能' })).toBeInTheDocument();
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  });

  it('即將推出：我想要這個功能記一次 feature_interest，同一分頁不再問', () => {
    render(<App />);
    go('#/library');
    fireEvent.click(screen.getByRole('button', { name: '我想要這個功能' }));
    expect(screen.getByRole('status')).toHaveTextContent('收到，謝謝你告訴我們。');
    expect(screen.queryByRole('button', { name: '我想要這個功能' })).not.toBeInTheDocument();
    const logged = getItem<AppEvent[]>('event_queue', []).filter((e) => e.type === 'feature_interest');
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ tab: '題庫' });

    go('#/');
    go('#/library');
    expect(screen.getByRole('status')).toHaveTextContent('收到，謝謝你告訴我們。');
    expect(getItem<AppEvent[]>('event_queue', []).filter((e) => e.type === 'feature_interest')).toHaveLength(1);

    go('#/ai');
    fireEvent.click(screen.getByRole('button', { name: '我想要這個功能' }));
    expect(getItem<AppEvent[]>('event_queue', []).filter((e) => e.type === 'feature_interest').map((e) => e.tab)).toEqual(['題庫', 'AI 對話練習']);
    expect(screen.getByLabelText('你最希望它幫你做什麼？')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('你最希望它幫你做什麼？'), { target: { value: '可以重練錯題' } });
    fireEvent.click(screen.getByRole('button', { name: '送出' }));
    expect(screen.getByText('謝謝你的想法！')).toBeInTheDocument();
    expect(getItem<AppEvent[]>('event_queue', []).filter((e) => e.type === 'feature_wish')).toEqual([
      expect.objectContaining({ tab: 'AI 對話練習', text: '可以重練錯題' }),
    ]);
    const views = getItem<AppEvent[]>('event_queue', []).filter((e) => e.type === 'tab_view').map((e) => e.tab);
    expect(views).toEqual(['題庫', 'AI 對話練習']);
  });

  it('不存在的路徑回到首頁，不出錯', () => {
    render(<App />);
    go('#/nope');
    expect(screen.getByRole('link', { name: '首頁' })).toHaveAttribute('aria-current', 'page');
  });
});
