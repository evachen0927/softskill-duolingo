/**
 * 隨機眨眼（motion-spec 第 5 節的 startBlink），3.5–5s 一次、10% 機率連眨。
 * 和原稿的差異（都是為了符合總 prompt 的驗收條件）：
 * 1. 「離開畫面」和「分頁隱藏」分開記，兩者都沒有才恢復（原稿切回分頁會把畫面外的角色也解除暫停）。
 * 2. 連眨的 220ms 計時器也會在卸載時清掉。
 * 3. 外層有 .no-blink（例如擊掌閉眼）時不眨。
 * 4. 沒有 IntersectionObserver 的環境（舊瀏覽器、測試）不會壞掉。
 */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function startBlink(el: HTMLElement): () => void {
  if (prefersReducedMotion()) return () => {};
  let t: ReturnType<typeof setTimeout>;
  const extra = new Set<ReturnType<typeof setTimeout>>();
  let offscreen = false;
  let hidden = typeof document !== 'undefined' && document.hidden;

  const sync = () => el.classList.toggle('is-paused', offscreen || hidden);
  const once = () => {
    if (el.classList.contains('no-blink')) return;
    el.classList.remove('blink');
    void el.getBoundingClientRect(); // 重新觸發 CSS 動畫
    el.classList.add('blink');
  };
  const tick = () => {
    if (!el.classList.contains('is-paused')) {
      once();
      if (Math.random() < 0.1) {
        const d = setTimeout(() => {
          extra.delete(d);
          once();
        }, 220);
        extra.add(d);
      }
    }
    t = setTimeout(tick, 3500 + Math.random() * 1500);
  };
  t = setTimeout(tick, 1200 + Math.random() * 1500);

  let io: IntersectionObserver | null = null;
  if (typeof IntersectionObserver === 'function') {
    io = new IntersectionObserver(([e]) => {
      offscreen = !e.isIntersecting;
      sync();
    }, { threshold: 0 });
    io.observe(el);
  }
  const vis = () => {
    hidden = document.hidden;
    sync();
  };
  document.addEventListener('visibilitychange', vis);
  sync();

  return () => {
    clearTimeout(t);
    extra.forEach(clearTimeout);
    extra.clear();
    io?.disconnect();
    document.removeEventListener('visibilitychange', vis);
  };
}
