import { useState } from 'react';
import styles from './Page.module.css';
import { clearAll, dumpAll } from '../lib/storage';
import { allJSON, download, eventsCSV, localDataCSV } from '../lib/exporter';
import { todayStr } from '../lib/date';

/** 隱藏頁 #/debug：檢視、匯出、清除本機資料。不在底部 tab 中出現。 */
export function Debug({ onCleared }: { onCleared: () => void }) {
  const [armed, setArmed] = useState(false);
  const [, force] = useState(0);
  const data = dumpAll();
  const events = Array.isArray(data.event_queue) ? data.event_queue.length : 0;
  const stamp = todayStr();

  return (
    <main className={styles.page}>
      <h1 className={styles.h1}>Debug</h1>
      <p className={styles.sub}>本機資料 {Object.keys(data).length} 項・待送事件 {events} 筆</p>

      <section className={styles.card} aria-label="匯出">
        <button type="button" className={styles.button} onClick={() => download(`softskill-${stamp}.json`, allJSON(), 'application/json')}>
          匯出全部（JSON）
        </button>
        <button type="button" className={styles.button} onClick={() => download(`softskill-events-${stamp}.csv`, eventsCSV(), 'text/csv;charset=utf-8')}>
          匯出事件（CSV）
        </button>
        <button type="button" className={styles.button} onClick={() => download(`softskill-local-${stamp}.csv`, localDataCSV(), 'text/csv;charset=utf-8')}>
          匯出本機資料（CSV）
        </button>
      </section>

      <section className={styles.card} aria-label="清除">
        <button
          type="button"
          className={`${styles.button} ${styles.danger}`}
          onClick={() => {
            if (!armed) return setArmed(true);
            clearAll();
            setArmed(false);
            force((n) => n + 1);
            onCleared();
          }}
        >
          {armed ? '再按一次，確定清除' : '清除全部本機資料'}
        </button>
        {armed && (
          <button type="button" className={`${styles.button} ${styles.ghost}`} onClick={() => setArmed(false)}>取消</button>
        )}
      </section>

      <section className={styles.card} aria-label="目前資料">
        <pre className={styles.pre} data-testid="debug-dump">{JSON.stringify(data, null, 2)}</pre>
      </section>
    </main>
  );
}
