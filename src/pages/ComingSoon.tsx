import { useEffect, useState } from 'react';
import styles from './Page.module.css';
import { logEvent } from '../lib/firebase';
import { getItem, setItem } from '../lib/storage';

type Interests = Record<string, true>;

/** 即將推出的分頁。同一台裝置、同一個分頁只記一次 feature_interest。 */
export function ComingSoon({ title, blurb }: { title: string; blurb: string }) {
  const [asked, setAsked] = useState(() => getItem<Interests>('feature_interest', {})[title] === true);
  useEffect(() => {
    setAsked(getItem<Interests>('feature_interest', {})[title] === true);
  }, [title]);

  const ask = () => {
    const all = getItem<Interests>('feature_interest', {});
    if (all[title]) {
      setAsked(true);
      return;
    }
    all[title] = true;
    setItem('feature_interest', all);
    logEvent({ type: 'feature_interest', tab: title });
    setAsked(true);
  };

  return (
    <main className={styles.page}>
      <h1 className={styles.h1}>{title}</h1>
      <section className={styles.card} aria-labelledby="soon">
        <p className={styles.badge} id="soon">即將推出</p>
        <p className={styles.body}>{blurb}</p>
        <p className={styles.body}>現在先把每天的 5 分鐘練習做完吧。</p>
        {asked ? (
          <p className={styles.body} role="status">收到，謝謝你告訴我們。</p>
        ) : (
          <button type="button" className={styles.button} onClick={ask}>我想要這個功能</button>
        )}
        <a className={styles.button} href="#/">回到首頁</a>
      </section>
    </main>
  );
}
