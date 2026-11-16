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
  await page.reload(); // App 只在啟動時讀引導狀態
}

const brightnessOf = (page: Page) =>
  page.getByTestId('scene-bg').evaluate((el) => getComputedStyle(el).filter);

test('跑完一天 3 題：背景由暗變亮、角色只在第 1 題出場、點了就送出、完成回首頁', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
  await onboard(page);
  await page.goto('/#/practice');

  // 第 1 題：方塊上司出場（boss-enter，480ms），落地後交叉淡入提問（boss-ask）
  await expect(page.getByTestId('boss-enter')).toBeVisible();
  expect(await page.locator('[data-testid="boss-enter"] svg #art').evaluate((el) => getComputedStyle(el).animationName)).toBe('enter');
  const boss = page.getByTestId('boss');
  await expect(boss).toHaveAttribute('data-name', 'boss-ask');
  await expect(page.getByTestId('boss-enter')).toHaveCount(0);
  await expect(page.getByLabel('第 1 題，共 3 題')).toHaveText('1 / 3');
  expect(await brightnessOf(page)).toBe('brightness(0.42)');

  // 選項點擊範圍 ≥ 44px、彼此間距 ≥ 12px
  const boxes = await Promise.all((await page.getByRole('list', { name: '選項' }).getByRole('button').all()).map((b) => b.boundingBox()));
  for (let i = 0; i < boxes.length; i++) {
    expect(boxes[i]!.height).toBeGreaterThanOrEqual(44);
    if (i > 0) expect(boxes[i]!.y - (boxes[i - 1]!.y + boxes[i - 1]!.height)).toBeGreaterThanOrEqual(12);
  }
  await page.screenshot({ path: shot('01-q1-ask') });

  // 答錯一題看完整解析
  await page.getByRole('button', { name: /^C/ }).click();
  await expect(page.getByRole('status')).toHaveText('這題答錯了');
  await expect(boss).toHaveAttribute('data-name', 'boss-wrong');
  await expect(page.getByRole('list', { name: '選項' })).toHaveCount(0);
  await page.getByRole('button', { name: '有幫助' }).click();
  await page.screenshot({ path: shot('02-q1-explain-wrong'), fullPage: true, style: 'nav { position: static !important; }' });
  await page.getByRole('button', { name: '下一題' }).click();

  // 第 2 題：不再播出場動畫，背景變亮（過渡中途會在兩個亮度之間）
  await expect(page.getByLabel('第 2 題，共 3 題')).toHaveText('2 / 3');
  await expect(boss).toHaveAttribute('data-name', 'boss-ask');
  await expect(page.getByTestId('boss-enter')).toHaveCount(0); // 第 2 題不再播出場
  await page.waitForTimeout(300);
  const mid = parseFloat((await brightnessOf(page)).match(/[\d.]+/)![0]);
  expect(mid).toBeGreaterThan(0.42);
  expect(mid).toBeLessThan(0.7);
  await page.waitForTimeout(1100);
  expect(await brightnessOf(page)).toBe('brightness(0.7)');
  await page.screenshot({ path: shot('03-q2-ask') });
  await page.getByRole('button', { name: /^B/ }).click();
  await expect(page.getByRole('status')).toHaveText('答對了！');
  await expect(boss).toHaveAttribute('data-name', 'boss-correct');
  await page.screenshot({ path: shot('04-q2-explain-right'), fullPage: true, style: 'nav { position: static !important; }' });
  await page.getByRole('button', { name: '下一題' }).click();

  // 第 3 題：全亮，按鈕寫「完成」
  await expect(page.getByLabel('第 3 題，共 3 題')).toHaveText('3 / 3');
  await page.waitForTimeout(1300);
  expect(await brightnessOf(page)).toBe('brightness(1)');
  await page.screenshot({ path: shot('05-q3-ask') });
  await page.getByRole('button', { name: /^B/ }).click();
  await page.screenshot({ path: shot('06-q3-explain'), fullPage: true, style: 'nav { position: static !important; }' });
  await page.getByRole('button', { name: '完成' }).click();

  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByText('今天完成了')).toBeVisible();
  await page.screenshot({ path: shot('07-home-done') });

  const types = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('softskill_event_queue') || '[]').map((e: { type: string; slot?: number }) => e.type + (e.slot ? `#${e.slot}` : '')),
  );
  expect(types).toEqual([
    'answer#1', 'feedback', 'explanation_viewed#1',
    'answer#2', 'explanation_viewed#2',
    'answer#3', 'explanation_viewed#3', 'day_complete',
  ]);

  // 已完成：再進練習頁不出新題
  await page.goto('/#/practice');
  await expect(page.getByRole('heading', { name: '今天的 3 題都完成了' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('做 1 題就離開：首頁顯示繼續練習，回來從第 2 題開始、不重播出場', async ({ page }) => {
  await onboard(page);
  await page.goto('/#/practice');
  await page.getByRole('button', { name: /^B/ }).click();
  await page.getByRole('button', { name: '下一題' }).click();
  await page.goto('/#/');
  await page.reload();
  await expect(page.getByText('今天 1/3')).toBeVisible();
  await page.screenshot({ path: shot('08-home-in-progress') });
  await page.getByRole('link', { name: '繼續練習' }).click();
  await expect(page.getByLabel('第 2 題，共 3 題')).toBeVisible();
  await expect(page.getByTestId('boss')).toHaveAttribute('data-name', 'boss-ask');
  await expect(page.getByTestId('boss-enter')).toHaveCount(0);
});

test('作答後重新整理：停在同一題的解析，不能改選', async ({ page }) => {
  await onboard(page);
  await page.goto('/#/practice');
  await page.getByRole('button', { name: /^A/ }).click();
  await page.reload();
  await expect(page.getByRole('status')).toHaveText('這題答錯了');
  await expect(page.getByRole('list', { name: '選項' })).toHaveCount(0);
  await expect(page.getByText('你選的 A：看起來合理，但問題在這裡')).toBeVisible();
});

test('第 2 天起標示「複習」', async ({ page }) => {
  await onboard(page, 1);
  await page.goto('/#/practice');
  await expect(page.getByText('複習', { exact: true })).toBeVisible();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: shot('09-review-badge') });
});

test('prefers-reduced-motion：不播出場、角色沒有循環、亮度直接切換', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await onboard(page);
  await page.goto('/#/practice');
  await expect(page.getByTestId('boss-enter')).toHaveCount(0); // 出場不位移：直接提問
  await expect(page.getByTestId('boss')).toHaveAttribute('data-name', 'boss-ask');
  await page.getByRole('button', { name: /^B/ }).click();
  await page.getByRole('button', { name: '下一題' }).click();
  expect(await brightnessOf(page)).toBe('brightness(0.7)'); // 沒有過渡，立刻到位
  const running = await page.evaluate(() => [...document.querySelectorAll('.char svg *')].filter((e) => getComputedStyle(e).animationName !== 'none').length);
  expect(running).toBe(0);
});
