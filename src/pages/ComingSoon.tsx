import styles from './Page.module.css';

export function ComingSoon({ title, blurb }: { title: string; blurb: string }) {
  return (
    <main className={styles.page}>
      <h1 className={styles.h1}>{title}</h1>
      <section className={styles.card} aria-labelledby="soon">
        <p className={styles.badge} id="soon">即將推出</p>
        <p className={styles.body}>{blurb}</p>
        <p className={styles.body}>現在先把每天的 5 分鐘練習做完吧。</p>
        <a className={styles.button} href="#/">回到首頁</a>
      </section>
    </main>
  );
}
