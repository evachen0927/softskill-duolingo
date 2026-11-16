import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import './Character.css';
import { getCachedSvg, instanceSvg, loadSvg, type CharacterFile } from '../lib/characterSvg';
import { prefersReducedMotion, startBlink } from '../lib/blink';

export type BuddyState = 'idle' | 'raise' | 'highfive';
export type BossState = 'enter' | 'ask' | 'correct' | 'wrong';

type Props = (
  | { kind: 'buddy'; state: BuddyState }
  | { kind: 'boss'; state: BossState }
) & {
  /** 上司出題中：只眨眼，領帶前 2s 擺一次 */
  asking?: boolean;
  /** 給螢幕閱讀器的說明；不填則視為裝飾 */
  label?: string;
  className?: string;
  style?: CSSProperties;
  'data-testid'?: string;
};

const FILES: Record<string, CharacterFile> = {
  'buddy:idle': 'orca-idle',
  'buddy:raise': 'orca-raise',
  'buddy:highfive': 'orca-highfive',
  'boss:enter': 'boss-enter',
  'boss:ask': 'boss-ask',
  'boss:correct': 'boss-correct',
  'boss:wrong': 'boss-wrong',
};

/** 回饋動作的長度：播完才恢復領帶循環 */
const FEEDBACK_MS = { correct: 600, wrong: 640 } as const;
const SWAP_MS = 150;

interface Layer {
  key: number;
  name: CharacterFile;
  phase: 'stable' | 'entering' | 'leaving';
}

/**
 * 共用角色元件：inline SVG、fill-box 軸心、overflow visible、隨機眨眼、離開畫面／分頁隱藏時暫停、
 * 支援減少動態、卸載時清掉所有計時器與監聽器。
 */
export function Character(props: Props) {
  const { kind, state, asking, label, className, style } = props;
  const name = FILES[`${kind}:${state}`];
  const uid = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const reduced = useRef(prefersReducedMotion()).current;

  // 圖層：一般情況換狀態就直接換 SVG（新的 DOM → 狀態動畫從頭播一次）；
  // 減少動態時舊圖淡出、新圖淡入 150ms。
  const keyRef = useRef(0);
  const [layers, setLayers] = useState<Layer[]>([{ key: 0, name, phase: 'stable' }]);
  const prevName = useRef(name);
  useLayoutEffect(() => {
    if (prevName.current === name) return;
    const old = prevName.current;
    prevName.current = name;
    const k = ++keyRef.current;
    if (!reduced) {
      setLayers([{ key: k, name, phase: 'stable' }]);
      return;
    }
    setLayers([{ key: k - 0.5, name: old, phase: 'leaving' }, { key: k, name, phase: 'entering' }]);
    const t = setTimeout(() => setLayers([{ key: k, name, phase: 'stable' }]), SWAP_MS);
    return () => clearTimeout(t);
  }, [name, reduced]);

  // 載入 SVG（通常 App 啟動時已預先載入）
  const [, force] = useState(0);
  useEffect(() => {
    let alive = true;
    layers.forEach((l) => {
      if (!getCachedSvg(l.name)) void loadSvg(l.name).then(() => alive && force((n) => n + 1)).catch(() => undefined);
    });
    return () => {
      alive = false;
    };
  }, [layers]);

  // 答對／答錯：回饋動作期間標記 .is-feedback，播完才恢復循環
  const [feedback, setFeedback] = useState(kind === 'boss' && (state === 'correct' || state === 'wrong'));
  useEffect(() => {
    if (kind === 'boss' && (state === 'correct' || state === 'wrong') && !reduced) {
      setFeedback(true);
      const t = setTimeout(() => setFeedback(false), FEEDBACK_MS[state]);
      return () => clearTimeout(t);
    }
    setFeedback(false);
  }, [kind, state, reduced]);

  // 眨眼與暫停
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    return startBlink(el);
  }, []);

  const classes = [
    'char',
    kind,
    kind === 'buddy' && state === 'highfive' && 'highfive no-blink',
    kind === 'boss' && state === 'enter' && 'entering',
    kind === 'boss' && state === 'correct' && 'correct',
    kind === 'boss' && state === 'wrong' && 'wrong',
    asking && 'is-asking',
    feedback && 'is-feedback',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={rootRef}
      className={classes}
      style={{ ...style, ['--swap-ms' as string]: `${SWAP_MS}ms` }}
      data-kind={kind}
      data-name={name}
      data-testid={props['data-testid']}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {layers.map((l) => {
        const tpl = getCachedSvg(l.name);
        return (
          <div
            key={l.key}
            className={`char-swap${l.phase === 'entering' ? ' is-entering' : ''}${l.phase === 'leaving' ? ' is-leaving' : ''}`}
            data-layer={l.name}
            dangerouslySetInnerHTML={{ __html: tpl ? instanceSvg(tpl, `${uid}-${l.key}`) : '' }}
          />
        );
      })}
    </div>
  );
}
