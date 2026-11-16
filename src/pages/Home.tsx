import styles from './Home.module.css';
import { CONFIG } from '../config';
import { Character } from '../components/Character';
import { getCompletions, getPracticeState } from '../lib/practice';
import { currentStreak, journeyCompleted } from '../lib/progress';
import { getItem } from '../lib/storage';
import { MiniCalendar } from '../components/MiniCalendar';
import { ReminderSetting } from '../components/ReminderSetting';
import { NotificationSetting } from '../components/NotificationSetting';

export function Home() {
  const s = getPracticeState();
  const completions = getCompletions();
  const streak = currentStreak(completions, s.date);
  const journeyStart = getItem<string | null>('journey_start', null);
  const journey = journeyCompleted(completions, journeyStart);
  const started = s.index > 0 || s.pending !== null;

  return (
    <main className={styles.page}>
      <h1 className={styles.h1}>軟實力多鄰國</h1>

      {!s.done && (
        <p className={styles.banner} role="status">
          <span className={styles.dot} aria-hidden="true" />今天的 5 分鐘還沒練
        </p>
      )}

      <section className={`${styles.card} ${styles.today}`} aria-label="今天的練習">
        <Character kind="buddy" state={s.done ? 'highfive' : 'idle'} className={styles.orca} data-testid="home-buddy" />
        <div className={styles.todayBody}>
          {s.done ? (
            <>
              <p className={styles.badgeDone}>今天完成了</p>
              <p className={styles.todayText}>今天的 {s.total} 題都練完了，明天見！</p>
            </>
          ) : (
            <>
              <p className={styles.badge}>今天 {s.index}/{s.total}</p>
              <p className={styles.todayText}>
                {started ? '做到一半了，接著練完吧。' : `今天 ${s.total} 題，大約 5 分鐘。`}
              </p>
            </>
          )}
        </div>
        {!s.done && (
          <a className={styles.primary} href="#/practice">{started ? '繼續練習' : '開始今天的練習'}</a>
        )}
      </section>

      <section className={styles.stats} aria-label="進度">
        <div className={styles.stat}>
          <p className={styles.statLabel}>連勝</p>
          <p className={styles.statValue}><span data-testid="streak">{streak}</span> 天</p>
          <p className={styles.statHint}>{streak === 0 ? '今天練完就開始累積' : '持續中'}</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statLabel}>{CONFIG.JOURNEY_DAYS} 天旅程</p>
          <p className={styles.statValue}>
            <span data-testid="journey">已完成 {journey}／{CONFIG.JOURNEY_DAYS}</span>
          </p>
          <div className={styles.meter} aria-hidden="true">
            <div style={{ width: `${(journey / CONFIG.JOURNEY_DAYS) * 100}%` }} />
          </div>
        </div>
      </section>

      <section className={styles.card}>
        <MiniCalendar completions={completions} today={s.date} journeyStart={journeyStart} />
      </section>

      <section className={styles.card} aria-label="提醒設定">
        <ReminderSetting />
        <NotificationSetting />
      </section>
    </main>
  );
}
