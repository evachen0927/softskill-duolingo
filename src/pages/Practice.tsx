import { useEffect, useRef, useState } from 'react';
import styles from './Practice.module.css';
import { CONFIG } from '../config';
import { backgroundSrc } from '../lib/assets';
import { getQuestion } from '../lib/questions';
import {
  finishExplanation, getCompletions, getPracticeState, sceneBrightness, setFeedback, submitAnswer, type Feedback,
} from '../lib/practice';
import { currentStreak } from '../lib/progress';
import { prefersReducedMotion } from '../lib/blink';
import { getItem } from '../lib/storage';
import { navigate } from '../router';
import { Character, type BossState } from '../components/Character';

export const BOSS_NAME = '方塊上司';

/** 出場時間軸（motion-spec 第 3 節）：boss-enter 480ms → 落地後 120ms 交叉淡入 boss-ask → 顯示題目 */
const ENTER_MS = 480;
const LAND_MS = 120;
type Intro = 'enter' | 'landing' | 'ready';

export function Practice() {
  const [state, setState] = useState(getPracticeState);
  const refresh = () => setState(getPracticeState());
  const reduced = useRef(prefersReducedMotion()).current;

  // 出場動畫只在這次練習的第 1 題播；中途回來從第 2、3 題開始就直接提問
  const firstSlot = useRef(state.index === 0 && !state.pending).current;
  const [intro, setIntro] = useState<Intro>(firstSlot && !reduced ? 'enter' : 'ready');
  useEffect(() => {
    if (intro === 'enter') {
      const t = setTimeout(() => setIntro('landing'), ENTER_MS);
      return () => clearTimeout(t);
    }
    if (intro === 'landing') {
      const t = setTimeout(() => setIntro('ready'), LAND_MS);
      return () => clearTimeout(t);
    }
  }, [intro]);

  const [feedback, setFb] = useState<Feedback | null>(null);

  if (state.done) {
    return (
      <main className={styles.donePage}>
        <h1 className={styles.h1}>今天的 {state.total} 題都完成了</h1>
        <p>明天再一起練。</p>
        <a className={styles.primary} href="#/">回到首頁</a>
      </main>
    );
  }

  const { set, index, total, pending } = state;
  const q = getQuestion(set.question_ids[index]);
  const review = set.review[index];
  const isLast = index === total - 1;
  const brightness = sceneBrightness(index, total);
  const streak = currentStreak(getCompletions(), state.date);
  const ready = intro === 'ready';

  const bossState: BossState = pending ? (pending.correct ? 'correct' : 'wrong') : 'ask';

  const choose = (key: string) => {
    if (pending || !ready) return;
    submitAnswer(key);
    refresh();
  };

  const next = () => {
    const { done } = finishExplanation();
    setFb(null);
    if (done) {
      navigate('/');
      return;
    }
    refresh();
    window.scrollTo?.(0, 0);
  };

  const chosen = pending ? q.options.find((o) => o.key === pending.choice)! : null;
  const correct = q.options.find((o) => o.key === q.answer)!;
  const others = q.options.filter((o) => o.key !== pending?.choice && o.key !== q.answer);
  const progressNow = index + (pending ? 1 : 0);

  return (
    <main className={styles.page}>
      {/* 情境背景：當天從昏暗漸漸變亮。只套在背景層，角色維持平塗、不加濾鏡 */}
      <div
        className={styles.bg}
        data-testid="scene-bg"
        data-brightness={brightness}
        aria-hidden="true"
        style={{
          backgroundImage: `url(${backgroundSrc(q.background)})`,
          filter: `brightness(${brightness})`,
          transitionDuration: `${CONFIG.SCENE_TRANSITION_MS}ms`,
        }}
      />

      <h1 className={styles.srOnly}>今天的練習</h1>
      <header className={styles.top}>
        <a className={styles.close} href="#/" aria-label="回到首頁">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </a>
        <span className={styles.streak}><span className={styles.dot} aria-hidden="true" />連勝 {streak} 天</span>
        <span className={styles.flex} />
        {review && <span className={styles.review}>複習</span>}
        <span className={styles.count} aria-label={`第 ${index + 1} 題，共 ${total} 題`}>{index + 1} / {total}</span>
      </header>
      <div className={styles.bar} role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={progressNow} aria-label="今天的進度">
        <div className={styles.fill} style={{ width: `${(progressNow / total) * 100}%` }} />
      </div>

      <div className={styles.stage}>
        {intro !== 'ready' && (
          <div className={`${styles.enterSlot} ${intro === 'landing' ? styles.landing : ''}`}>
            <Character kind="boss" state="enter" data-testid="boss-enter" />
          </div>
        )}
        {intro !== 'enter' && (
          <div className={`${styles.bossSlot} ${intro === 'landing' ? styles.fadeIn : ''}`}>
            <Character kind="boss" state={bossState} asking={!pending} label={BOSS_NAME} data-testid="boss" />
          </div>
        )}
        {ready && (
          <p className={styles.bubble}>
            <span className={styles.srOnly}>{BOSS_NAME}問：</span>
            {q.boss_line}
          </p>
        )}
      </div>

      <section className={`${styles.card} ${ready ? styles.reveal : styles.waiting}`} aria-label="情境">
        <p className={styles.meta}>第 {q.level} 關・{q.level_name}</p>
        <p className={styles.scenario}>{q.scenario}</p>
      </section>

      {!pending && (
        <ul className={`${styles.options} ${ready ? styles.reveal : styles.waiting}`} aria-label="選項">
          {q.options.map((o) => (
            <li key={o.key}>
              <button type="button" className={styles.option} onClick={() => choose(o.key)} disabled={!ready}>
                <span className={styles.key}>{o.key}</span>
                <span>{o.text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {pending && chosen && (
        <section className={styles.explain} aria-label="解析">
          <p className={pending.correct ? styles.right : styles.wrong} role="status">
            {pending.correct ? '答對了！' : '這題答錯了'}
          </p>

          <div className={styles.block}>
            <h2 className={styles.h2}>
              {pending.correct ? `你選的 ${chosen.key}，就是正解` : `你選的 ${chosen.key}：看起來合理，但問題在這裡`}
            </h2>
            <p className={styles.quote}>{chosen.text}</p>
            <p>{chosen.reason}</p>
          </div>

          {!pending.correct && (
            <div className={`${styles.block} ${styles.answerBlock}`}>
              <h2 className={styles.h2}>正解是 {correct.key}</h2>
              <p className={styles.quote}>{correct.text}</p>
              <p>{correct.reason}</p>
            </div>
          )}

          <div className={styles.block}>
            <h2 className={styles.h2}>其他選項</h2>
            <ul className={styles.others}>
              {others.map((o) => (
                <li key={o.key}><b>{o.key}</b>　{o.reason}</li>
              ))}
            </ul>
          </div>

          <div className={`${styles.block} ${styles.skill}`}>
            <h2 className={styles.h2}>要學的技巧・{q.framework}</h2>
            <p>{q.skill}</p>
          </div>

          <div className={styles.feedback} role="group" aria-label="這題對你有幫助嗎？">
            <span className={styles.fbLabel}>這題對你有幫助嗎？</span>
            {(['up', 'down'] as const).map((v) => (
              <button
                key={v}
                type="button"
                className={styles.fb}
                aria-pressed={feedback === v}
                aria-label={v === 'up' ? '有幫助' : '沒幫助'}
                onClick={() => {
                  if (feedback === v) return;
                  setFeedback(pending, v);
                  setFb(v);
                }}
              >
                {v === 'up' ? '👍' : '👎'}
              </button>
            ))}
          </div>

          <button type="button" className={styles.primary} onClick={next}>
            {isLast ? '完成' : '下一題'}
          </button>
        </section>
      )}
    </main>
  );
}

/** 給測試用：讀目前存的 👍👎 */
export const readFeedback = () => getItem<Record<string, Feedback>>('feedback', {});
