import type { ReactNode } from 'react';
import styles from './TabBar.module.css';

export interface Tab {
  path: string;
  label: string;
  icon: ReactNode;
}

const sw = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const TABS: Tab[] = [
  { path: '/', label: '首頁', icon: <svg viewBox="0 0 24 24" {...sw}><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></svg> },
  { path: '/library', label: '題庫', icon: <svg viewBox="0 0 24 24" {...sw}><path d="M4 5h6a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4z" /><path d="M20 5h-6a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h6z" /></svg> },
  { path: '/ai', label: 'AI 對話練習', icon: <svg viewBox="0 0 24 24" {...sw}><path d="M4 5h16v11H9l-5 4z" /><path d="M9 10h.01M12 10h.01M15 10h.01" /></svg> },
  { path: '/me', label: '關於我', icon: <svg viewBox="0 0 24 24" {...sw}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg> },
];

export function TabBar({ current }: { current: string }) {
  return (
    <nav className={styles.bar} aria-label="主要導覽">
      {TABS.map((t) => {
        const active = t.path === current;
        return (
          <a
            key={t.path}
            href={`#${t.path}`}
            className={`${styles.tab} ${active ? styles.active : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <span className={styles.icon} aria-hidden="true">{t.icon}</span>
            <span className={styles.label}>{t.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
