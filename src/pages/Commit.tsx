import { useEffect, useRef, useState } from 'react';
import styles from './Onboarding.module.css';
import { CONFIG } from '../config';
import { REMINDER_OPTIONS, commit, defaultReminderTime } from '../lib/onboarding';
import { Character, type BuddyState } from '../components/Character';

const SWIPE_PX = 40;

export function Commit({ onDone }: { onDone: () => void }) {
  const [time, setTime] = useState(defaultReminderTime());
  const [done, setDone] = useState(false);
  // 待機 1.5 秒後換成「舉手準備擊掌」（orca-raise）提示使用者；按下去時也會舉手
  const [raised, setRaised] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setRaised(true), 1500);
    return () => clearTimeout(t);
  }, []);
  const start = useRef<{ x: number; y: number } | null>(null);
  const committed = useRef(false); // 滑動後瀏覽器可能還會補一個 click，用 ref 防止重複承諾

  const highFive = () => {
    if (committed.current) return;
    committed.current = true;
    commit(time);
    setDone(true);
    if (typeof navigator.vibrate === 'function') navigator.vibrate([30, 40, 60]);
  };

  // 點擊（onClick）或滑動（往任一方向超過 40px）都算擊掌
  const onPointerDown = (e: React.PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY };
    setRaised(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (Math.hypot(dx, dy) > SWIPE_PX) {
      start.current = null;
      highFive();
    }
  };
  const onPointerEnd = () => {
    start.current = null;
  };

  const buddy: BuddyState = done ? 'highfive' : raised ? 'raise' : 'idle';

  return (
    <main className={styles.page}>
      <p className={styles.step}>第 2 步／共 2 步</p>
      <h1 className={styles.h1}>跟雲朵夥伴約定好，一起練</h1>

      <section className={styles.promise} aria-label="約定內容">
        <p className={styles.promiseBig}>每天約 5 分鐘、一起練 {CONFIG.JOURNEY_DAYS} 天</p>
        <p className={styles.small}>每天 3 題情境題，答完都會告訴你為什麼。</p>
      </section>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="reminder">每天幾點提醒你？</label>
        <select
          id="reminder"
          className={styles.select}
          value={time}
          disabled={done}
          onChange={(e) => setTime(e.target.value)}
        >
          {REMINDER_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <p className={styles.small}>以台灣時間計算，之後可以在首頁修改。</p>
      </div>

      <div className={styles.highfiveWrap}>
        <button
          type="button"
          className={styles.highfive}
          aria-label={done ? '已和雲朵夥伴擊掌' : '跟雲朵夥伴擊掌'}
          aria-pressed={done}
          onClick={highFive}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onPointerLeave={onPointerEnd}
        >
          <Character kind="buddy" state={buddy} data-testid="buddy" style={{ width: 190 }} />
        </button>
        {!done && <p className={styles.highfiveLabel}>點一下或滑過去，跟雲朵夥伴擊掌！</p>}
        <p className={styles.success} role="status" aria-live="polite">
          {done ? `擊掌成功！約好了，${CONFIG.JOURNEY_DAYS} 天一起練。` : ''}
        </p>
      </div>

      <div className={styles.spacer} />
      {done ? (
        <button type="button" className={styles.primary} onClick={onDone}>開始第一題</button>
      ) : (
        <p className={styles.hint}>擊掌之後才能開始</p>
      )}
    </main>
  );
}
