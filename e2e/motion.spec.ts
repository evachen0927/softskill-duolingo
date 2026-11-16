/**
 * 角色動態驗收：和設計的 docs/characters/motion-preview.html 逐項比對 keyframes 與時間，
 * 並量測 #legs 不動、擊掌火花不被切、上司出題中規則、#face 傾斜、壓扁回彈不露縫、領帶支點。
 */
import { test, expect, type Page, type Locator } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const SHOT = 'screenshots/characters';
fs.mkdirSync(SHOT, { recursive: true });
const PREVIEW = 'file://' + path.resolve('docs/characters/motion-preview.html');

/** 讀一個圖層上正在跑的 CSS 動畫：名稱、時間、曲線、keyframes，以及軸心 */
async function motionOf(layer: Locator) {
  return layer.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      transformBox: cs.transformBox,
      transformOrigin: cs.transformOrigin,
      animations: el.getAnimations().map((a) => {
        const eff = a.effect as KeyframeEffect;
        const t = eff.getTiming();
        return {
          name: (a as CSSAnimation).animationName,
          duration: t.duration,
          delay: t.delay,
          iterations: t.iterations,
          direction: t.direction,
          easing: t.easing,
          keyframes: eff.getKeyframes().map((k) => ({ offset: k.offset, transform: k.transform, opacity: k.opacity, easing: k.easing })),
        };
      }),
    };
  });
}

/** 把頁面上所有動畫停在第 0 毫秒：fill-box 會隨子圖層動畫改變，兩邊要在同一格比對 */
const freeze = (p: Page) => p.evaluate(() => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = 0; }));

async function seedPractice(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date());
    localStorage.setItem('softskill_pain_points', '["unsure"]');
    localStorage.setItem('softskill_committed_at', JSON.stringify(new Date().toISOString()));
    localStorage.setItem('softskill_journey_start', JSON.stringify(today));
  });
  await page.reload();
}

async function toCommit(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('softskill_pain_points', '["unsure"]'));
  await page.reload();
  await expect(page.locator('[data-testid="buddy"] svg')).toBeVisible();
}

test.describe('和 motion-preview.html 比對', () => {
  test('雲朵夥伴：呼吸、捲芽、眨眼的幅度與節奏一致', async ({ page, browser }) => {
    const preview = await browser.newPage();
    await preview.goto(PREVIEW);
    const pv = preview.locator('.char[data-n="orca-idle"]');
    await toCommit(page);
    const app = page.getByTestId('buddy'); // 前 1.5 秒是 orca-idle
    await expect(app).toHaveAttribute('data-name', 'orca-idle');
    await freeze(page);
    await freeze(preview);

    for (const id of ['#bob', '#sprout']) {
      expect(await motionOf(app.locator(`svg ${id}`)), id).toEqual(await motionOf(pv.locator(`svg ${id}`)));
    }
    // 眨眼：兩邊都手動加 .blink 後比對
    for (const [root, eye] of [[pv, pv.locator('svg #eye-l')], [app, app.locator('svg #eye-l')]] as const) {
      await root.evaluate((el) => { el.classList.remove('blink'); void el.getBoundingClientRect(); el.classList.add('blink'); });
      void eye;
    }
    await freeze(page);
    await freeze(preview);
    expect(await motionOf(app.locator('svg #eye-l'))).toEqual(await motionOf(pv.locator('svg #eye-l')));

    // 並排截圖（左：設計預覽，右：App）
    await pv.screenshot({ path: `${SHOT}/compare-buddy-preview.png` });
    await app.screenshot({ path: `${SHOT}/compare-buddy-app.png` });
    await preview.close();
  });

  test('題目畫面不放方塊上司；雲朵夥伴仍在收尾出場', async ({ page }) => {
    await seedPractice(page);
    await page.goto('/#/practice');
    await expect(page.getByTestId('boss')).toHaveCount(0);
    await expect(page.getByTestId('boss-enter')).toHaveCount(0);
    await expect(page.getByTestId('scene')).toBeVisible();
    await page.getByRole('button', { name: /^B/ }).click();
    await expect(page.getByTestId('boss')).toHaveCount(0);
    await page.getByRole('button', { name: '繼續' }).click();
    await page.getByRole('button', { name: '繼續' }).click();
    await page.getByRole('button', { name: /^B/ }).click();
    await page.getByRole('button', { name: '繼續' }).click();
    await page.getByRole('button', { name: '繼續' }).click();
    await page.getByRole('button', { name: /^B/ }).click();
    await page.getByRole('button', { name: '繼續' }).click();
    await page.getByRole('button', { name: '繼續' }).click();
    await expect(page.getByTestId('wrap-buddy')).toHaveAttribute('data-name', 'orca-highfive');
    await expect(page.getByTestId('boss')).toHaveCount(0);
  });
});

test.describe('雲朵夥伴', () => {
  test('#legs 完全不動，腳底不會浮起來（待機、舉手、擊掌全程）', async ({ page }) => {
    await toCommit(page);
    const legs = page.locator('[data-testid="buddy"] svg #legs');
    expect(await legs.evaluate((el) => el.getAnimations().length)).toBe(0);
    const before = await legs.boundingBox();
    const samples = [];
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(250);
      samples.push(await legs.boundingBox());
    }
    await page.getByRole('button', { name: '跟雲朵夥伴擊掌' }).click();
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(60);
      samples.push(await legs.boundingBox());
    }
    for (const s of samples) expect(s).toEqual(before);
  });

  test('擊掌：火花只彈一次、不閃；動畫最高點火花沒有被切掉（附截圖）', async ({ page }) => {
    await toCommit(page);
    const root = page.getByTestId('buddy');
    // 外層到 body 全部 overflow: visible
    const chain = await root.evaluate((el) => {
      const out: string[] = [];
      for (let n: Element | null = el; n && n !== document.body; n = n.parentElement) out.push(`${n.tagName}.${(n as HTMLElement).className}:${getComputedStyle(n).overflow}`);
      return out;
    });
    for (const c of chain) expect(c, c).toMatch(/:visible$/);

    await page.getByRole('button', { name: '跟雲朵夥伴擊掌' }).click();
    const sparks = root.locator('svg #sparks');
    // 1) 透明度取樣 1.8 秒：先升到 1、維持、再降到 0，之後不再出現
    const ops: number[] = [];
    for (let i = 0; i < 45; i++) {
      ops.push(+(await sparks.evaluate((el) => getComputedStyle(el).opacity)));
      await page.waitForTimeout(40);
    }
    const peak = ops.indexOf(Math.max(...ops));
    expect(Math.max(...ops)).toBe(1);
    for (let i = 1; i <= peak; i++) expect(ops[i]).toBeGreaterThanOrEqual(ops[i - 1] - 1e-6);
    for (let i = peak + 1; i < ops.length; i++) expect(ops[i]).toBeLessThanOrEqual(ops[i - 1] + 1e-6);
    expect(ops.at(-1)).toBe(0);

    // 2) 停在 #bob 跳最高的那一格：把所有擊掌動畫倒回同一時間點
    await page.evaluate(() => localStorage.clear());
    await toCommit(page);
    await page.getByRole('button', { name: '跟雲朵夥伴擊掌' }).click();
    const peakT = await page.evaluate(() => {
      const all = document.querySelector('[data-testid="buddy"]')!.getAnimations({ subtree: true });
      all.forEach((a) => a.pause());
      const bob = document.querySelector('[data-testid="buddy"] svg #bob')!;
      const jump = bob.getAnimations().find((a) => (a as CSSAnimation).animationName === 'bobJump')!;
      let best = 0;
      let top = Infinity;
      for (let t = 0; t <= 360; t += 5) {
        jump.currentTime = t;
        const y = bob.getBoundingClientRect().top;
        if (y < top) { top = y; best = t; }
      }
      all.forEach((a) => { a.currentTime = best; });
      return best;
    });
    const box = (await root.boundingBox())!;
    const sb = (await sparks.boundingBox())!;
    const vp = page.viewportSize()!;
    expect(sb.x).toBeGreaterThanOrEqual(0);
    expect(sb.y).toBeGreaterThanOrEqual(0);
    expect(sb.x + sb.width).toBeLessThanOrEqual(vp.width);
    const pad = 30;
    const clip = { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.width + pad * 2, height: box.height + pad * 2 };
    await page.screenshot({ path: `${SHOT}/highfive-peak-${peakT}ms.png`, clip });
    // 3) 火花完全展開（260ms）那一格
    await page.evaluate(() => document.querySelector('[data-testid="buddy"]')!.getAnimations({ subtree: true }).forEach((a) => { a.currentTime = 260; }));
    const sb2 = (await sparks.boundingBox())!;
    expect(sb2.x + sb2.width).toBeLessThanOrEqual(vp.width);
    await page.screenshot({ path: `${SHOT}/highfive-sparks-260ms.png`, clip });
    console.log(`擊掌最高點 = ${peakT}ms；火花框 ${JSON.stringify(sb2)}；夥伴框 ${JSON.stringify(box)}`);
  });
});

test.describe('方塊上司先不出現在題目畫面', () => {
  test('出題、作答、第 2 步都沒有上司，場景卡仍在', async ({ page }) => {
    await seedPractice(page);
    await page.goto('/#/practice');
    const scene = (await page.getByTestId('scene').boundingBox())!;
    expect(scene.height).toBeGreaterThanOrEqual(300);
    await expect(page.getByTestId('boss')).toHaveCount(0);
    await page.getByRole('button', { name: /^A/ }).click();
    await expect(page.getByTestId('boss')).toHaveCount(0);
    await page.getByRole('button', { name: '繼續' }).click();
    await expect(page.getByText('要學的技巧')).toBeVisible();
    await expect(page.getByTestId('boss')).toHaveCount(0);
  });
});
