import { test, expect, type Page } from '@playwright/test';

const shot = (name: string) => `screenshots/batch2/${name}.png`;

async function onboard(page: Page, journeyStartOffsetDays = 0) {
  await page.goto('/');
  await page.evaluate((offset) => {
    const d = new Date(Date.now() - offset * 86_400_000);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(d);
    localStorage.setItem('softskill_pain_points', '["unsure"]');
    localStorage.setItem('softskill_committed_at', JSON.stringify(new Date().toISOString()));
    localStorage.setItem('softskill_journey_start', JSON.stringify(today));
    localStorage.setItem('softskill_reminder_time', '"20:00"');
  }, journeyStartOffsetDays);
  await page.reload();
}

const brightnessOf = (page: Page) =>
  page.getByTestId('scene-bg').evaluate((el) => getComputedStyle(el).filter);

async function finishQuestion(page: Page, choice: RegExp) {
  await page.getByRole('button', { name: choice }).click();
  await page.getByRole('button', { name: '繼續' }).click();
  await page.getByRole('button', { name: '繼續' }).click();
}

test('跑完一天 3 題：兩步解析、場景佔位、完成回首頁', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
  await onboard(page);
  await page.goto('/#/practice');

  await expect(page.getByTestId('boss')).toHaveCount(0);
  await expect(page.getByTestId('boss-enter')).toHaveCount(0);
  await expect(page.getByLabel('第 1 題，共 3 題')).toHaveText('1 / 3');
  await expect(page.getByText('4 則新訊息：明天活動回報')).toBeVisible();
  const note = page.getByText('4 則新訊息：明天活動回報').locator('xpath=..');
  await expect(note).toContainText('通知');
  await expect(note).not.toContainText('同事');
  await expect(page.getByTestId('scene-bg')).toHaveAttribute('src', /scene-q1\.svg/);
  expect(await brightnessOf(page)).toBe('brightness(0.42)');

  const scene = (await page.getByTestId('scene').boundingBox())!;
  expect(scene.height).toBeGreaterThanOrEqual(300);
  expect(scene.height).toBeLessThanOrEqual(330);
  const bubble = (await page.getByText('4 則新訊息：明天活動回報').boundingBox())!;
  expect(bubble.y + bubble.height).toBeLessThan(scene.y + scene.height);

  const boxes = await Promise.all((await page.getByRole('list', { name: '選項' }).getByRole('button').all()).map((b) => b.boundingBox()));
  for (let i = 0; i < boxes.length; i++) {
    expect(boxes[i]!.height).toBeGreaterThanOrEqual(44);
    if (i > 0) expect(boxes[i]!.y - (boxes[i - 1]!.y + boxes[i - 1]!.height)).toBeGreaterThanOrEqual(8);
  }
  const flow = page.getByTestId('flow');
  expect(await flow.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: shot('01-q1-ask') });

  await page.getByRole('button', { name: /^A/ }).click();
  await expect(page.getByRole('status')).toContainText('這題答錯了');
  await expect(page.getByRole('status')).toContainText('讀完還不知道結論，要自己拼。');
  await expect(page.getByRole('list', { name: '選項' })).toHaveCount(0);
  await expect(page.getByTestId('boss')).toHaveCount(0);
  const chosen = (await page.getByTestId('chosen').boundingBox())!;
  const sheet = (await page.getByTestId('sheet').boundingBox())!;
  const gap = sheet.y - (chosen.y + chosen.height);
  expect(gap).toBeGreaterThanOrEqual(8);
  expect(gap).toBeLessThanOrEqual(42);
  await page.screenshot({ path: shot('02-q1-step1') });

  await page.getByRole('button', { name: '繼續' }).click();
  await expect(page.getByText('要學的技巧')).toBeVisible();
  await expect(page.getByText('正解是 B')).toBeVisible();
  await page.getByRole('button', { name: '有幫助' }).click();
  await expect(page.getByText('收到，謝謝你！')).toBeVisible();
  expect(await flow.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: shot('03-q1-step2') });
  await page.getByRole('button', { name: '其他選項' }).click();
  expect(await flow.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
  const cont = (await page.getByRole('button', { name: '繼續' }).boundingBox())!;
  expect(cont.y + cont.height).toBeLessThanOrEqual(844);
  await page.screenshot({ path: shot('04-q1-others') });
  await page.getByRole('button', { name: '繼續' }).click();

  await expect(page.getByLabel('第 2 題，共 3 題')).toHaveText('2 / 3');
  await expect(page.getByText('官網改版現在怎樣？')).toBeVisible();
  await expect(page.getByText('上司')).toBeVisible();
  await expect(page.getByTestId('boss')).toHaveCount(0);
  await page.waitForTimeout(300);
  const mid = parseFloat((await brightnessOf(page)).match(/[\d.]+/)![0]);
  expect(mid).toBeGreaterThan(0.42);
  expect(mid).toBeLessThanOrEqual(0.7);
  await page.waitForTimeout(1100);
  expect(await brightnessOf(page)).toBe('brightness(0.7)');
  await page.screenshot({ path: shot('05-q2-ask') });
  await page.getByRole('button', { name: /^B/ }).click();
  await expect(page.getByRole('status')).toContainText('答對了！');
  await expect(page.getByRole('status')).toContainText('一句話講完現況、風險和你的下一步。');
  await page.screenshot({ path: shot('06-q2-step1') });
  await page.getByRole('button', { name: '繼續' }).click();
  await expect(page.getByText('你選的 B，就是正解')).toBeVisible();
  await page.screenshot({ path: shot('07-q2-step2') });
  await page.getByRole('button', { name: '繼續' }).click();

  await expect(page.getByLabel('第 3 題，共 3 題')).toHaveText('3 / 3');
  await expect(page.getByText('這週五能交件嗎？')).toBeVisible();
  await expect(page.getByTestId('scene').getByText('客戶', { exact: true })).toBeVisible();
  await expect(page.getByTestId('scene-bg')).toHaveAttribute('src', /scene-q3\.svg/);
  await expect(page.locator('strong', { hasText: '你要回一則訊息。' })).toHaveCount(1);
  const promptText = await page.locator('p', { hasText: '客戶早上傳訊息來問' }).innerText();
  expect(promptText.split('你要回一則訊息').length - 1).toBe(1);
  await page.waitForTimeout(1300);
  expect(await brightnessOf(page)).toBe('brightness(1)');
  await page.screenshot({ path: shot('08-q3-ask') });
  await finishQuestion(page, /^C/);

  await expect(page.getByRole('heading', { name: /今天學會：先講結論/ })).toBeVisible();
  await expect(page.getByTestId('wrap-streak')).toHaveText('1');
  await page.screenshot({ path: shot('09-wrap') });
  await page.getByRole('button', { name: '完成' }).click();

  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByText('今天完成了')).toBeVisible();
  await expect(page.getByTestId('streak')).toHaveText('1');
  await page.screenshot({ path: shot('10-home-done') });

  const types = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('softskill_event_queue') || '[]').map((e: { type: string; slot?: number }) => e.type + (e.slot ? `#${e.slot}` : '')),
  );
  expect(types).toEqual([
    'answer#1', 'feedback', 'explanation_viewed#1',
    'answer#2', 'explanation_viewed#2',
    'answer#3', 'explanation_viewed#3', 'day_complete',
  ]);

  await page.goto('/#/practice');
  await expect(page.getByRole('heading', { name: /今天學會：先講結論/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('做 1 題就離開：首頁顯示繼續練習，回來從第 2 題開始', async ({ page }) => {
  await onboard(page);
  await page.goto('/#/practice');
  await finishQuestion(page, /^B/);
  await page.goto('/#/');
  await page.reload();
  await expect(page.getByText('今天 1/3')).toBeVisible();
  await page.getByRole('link', { name: '繼續練習' }).click();
  await expect(page.getByLabel('第 2 題，共 3 題')).toBeVisible();
  await expect(page.getByTestId('boss')).toHaveCount(0);
});

test('作答後重新整理：停在同一題的第 1 步，不能改選', async ({ page }) => {
  await onboard(page);
  await page.goto('/#/practice');
  await page.getByRole('button', { name: /^A/ }).click();
  await page.reload();
  await expect(page.getByRole('status')).toContainText('這題答錯了');
  await expect(page.getByRole('status')).toContainText('讀完還不知道結論，要自己拼。');
  await expect(page.getByRole('list', { name: '選項' })).toHaveCount(0);
  await expect(page.getByText('要學的技巧')).toHaveCount(0);
});

test('題庫繞回後標示「複習」', async ({ page }) => {
  await onboard(page, 2);
  await page.goto('/#/practice');
  await expect(page.getByText('複習', { exact: true })).toBeVisible();
});

test('prefers-reduced-motion：不出場、亮度直接切換', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await onboard(page);
  await page.goto('/#/practice');
  await expect(page.getByTestId('boss-enter')).toHaveCount(0);
  await expect(page.getByTestId('boss')).toHaveCount(0);
  await finishQuestion(page, /^B/);
  expect(await brightnessOf(page)).toBe('brightness(0.7)');
  const running = await page.evaluate(() => [...document.querySelectorAll('.char svg *')].filter((e) => getComputedStyle(e).animationName !== 'none').length);
  expect(running).toBe(0);
});

test('375×667 展開其他選項時，繼續仍固定在底部', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await onboard(page);
  await page.goto('/#/practice');
  const img = (await page.getByTestId('scene-bg').boundingBox())!;
  const note = (await page.getByText('4 則新訊息：明天活動回報').boundingBox())!;
  expect(note.y).toBeGreaterThanOrEqual(img.y + img.height - 2);
  await page.getByRole('button', { name: /^A/ }).click();
  await page.getByRole('button', { name: '繼續' }).click();
  await page.getByRole('button', { name: '其他選項' }).click();
  const btn = (await page.getByRole('button', { name: '繼續' }).boundingBox())!;
  expect(btn.y + btn.height).toBeLessThanOrEqual(667);
  expect(btn.y).toBeGreaterThan(667 - 140);
  expect(btn.height).toBeGreaterThanOrEqual(44);
});
