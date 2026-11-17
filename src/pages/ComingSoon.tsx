import { useEffect, useState } from 'react';
import styles from './Page.module.css';
import { logEvent } from '../lib/firebase';
import { todayStr } from '../lib/date';
import { getItem, setItem } from '../lib/storage';

type Interests = Record<string, true>;
type TabDays = Record<string, string>;

/** 即將推出的分頁。興趣只記一次；願望選填；瀏覽每天每分頁記一次。 */
export function ComingSoon({ title, blurb }: { title: string; blurb: string }) {
  const [asked, setAsked] = useState(() => getItem<Interests>('feature_interest', {})[title] === true);
  const [wished, setWished] = useState(() => getItem<Interests>('feature_wish', {})[title] === true);
  const [wish, setWish] = useState('');

  useEffect(() => {
    setAsked(getItem<Interests>('feature_interest', {})[title] === true);
    setWished(getItem<Interests>('feature_wish', {})[title] === true);
    setWish('');
  }, [title]);

  useEffect(() => {
    const today = todayStr();
    const seen = getItem<TabDays>('tab_view_day', {});
    if (seen[title] === today) return;
    seen[title] = today;
    setItem('tab_view_day', seen);
    logEvent({ type: 'tab_view', tab: title });
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

  const sendWish = () => {
    const text = wish.trim().slice(0, 300);
    if (!text || wished) return;
    const all = getItem<Interests>('feature_wish', {});
    all[title] = true;
    setItem('feature_wish', all);
    logEvent({ type: 'feature_wish', tab: title, text });
    setWished(true);
  };

  return (
    <main className={styles.page}>
      <h1 className={styles.h1}>{title}</h1>
      <section className={styles.card} aria-labelledby="soon">
        <p className={styles.badge} id="soon">即將推出</p>
        <p className={styles.body}>{blurb}</p>
        <p className={styles.body}>現在先把每天的 5 分鐘練習做完吧。</p>
        {asked ? (
          <>
            <p className={styles.body} role="status">收到，謝謝你告訴我們。</p>
            {wished ? (
              <p className={styles.body} role="status">謝謝你的想法！</p>
            ) : (
              <div className={styles.wish}>
                <label className={styles.wishLabel} htmlFor="feature-wish">你最希望它幫你做什麼？</label>
                <textarea
                  id="feature-wish"
                  className={styles.wishInput}
                  maxLength={300}
                  rows={3}
                  value={wish}
                  onChange={(e) => setWish(e.target.value)}
                />
                <button type="button" className={styles.button} onClick={sendWish} disabled={wish.trim().length === 0}>
                  送出
                </button>
              </div>
            )}
          </>
        ) : (
          <button type="button" className={styles.button} onClick={ask}>我想要這個功能</button>
        )}
        <a className={styles.button} href="#/">回到首頁</a>
      </section>
    </main>
  );
}
