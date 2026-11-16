import { test, expect, type Page } from '@playwright/test';

const shot = (name: string) => `screenshots/batch3/${name}.png`;

/** doneOffsets：往前幾天有完成（0 = 今天）；partialToday：今天只做幾題 */
async function seed(page: Page, doneOffsets: number[], partialToday = 0) {
  await page.goto('/');
  await page.evaluate(({ doneOffsets, partialToday }) => {
    const fmt = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(d);
    const ago = (n: number) => fmt(new Date(Date.now() - n * 86_400_000));
    const a = { question_id: 'q001', choice: 'B', correct: true };
    const completions: Record<string, unknown> = {};
    for (const n of doneOffsets) completions[ago(n)] = { answers: [a, a, a], done: true };
    if (partialToday) completions[ago(0)] = { answers: Array(partialToday).fill(a), done: false };
    localStorage.setItem('softskill_pain_points', '["unsure"]');
    localStorage.setItem('softskill_committed_at', JSON.stringify(new Date().toISOString()));
    localStorage.setItem('softskill_journey_start', JSON.stringify(ago(Math.max(0, ...doneOffsets))));
    localStorage.setItem('softskill_reminder_time', '"20:00"');
    localStorage.setItem('softskill_completions', JSON.stringify(completions));
  }, { doneOffsets, partialToday });
  await page.reload();
}

test('今天還沒做：入口、連勝從昨天算、X／30、日曆', async ({ page }) => {
  await seed(page, [1, 2, 3, 5]); // 前 3 天連續，第 5 天前也有一次
  await expect(page.getByText('今天 0/3')).toBeVisible();
  await expect(page.getByTestId('streak')).toHaveText('3');
  await expect(page.getByTestId('journey')).toHaveText('已完成 4／30');
  await expect(page.getByRole('link', { name: '開始今天的練習' })).toBeVisible();
  await page.screenshot({ path: shot('01-home-not-started'), fullPage: true, style: 'nav { position: static !important; }' });
});

test('今天做到一半：今天 2/3、繼續練習，連勝不算今天', async ({ page }) => {
  await seed(page, [1], 2);
  await expect(page.getByText('今天 2/3')).toBeVisible();
  await expect(page.getByRole('link', { name: '繼續練習' })).toBeVisible();
  await expect(page.getByTestId('streak')).toHaveText('1');
  await page.screenshot({ path: shot('02-home-in-progress') });
});

test('今天完成：完成狀態、沒有練習入口、今天打勾', async ({ page }) => {
  await seed(page, [0, 1, 2]);
  await expect(page.getByText('今天完成了')).toBeVisible();
  await expect(page.getByRole('link', { name: '繼續練習' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '開始今天的練習' })).toHaveCount(0);
  await expect(page.getByTestId('streak')).toHaveText('3');
  await expect(page.locator('[data-done][aria-label*="今天"]')).toHaveCount(1);
  await page.screenshot({ path: shot('03-home-done'), fullPage: true, style: 'nav { position: static !important; }' });
});

test('第一次使用：連勝 0 沒有壓力文案', async ({ page }) => {
  await seed(page, []);
  await expect(page.getByTestId('streak')).toHaveText('0');
  await expect(page.getByText('今天練完就開始累積')).toBeVisible();
  await page.screenshot({ path: shot('04-home-first-day') });
});

test('修改提醒時間，重新整理後仍在', async ({ page }) => {
  await seed(page, [1]);
  const section = page.getByRole('region', { name: '提醒設定' });
  await section.getByRole('button', { name: '修改時間' }).click();
  await section.getByLabel('每天幾點提醒你？').selectOption('07:30');
  await page.waitForTimeout(500); // 等平滑捲動結束
  // 「儲存」不能被底部 tab 擋住
  const save = (await section.getByRole('button', { name: '儲存' }).boundingBox())!;
  const nav = (await page.getByRole('navigation', { name: '主要導覽' }).boundingBox())!;
  expect(save.y + save.height).toBeLessThanOrEqual(nav.y);
  await page.screenshot({ path: shot('05-reminder-edit') });
  await section.getByRole('button', { name: '儲存' }).click();
  await expect(section.getByTestId('reminder-time')).toHaveText('07:30');
  await page.reload();
  await expect(page.getByTestId('reminder-time')).toHaveText('07:30');
});

test('從首頁練完 3 題：回首頁連勝 +1、今天打勾', async ({ page }) => {
  await seed(page, [1]);
  await expect(page.getByTestId('streak')).toHaveText('1');
  await page.getByRole('link', { name: '開始今天的練習' }).click();
  for (const label of ['下一題', '下一題', '完成']) {
    await page.getByRole('button', { name: /^B/ }).click();
    await page.getByRole('button', { name: label }).click();
  }
  await expect(page.getByText('今天完成了')).toBeVisible();
  await expect(page.getByTestId('streak')).toHaveText('2');
  await expect(page.getByTestId('journey')).toHaveText('已完成 2／30');
});
