import { describe, it, expect, beforeEach } from 'vitest';
import { setItem } from '../src/lib/storage';
import { render, screen, act } from '@testing-library/react';
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
    // 佔位頁不假裝有功能：沒有按鈕或輸入框
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  });

  it('不存在的路徑回到首頁，不出錯', () => {
    render(<App />);
    go('#/nope');
    expect(screen.getByRole('link', { name: '首頁' })).toHaveAttribute('aria-current', 'page');
  });
});
