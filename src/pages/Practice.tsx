import { useEffect, useLayoutEffect, useRef, useState, type Ref } from 'react';
import styles from './Practice.module.css';
import { CONFIG } from '../config';
import { sceneSources } from '../lib/assets';
import { getQuestion, optionLine, scenarioParts, speechOf, type Question } from '../lib/questions';
import {
  advanceToLearn,
  finishExplanation,
  getCompletions,
  getPracticeState,
  sceneBrightness,
  setFeedback,
  submitAnswer,
  type Answer,
  type Feedback,
} from '../lib/practice';
import { currentStreak, isDone, weekOf } from '../lib/progress';
import { prefersReducedMotion } from '../lib/blink';
import { logEvent } from '../lib/firebase';
import { getItem, setItem } from '../lib/storage';
import { navigate } from '../router';
import { Character } from '../components/Character';

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

const DOWN_REASONS = [
  { id: 'too_easy', label: '太簡單' },
  { id: 'irrelevant', label: '跟我的工作無關' },
  { id: 'unclear', label: '解析看不懂' },
  { id: 'other', label: '其他' },
] as const;

const USEFUL = [
  { id: 'yes', label: '用得到' },
  { id: 'maybe', label: '可能' },
  { id: 'no', label: '用不到' },
] as const;

type DownReason = (typeof DOWN_REASONS)[number]['id'];
type UsefulAnswer = (typeof USEFUL)[number]['id'];

function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>,
      )}
    </>
  );
}

function Bell() {
  return (
    <svg className={styles.bell} width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12 3a6 6 0 0 0-6 6v2.6L4.3 15.2A1.2 1.2 0 0 0 5.4 17h13.2a1.2 1.2 0 0 0 1.1-1.8L18 11.6V9a6 6 0 0 0-6-6z" />
      <path fill="currentColor" d="M10 18a2 2 0 0 0 4 0h-4z" />
    </svg>
  );
}

function Scene({ q, brightness, parked }: { q: Question; brightness: number; parked: boolean }) {
  const speech = speechOf(q);
  const sources = sceneSources(q.scene_image);
  return (
    <div className={`${styles.sceneBlock} ${parked ? styles.sceneParked : ''}`} data-testid="scene" aria-hidden={parked || undefined}>
      <div className={styles.scene}>
        <img
          className={styles.sceneImg}
          data-testid="scene-bg"
          data-brightness={brightness}
          alt=""
          src={sources.src}
          data-fallback={sources.fallback}
          style={{
            filter: `brightness(${brightness})`,
            transitionDuration: `${CONFIG.SCENE_TRANSITION_MS}ms`,
          }}
          onError={(e) => {
            const img = e.currentTarget;
            const fallback = img.dataset.fallback;
            if (!fallback || img.dataset.fellback === '1') return;
            img.dataset.fellback = '1';
            img.src = fallback;
          }}
        />
      </div>
      <div className={speech.boss ? styles.talk : styles.note} data-speaker={speech.label}>
        <span className={styles.who}>
          {speech.icon === 'bell' && <Bell />}
          {speech.label}
        </span>
        <p className={styles.say}>{speech.text}</p>
      </div>
    </div>
  );
}

function Choice({ option }: { option: Question['options'][number] }) {
  return (
    <div className={styles.chosen} data-testid="chosen">
      <span className={styles.key}>{option.key}</span>
      <span>{option.text}</span>
    </div>
  );
}

function Go({
  label,
  onClick,
  buttonRef,
}: {
  label: string;
  onClick: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <button ref={buttonRef} type="button" className={styles.go} onClick={onClick}>
      {label}
    </button>
  );
}

export function Practice() {
  const [state, setState] = useState(getPracticeState);
  const refresh = () => setState(getPracticeState());
  const pageRef = useRef<HTMLElement>(null);
  const dockRef = useRef<HTMLElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const othersRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [feedback, setFb] = useState<Feedback | null>(null);
  const [reasonSent, setReasonSent] = useState(false);
  const [otherOn, setOtherOn] = useState(false);
  const [otherText, setOtherText] = useState('');

  const pendingId = state.pending?.question_id ?? null;
  const phase = state.pending?.phase ?? null;

  useEffect(() => {
    setOpen(false);
    setReasonSent(false);
    setOtherOn(false);
    setOtherText('');
    if (!pendingId) {
      setFb(null);
      return;
    }
    const all = getItem<Record<string, Feedback>>('feedback', {});
    setFb(all[pendingId] ?? null);
  }, [pendingId]);

  useEffect(() => {
    if (phase === 'result') continueRef.current?.focus({ preventScroll: true });
  }, [phase, pendingId]);

  useLayoutEffect(() => {
    const page = pageRef.current;
    const dock = dockRef.current;
    if (!page) return;
    if (!dock) {
      page.style.setProperty('--dock-h', '0px');
      return;
    }
    const apply = () => page.style.setProperty('--dock-h', `${dock.offsetHeight}px`);
    apply();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(apply);
    ro.observe(dock);
    return () => ro.disconnect();
  }, [phase, pendingId, state.done, open]);

  if (state.done) {
    return <WrapUp pageRef={pageRef} dockRef={dockRef} date={state.date} total={state.total} questionIds={state.set.question_ids} />;
  }

  const { set, index, total, pending } = state;
  const q = getQuestion(set.question_ids[index]);
  const review = set.review[index];
  const brightness = sceneBrightness(index, total);
  const asking = !pending;
  const learn = pending?.phase === 'learn';
  const chosen = pending ? q.options.find((o) => o.key === pending.choice)! : null;
  const correct = q.options.find((o) => o.key === q.answer)!;
  const answered = index + (pending ? 1 : 0);
  const copy = scenarioParts(q);

  const choose = (key: string) => {
    if (pending) return;
    submitAnswer(key);
    refresh();
  };

  const next = () => {
    if (!pending) return;
    if (pending.phase === 'result') {
      advanceToLearn();
      refresh();
      return;
    }
    finishExplanation();
    refresh();
  };

  const vote = (v: Feedback) => {
    if (!pending || feedback === v) return;
    setFeedback(pending, v);
    setFb(v);
    if (v !== 'down') setOtherOn(false);
  };

  const sendReason = (reason: DownReason, text?: string) => {
    if (!pending || reasonSent) return;
    const trimmed = text?.trim().slice(0, 200);
    logEvent({
      type: 'feedback_reason',
      question_id: pending.question_id,
      reason,
      ...(trimmed ? { text: trimmed } : {}),
    });
    setReasonSent(true);
    setOtherOn(false);
  };

  const toggleOthers = () => {
    setOpen((v) => {
      const nextOpen = !v;
      if (nextOpen) {
        requestAnimationFrame(() => {
          othersRef.current?.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
        });
      }
      return nextOpen;
    });
  };

  const fbText = feedback === 'up' ? '收到，謝謝你！' : feedback === 'down' ? '收到，我們會改這題。' : '這題對你有幫助嗎？';
  const incorrect = q.options.filter((o) => o.key !== q.answer);

  return (
    <main ref={pageRef} className={styles.page}>
      <h1 className={styles.srOnly}>今天的練習</h1>
      <header className={styles.top}>
        <a className={styles.close} href="#/" aria-label="回到首頁">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </a>
        <div
          className={styles.segments}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={answered}
          aria-label="今天的進度"
        >
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={i < answered ? styles.segOn : styles.seg}>
              <span />
            </span>
          ))}
        </div>
        {review && <span className={styles.review}>複習</span>}
        <span className={styles.count} aria-label={`第 ${index + 1} 題，共 ${total} 題`}>{index + 1} / {total}</span>
      </header>

      <div className={`${styles.flow} ${asking ? styles.flowAsk : ''}`} data-testid="flow">
        <Scene q={q} brightness={brightness} parked={learn} />

        {asking && (
          <>
            <p className={styles.meta}>第 {index + 1} 題・{q.stage ?? q.level_name}</p>
            <p className={styles.scenario}>
              {copy.body}
              {copy.prompt && <> <strong>{copy.prompt}</strong></>}
            </p>
            <ul className={styles.options} aria-label="選項">
              {q.options.map((o) => (
                <li key={o.key}>
                  <button type="button" className={styles.option} onClick={() => choose(o.key)}>
                    <span className={styles.key}>{o.key}</span>
                    <span>{o.text}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {pending && !learn && chosen && (
          <>
            <Choice option={chosen} />
            <div className={styles.verdict} role="status" aria-live="polite" data-testid="verdict">
              <p className={pending.correct ? styles.ok : styles.ng}>
                <span aria-hidden="true">{pending.correct ? '✓' : '✕'}</span>
                {pending.correct ? '答對了！' : '這題答錯了'}
              </p>
              <p className={styles.one}>{optionLine(chosen)}</p>
            </div>
          </>
        )}

        {learn && pending && (
          <section className={styles.learn} aria-label="解析">
            <p className={styles.kicker}>要學的技巧</p>
            <p className={styles.skill}><Rich text={q.skill} /></p>

            <div className={styles.answer}>
              <h2 className={styles.answerTitle}>
                {pending.correct ? `你選的 ${correct.key}，就是正解` : `正解是 ${correct.key}`}
              </h2>
              <p className={styles.quote}>{correct.text}</p>
              <p className={styles.why}>{correct.reason}</p>
            </div>

            <div className={styles.feedback} role="group" aria-label="這題對你有幫助嗎？">
              <span className={styles.fbLabel}>{fbText}</span>
              {(['up', 'down'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  className={styles.fb}
                  aria-pressed={feedback === v}
                  aria-label={v === 'up' ? '有幫助' : '沒幫助'}
                  onClick={() => vote(v)}
                >
                  {v === 'up' ? '👍' : '👎'}
                </button>
              ))}
            </div>
            {feedback === 'down' && (
              reasonSent ? (
                <p className={styles.reasonThanks} role="status">謝謝，我們會改進這題。</p>
              ) : (
                <div className={styles.reason} role="group" aria-label="哪裡沒幫助？">
                  <p className={styles.reasonAsk}>哪裡沒幫助？</p>
                  <div className={styles.chips}>
                    {DOWN_REASONS.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        className={styles.chip}
                        aria-pressed={otherOn && r.id === 'other'}
                        onClick={() => {
                          if (r.id === 'other') setOtherOn(true);
                          else sendReason(r.id);
                        }}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                  {otherOn && (
                    <div className={styles.reasonRow}>
                      <label className={styles.srOnly} htmlFor="reason-other">想說什麼都可以</label>
                      <input
                        id="reason-other"
                        className={styles.reasonInput}
                        maxLength={200}
                        placeholder="想說什麼都可以"
                        value={otherText}
                        onChange={(e) => setOtherText(e.target.value)}
                      />
                      <button
                        type="button"
                        className={styles.reasonSend}
                        onClick={() => sendReason('other', otherText)}
                        disabled={otherText.trim().length === 0}
                      >
                        送出
                      </button>
                    </div>
                  )}
                </div>
              )
            )}

            <button
              type="button"
              className={styles.othersBtn}
              aria-expanded={open}
              aria-controls="other-options"
              onClick={toggleOthers}
            >
              其他選項
              <span aria-hidden="true">{open ? ' ▴' : ' ▾'}</span>
            </button>
            {open && (
              <ul id="other-options" ref={othersRef} className={styles.otherList}>
                {incorrect.map((o) => (
                  <li key={o.key}>
                    <span className={styles.key}>{o.key}</span>
                    <span>
                      {o.key === pending.choice && <em className={styles.yours}>你選的</em>}
                      {optionLine(o)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      {pending && chosen && (
        <footer ref={dockRef} className={`${styles.dock} ${styles.dockPlain}`} data-testid="sheet">
          <Go label="繼續" onClick={next} buttonRef={continueRef} />
        </footer>
      )}
    </main>
  );
}

function WrapUp({
  pageRef,
  dockRef,
  date,
  total,
  questionIds,
}: {
  pageRef: Ref<HTMLElement>;
  dockRef: Ref<HTMLElement>;
  date: string;
  total: number;
  questionIds: string[];
}) {
  const completions = getCompletions();
  const answers = completions[date]?.answers ?? [];
  const streak = currentStreak(completions, date);
  const right = answers.filter((a) => a.correct).length;
  const last = getQuestion(questionIds[questionIds.length - 1]);
  const wrap = last.wrap_up;
  const start = getItem<string | null>('journey_start', null);
  const days = weekOf(date);
  const unitId = wrap?.unit_id ?? last.id;
  const [useful, setUseful] = useState<UsefulAnswer | null>(() => {
    const saved = getItem<Record<string, UsefulAnswer>>('unit_useful', {});
    return saved[date] ?? null;
  });

  const pickUseful = (value: UsefulAnswer) => {
    if (useful) return;
    const saved = getItem<Record<string, UsefulAnswer>>('unit_useful', {});
    saved[date] = value;
    setItem('unit_useful', saved);
    logEvent({ type: 'unit_useful', unit_id: unitId, answer: value });
    setUseful(value);
  };

  return (
    <main ref={pageRef} className={styles.page}>
      <div className={`${styles.flow} ${styles.wrap}`} data-testid="flow">
        <div className={styles.buddy}>
          <Character kind="buddy" state="highfive" label="雲朵夥伴" data-testid="wrap-buddy" />
        </div>
        <h1 className={styles.wrapTitle}>
          {wrap ? <>今天學會：<strong>{wrap.learned}</strong></> : `今天的 ${total} 題都練完了`}
        </h1>
        <p className={styles.wrapNext}>{wrap ? wrap.next : '明天再一起練。'}</p>

        <div className={styles.cards}>
          <section className={styles.mini} aria-label="今天的成績">
            <p className={styles.miniLabel}>今天 {total} 題</p>
            <p className={styles.miniValue}>答對 {right} 題</p>
            <ol className={styles.dots} aria-label="今天每題的對錯">
              {answers.map((a: Answer, i) => (
                <li key={i} className={a.correct ? styles.dotOk : styles.dotNg} aria-label={`第 ${i + 1} 題${a.correct ? '答對' : '答錯'}`}>
                  {a.correct ? '✓' : '✕'}
                </li>
              ))}
            </ol>
          </section>
          <section className={styles.mini} aria-label="連勝">
            <p className={styles.miniLabel}>連勝</p>
            <p className={styles.miniValue}><span data-testid="wrap-streak">{streak}</span> 天</p>
            <ol className={styles.week} aria-label="這一週">
              {days.map((d, i) => {
                const today = d === date;
                const done = isDone(completions, d);
                const before = start != null && d < start && !done;
                return (
                  <li key={d}>
                    <span className={styles.weekLab}>{WEEK[i]}</span>
                    <span
                      className={[
                        styles.weekDot,
                        (done || today) && styles.weekOn,
                        today && styles.weekPop,
                        before && styles.weekOff,
                      ].filter(Boolean).join(' ')}
                    >
                      {Number(d.slice(-2))}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      </div>
      <footer ref={dockRef} className={`${styles.dock} ${styles.dockPlain}`} data-testid="sheet">
        <div className={styles.useful} role="group" aria-label="今天學的，你這週用得到嗎？">
          {useful ? (
            <p className={styles.usefulThanks} role="status">收到！</p>
          ) : (
            <>
              <p className={styles.usefulAsk}>今天學的，你這週用得到嗎？</p>
              <div className={styles.chips}>
                {USEFUL.map((u) => (
                  <button key={u.id} type="button" className={styles.chip} onClick={() => pickUseful(u.id)}>
                    {u.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <Go label="完成" onClick={() => navigate('/')} />
      </footer>
    </main>
  );
}

/** 給測試用：讀目前存的 👍👎 */
export const readFeedback = () => getItem<Record<string, Feedback>>('feedback', {});
