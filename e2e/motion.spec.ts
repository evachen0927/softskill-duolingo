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

  test('方塊上司：出場、出題中領帶、壓扁回彈、拍兩下、待機領帶一致', async ({ page, browser }) => {
    const preview = await browser.newPage();
    await preview.goto(PREVIEW);
    const q = (n: string) => preview.locator(`.char[data-n="${n}"]`);

    await seedPractice(page);
    await page.goto('/#/practice');
    // 出場（480ms 內讀取）
    await preview.click('#en');
    const enterApp = await motionOf(page.locator('[data-testid="boss-enter"] svg #art'));
    expect(enterApp).toEqual(await motionOf(q('boss-enter').locator('svg #art')));

    // 出題中：領帶 2s 擺一次
    const boss = page.getByTestId('boss');
    await expect(boss).toHaveClass(/is-asking/);
    await preview.click('#ask');
    expect(await motionOf(boss.locator('svg #tie'))).toEqual(await motionOf(q('boss-ask').locator('svg #tie')));
    await boss.screenshot({ path: `${SHOT}/compare-boss-ask-app.png` });
    await q('boss-ask').screenshot({ path: `${SHOT}/compare-boss-ask-preview.png` });
    await preview.click('#ask'); // 關掉出題中

    // 答對：#art 壓扁回彈（＋讚的手；預覽稿沒有寫手的 CSS，只比對 #art）
    await page.getByRole('button', { name: /^B/ }).click();
    await preview.click('#ok');
    expect(await motionOf(boss.locator('svg #art'))).toEqual(await motionOf(q('boss-correct').locator('svg #art')));
    // 回饋播完後恢復待機領帶（5s 循環），和預覽的待機一致
    await page.waitForTimeout(700);
    expect(await motionOf(boss.locator('svg #tie'))).toEqual(await motionOf(q('boss-correct').locator('svg #tie')));
    await page.getByRole('button', { name: '下一題' }).click();

    // 答錯：#arm-r 拍兩下
    await page.getByRole('button', { name: /^A/ }).click();
    await preview.click('#ng');
    // 拍兩下是純上下位移，軸心不影響畫面；預覽稿的 CSS 片段沒寫 #arm-r 軸心（瀏覽器預設），
    // App 照 motion-spec 表格與總 prompt 用 fill-box 50% 50%，所以這裡只比對動畫本身
    const pat = await motionOf(boss.locator('svg #arm-r'));
    expect(pat.animations).toEqual((await motionOf(q('boss-wrong').locator('svg #arm-r'))).animations);
    expect(pat.transformBox).toBe('fill-box');
    await preview.close();
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

test.describe('方塊上司（出題畫面）', () => {
  test('出題中只會眨眼：領帶 2 秒擺一次就停、#arm-r 不動、沒有東西往下動', async ({ page }) => {
    await seedPractice(page);
    await page.goto('/#/practice');
    const boss = page.getByTestId('boss');
    await expect(boss).toHaveAttribute('data-name', 'boss-ask');
    const names = await boss.evaluate((el) => el.getAnimations({ subtree: true }).map((a) => (a as CSSAnimation).animationName).filter((n) => n !== 'blink'));
    expect(names).toEqual(['tie']);
    expect(await boss.locator('svg #arm-r').evaluate((el) => el.getAnimations().length)).toBe(0);
    const tie = await motionOf(boss.locator('svg #tie'));
    expect(tie.animations[0]).toMatchObject({ name: 'tie', duration: 2000, iterations: 1 });
    await page.waitForTimeout(2300);
    expect(await boss.locator('svg #tie').evaluate((el) => el.getAnimations().length)).toBe(0); // 擺完就停
    // 版位：109×120，x=16，底邊壓在題目卡上緣
    const b = (await boss.boundingBox())!;
    const card = (await page.getByRole('region', { name: '情境' }).boundingBox())!;
    expect(Math.round(b.width)).toBe(109);
    expect(Math.round(b.height)).toBe(120);
    expect(Math.round(b.x)).toBe(16);
    expect(b.y + b.height).toBeGreaterThan(card.y);
  });

  test('答對、答錯時臉的傾斜和靜態圖一樣（#face 沒被 CSS 蓋掉）', async ({ page }) => {
    await seedPractice(page);
    await page.goto('/#/practice');
    const angle = () => page.locator('[data-testid="boss"] svg #face').evaluate((el) => {
      const m = new DOMMatrix(getComputedStyle(el).transform);
      return { deg: +((Math.atan2(m.b, m.a) * 180) / Math.PI).toFixed(3), anims: el.getAnimations().length, attr: el.getAttribute('transform') };
    });
    await page.getByRole('button', { name: /^B/ }).click();
    expect(await angle()).toEqual({ deg: 4, anims: 0, attr: 'rotate(4 400 360)' });
    await page.getByRole('button', { name: '下一題' }).click();
    await page.getByRole('button', { name: /^A/ }).click();
    const w = await angle();
    expect(w.deg).toBe(-5);
    expect(w.anims).toBe(0);
  });

  test('壓扁回彈時，上司底邊和題目卡之間不露縫（逐格量測）', async ({ page }) => {
    await seedPractice(page);
    await page.goto('/#/practice');
    await page.getByRole('button', { name: /^B/ }).click();
    const result = await page.evaluate(() => {
      const art = document.querySelector('[data-testid="boss"] svg #art') as SVGGraphicsElement;
      const cardTop = document.querySelector('section[aria-label="情境"]')!.getBoundingClientRect().top;
      const squash = art.getAnimations().find((a) => (a as CSSAnimation).animationName === 'squash')!;
      squash.pause();
      let worst = Infinity;
      for (let t = 0; t <= 520; t += 10) {
        squash.currentTime = t;
        const m = art.getScreenCTM()!;
        // 半身圖的平切底邊：viewBox y = 440
        for (const x of [60, 200, 340]) worst = Math.min(worst, x * m.b + 440 * m.d + m.f - cardTop);
      }
      return { worst: +worst.toFixed(3) };
    });
    // 底邊（y=440）每一格都在題目卡上緣以下（被卡片蓋住），沒有縫
    expect(result.worst).toBeGreaterThanOrEqual(0);
    console.log(`壓扁回彈期間，上司底邊最少壓在卡片下 ${result.worst}px`);
  });

  test('領帶以領結為支點擺動（Chrome 量測；真機需另外錄影驗證）', async ({ page }) => {
    await seedPractice(page);
    await page.goto('/#/practice');
    await expect(page.getByTestId('boss')).toHaveClass(/is-asking/);
    const r = await page.evaluate(() => {
      const tie = document.querySelector('[data-testid="boss"] svg #tie') as SVGGraphicsElement;
      const a = tie.getAnimations()[0];
      a.pause();
      const bb = tie.getBBox();
      const pt = (x: number, y: number) => {
        const m = tie.getScreenCTM()!;
        return [x * m.a + y * m.c + m.e, x * m.b + y * m.d + m.f];
      };
      let knotDrift = 0;
      let tipSwing = 0;
      const k0 = (a.currentTime = 0, pt(bb.x + bb.width / 2, bb.y));
      const t0 = pt(bb.x + bb.width / 2, bb.y + bb.height);
      for (let t = 0; t <= 2000; t += 20) {
        a.currentTime = t;
        const k = pt(bb.x + bb.width / 2, bb.y);
        const tip = pt(bb.x + bb.width / 2, bb.y + bb.height);
        knotDrift = Math.max(knotDrift, Math.hypot(k[0] - k0[0], k[1] - k0[1]));
        tipSwing = Math.max(tipSwing, Math.hypot(tip[0] - t0[0], tip[1] - t0[1]));
      }
      return { knotDrift: +knotDrift.toFixed(4), tipSwing: +tipSwing.toFixed(3), knot: k0.map((v) => +v.toFixed(2)) };
    });
    console.log(`領帶支點：領結位移最大 ${r.knotDrift}px（領帶尖端擺幅 ${r.tipSwing}px），領結在畫面 ${r.knot}`);
    expect(r.knotDrift).toBeLessThan(0.05);
    expect(r.tipSwing).toBeGreaterThan(0.3);
  });
});
