import styles from './MiniCalendar.module.css';
import { monthGrid } from '../lib/progress';
import type { Completions } from '../lib/practice';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export function MiniCalendar({
  completions,
  today,
  journeyStart = null,
}: {
  completions: Completions;
  today: string;
  journeyStart?: string | null;
}) {
  const { year, month, weeks } = monthGrid(completions, today, journeyStart);
  return (
    <section className={styles.wrap} aria-labelledby="cal-title">
      <h2 id="cal-title" className={styles.title}>{year} 年 {month} 月</h2>
      <table className={styles.table} role="grid" aria-labelledby="cal-title">
        <thead>
          <tr>{WEEKDAYS.map((w) => <th key={w} scope="col" abbr={`星期${w}`}>{w}</th>)}</tr>
        </thead>
        <tbody>
          {weeks.map((week, i) => (
            <tr key={i}>
              {week.map((cell, j) =>
                cell ? (
                  <td key={j}>
                    <span
                      className={[
                        styles.day,
                        cell.done && styles.done,
                        cell.isToday && styles.today,
                        cell.isFuture && styles.future,
                        cell.beforeStart && !cell.done && styles.beforeStart,
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      aria-label={`${month} 月 ${cell.day} 日${cell.isToday ? '，今天' : ''}${cell.done ? '，已完成' : ''}${cell.beforeStart && !cell.done ? '，開始使用前' : ''}`}
                      data-date={cell.date}
                      data-done={cell.done || undefined}
                      data-before-start={cell.beforeStart && !cell.done ? 'true' : undefined}
                    >
                      {cell.day}
                    </span>
                  </td>
                ) : (
                  <td key={j} />
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
