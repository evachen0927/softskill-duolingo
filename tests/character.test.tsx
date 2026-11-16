import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { Character } from '../src/components/Character';
import { prepareSvg, instanceSvg } from '../src/lib/characterSvg';
import { readFileSync } from 'node:fs';

/** 可控的 IntersectionObserver：測試裡手動觸發「進出畫面」 */
class FakeIO {
  static all: FakeIO[] = [];
  disconnected = false;
  constructor(public cb: IntersectionObserverCallback) {
    FakeIO.all.push(this);
  }
  observe() {}
  disconnect() {
    this.disconnected = true;
  }
  fire(isIntersecting: boolean) {
    this.cb([{ isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

function setReducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  FakeIO.all = [];
  vi.stubGlobal('IntersectionObserver', FakeIO);
  setReducedMotion(false);
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  setHidden(false);
});

describe('Character：inline SVG 與外層', () => {
  it('用 inline SVG（不是 <img>），外層有 .char 和 .buddy／.boss，SVG 可以溢出', () => {
    const { container } = render(
      <>
        <Character kind="buddy" state="idle" data-testid="a" />
        <Character kind="boss" state="ask" data-testid="b" />
      </>,
    );
    expect(container.querySelector('img')).toBeNull();
    const [a, b] = container.querySelectorAll('.char');
    expect(a).toHaveClass('char', 'buddy');
    expect(b).toHaveClass('char', 'boss');
    for (const svg of container.querySelectorAll('svg')) {
      expect(svg.getAttribute('overflow')).toBe('visible');
      expect(svg.hasAttribute('width')).toBe(false); // 大小由外層決定
    }
    // motion-spec 要動的圖層都在
    for (const id of ['bob', 'sprout', 'eye-l', 'eye-r', 'arm-r', 'legs']) expect(a.querySelector(`#${id}`)).not.toBeNull();
    for (const id of ['art', 'tie', 'eye-l', 'eye-r', 'arm-r', 'face']) expect(b.querySelector(`#${id}`)).not.toBeNull();
  });

  it('同頁多張上司：clipPath id 每張唯一，不會互相引用', () => {
    const { container } = render(
      <>
        <Character kind="boss" state="ask" />
        <Character kind="boss" state="correct" />
      </>,
    );
    const ids = [...container.querySelectorAll('clipPath')].map((c) => c.id);
    expect(new Set(ids).size).toBe(2);
    for (const art of container.querySelectorAll('#art')) {
      const ref = art.getAttribute('clip-path')!.match(/url\(#(.+)\)/)![1];
      expect(art.closest('svg')!.querySelector(`clipPath[id="${ref}"]`)).not.toBeNull();
    }
  });

  it('#face 的傾斜屬性保留原樣（答對 +4°、答錯 −5°），程式不改它', () => {
    const { container } = render(
      <>
        <Character kind="boss" state="correct" />
        <Character kind="boss" state="wrong" />
      </>,
    );
    const faces = container.querySelectorAll('#face');
    expect(faces[0].getAttribute('transform')).toBe('rotate(4 400 360)');
    expect(faces[1].getAttribute('transform')).toMatch(/^rotate\(-5 /);
  });

  it('prepareSvg 不改動任何圖層內容，只處理外層屬性和 clipPath id', () => {
    const raw = readFileSync('public/characters/boss-ask.svg', 'utf8');
    const out = instanceSvg(prepareSvg(raw), 'x1');
    const strip = (s: string) => s.replace(/<svg[^>]*>/, '').replace(/cut-x1/g, 'cut');
    expect(strip(out)).toBe(strip(raw));
  });
});

describe('Character：眨眼', () => {
  it('同一頁兩個角色各自眨眼，.blink 只加在自己身上，選擇器不會動到另一張', () => {
    // 第一個角色延遲 1200ms，第二個 2700ms（Math.random 依序 0、1）
    const rand = vi.spyOn(Math, 'random');
    rand.mockReturnValueOnce(0).mockReturnValueOnce(1).mockReturnValue(0.5);
    const { container } = render(
      <>
        <Character kind="buddy" state="idle" data-testid="a" />
        <Character kind="boss" state="ask" data-testid="b" />
      </>,
    );
    const [a, b] = container.querySelectorAll<HTMLElement>('.char');
    act(() => vi.advanceTimersByTime(1250));
    expect(a).toHaveClass('blink');
    expect(b).not.toHaveClass('blink');
    // motion-spec 的選擇器 `.char.blink svg #eye-l` 只會選到 a 的眼睛
    const eyes = container.querySelectorAll('.char.blink svg #eye-l, .char.blink svg #eye-r');
    expect(eyes).toHaveLength(2);
    eyes.forEach((e) => expect(a.contains(e)).toBe(true));
    act(() => vi.advanceTimersByTime(1500));
    expect(b).toHaveClass('blink');
  });

  it('眨眼間隔 3.5–5 秒；10% 機率在 220ms 後連眨一次', () => {
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.05); // < 0.1 → 連眨
    const { getByTestId } = render(<Character kind="buddy" state="idle" data-testid="a" />);
    const el = getByTestId('a');
    const blinks: number[] = [];
    const orig = el.classList.add.bind(el.classList);
    vi.spyOn(el.classList, 'add').mockImplementation((...c: string[]) => {
      if (c.includes('blink')) blinks.push(Date.now());
      orig(...c);
    });
    const t0 = Date.now();
    act(() => vi.advanceTimersByTime(1275 + 3575 + 100)); // 停在第二輪連眨之前
    expect(blinks.map((t) => t - t0)).toEqual([1275, 1495, 1275 + 3575]);
    rand.mockRestore();
  });

  it('擊掌（閉眼）不眨眼', () => {
    const { getByTestId } = render(<Character kind="buddy" state="highfive" data-testid="a" />);
    act(() => vi.advanceTimersByTime(20_000));
    expect(getByTestId('a')).not.toHaveClass('blink');
    expect(getByTestId('a')).toHaveClass('no-blink');
  });
});

describe('Character：離開畫面或分頁隱藏時暫停', () => {
  it('捲出畫面 → .is-paused、不眨眼；捲回來 → 恢復', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { getByTestId } = render(<Character kind="buddy" state="idle" data-testid="a" />);
    const el = getByTestId('a');
    act(() => FakeIO.all[0].fire(false));
    expect(el).toHaveClass('is-paused');
    act(() => vi.advanceTimersByTime(10_000));
    expect(el).not.toHaveClass('blink');
    act(() => FakeIO.all[0].fire(true));
    expect(el).not.toHaveClass('is-paused');
    act(() => vi.advanceTimersByTime(3600));
    expect(el).toHaveClass('blink');
  });

  it('切換分頁 → 暫停；回來 → 恢復', () => {
    const { getByTestId } = render(<Character kind="boss" state="ask" data-testid="b" />);
    const el = getByTestId('b');
    act(() => setHidden(true));
    expect(el).toHaveClass('is-paused');
    act(() => setHidden(false));
    expect(el).not.toHaveClass('is-paused');
  });

  it('分頁回來時，如果角色還在畫面外，仍保持暫停', () => {
    const { getByTestId } = render(<Character kind="boss" state="ask" data-testid="b" />);
    const el = getByTestId('b');
    act(() => FakeIO.all[0].fire(false));
    act(() => setHidden(true));
    act(() => setHidden(false));
    expect(el).toHaveClass('is-paused');
  });
});

describe('Character：減少動態', () => {
  it('開啟減少動態：不啟動眨眼計時器、不監聽，永遠不眨', () => {
    setReducedMotion(true);
    const { getByTestId } = render(<Character kind="buddy" state="idle" data-testid="a" />);
    expect(vi.getTimerCount()).toBe(0);
    expect(FakeIO.all).toHaveLength(0);
    act(() => vi.advanceTimersByTime(30_000));
    expect(getByTestId('a')).not.toHaveClass('blink');
  });

  it('開啟減少動態：換狀態時舊圖淡出、新圖淡入，150ms 後只剩新圖', () => {
    setReducedMotion(true);
    const { getByTestId, rerender } = render(<Character kind="buddy" state="raise" data-testid="a" />);
    rerender(<Character kind="buddy" state="highfive" data-testid="a" />);
    const layers = getByTestId('a').querySelectorAll('.char-swap');
    expect(layers).toHaveLength(2);
    expect(layers[0]).toHaveClass('is-leaving');
    expect(layers[0].getAttribute('data-layer')).toBe('orca-raise');
    expect(layers[1]).toHaveClass('is-entering');
    expect(layers[1].getAttribute('data-layer')).toBe('orca-highfive');
    act(() => vi.advanceTimersByTime(150));
    expect(getByTestId('a').querySelectorAll('.char-swap')).toHaveLength(1);
  });
});

describe('Character：卸載時清乾淨', () => {
  it('卸載後計時器全部清掉、IntersectionObserver 斷開、visibilitychange 監聽移除', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.05); // 讓連眨的 220ms 計時器也出現
    const remove = vi.spyOn(document, 'removeEventListener');
    const { unmount } = render(
      <>
        <Character kind="buddy" state="idle" />
        <Character kind="boss" state="correct" />
      </>,
    );
    act(() => vi.advanceTimersByTime(1275 + 100)); // 觸發第一次眨眼，220ms 連眨計時中
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(FakeIO.all.every((io) => io.disconnected)).toBe(true);
    expect(remove.mock.calls.filter(([type]) => type === 'visibilitychange')).toHaveLength(2);
  });
});

describe('Character：上司的狀態 class', () => {
  it('出題中加 .is-asking；答對／答錯期間加 .is-feedback，回饋動作播完才恢復循環', () => {
    const { getByTestId, rerender } = render(<Character kind="boss" state="ask" asking data-testid="b" />);
    expect(getByTestId('b')).toHaveClass('is-asking');
    rerender(<Character kind="boss" state="wrong" data-testid="b" />);
    expect(getByTestId('b')).toHaveClass('wrong', 'is-feedback');
    act(() => vi.advanceTimersByTime(640));
    expect(getByTestId('b')).not.toHaveClass('is-feedback');
    rerender(<Character kind="boss" state="correct" data-testid="b" />);
    expect(getByTestId('b')).toHaveClass('correct', 'is-feedback');
    act(() => vi.advanceTimersByTime(600));
    expect(getByTestId('b')).not.toHaveClass('is-feedback');
  });
});
