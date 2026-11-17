import { test, expect, chromium } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const tabs = [
  { hash: '#/', label: '首頁', shot: '01-home' },
  { hash: '#/library', label: '題庫', shot: '02-library' },
  { hash: '#/ai', label: 'AI 對話練習', shot: '03-ai' },
  { hash: '#/me', label: '關於我', shot: '04-me' },
];

test('四個 tab 都能切換，390px 截圖，console 無錯誤', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));

  // 先把引導做完的狀態寫進 localStorage，才能測底部 tab
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('softskill_pain_points', '["unsure"]');
    localStorage.setItem('softskill_committed_at', JSON.stringify(new Date().toISOString()));
    localStorage.setItem('softskill_reminder_time', '"20:00"');
  });
  await page.reload();
  for (const t of tabs) {
    await page.getByRole('navigation', { name: '主要導覽' }).getByRole('link', { name: t.label }).click();
    await expect(page).toHaveURL(new RegExp(`${t.hash.replace('/', '\\/')}$`));
    await expect(page.getByRole('link', { name: t.label })).toHaveAttribute('aria-current', 'page');
    if (t.hash !== '#/') await expect(page.getByText('即將推出')).toBeVisible();
    // 點擊範圍至少 44px
    const box = await page.getByRole('link', { name: t.label }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: `screenshots/batch0/${t.shot}.png` });
  }
  expect(errors).toEqual([]);
});

test('即將推出：許願是選填，送出後道謝', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('softskill_pain_points', '["unsure"]');
    localStorage.setItem('softskill_committed_at', JSON.stringify(new Date().toISOString()));
    localStorage.setItem('softskill_reminder_time', '"20:00"');
  });
  await page.reload();
  await page.getByRole('navigation', { name: '主要導覽' }).getByRole('link', { name: '題庫' }).click();
  await page.getByRole('button', { name: '我想要這個功能' }).click();
  await expect(page.getByText('你最希望它幫你做什麼？')).toBeVisible();
  await page.screenshot({ path: 'screenshots/batch0/05-feature-wish.png' });
  await page.getByLabel('你最希望它幫你做什麼？').fill('可以重練錯題');
  await page.getByRole('button', { name: '送出' }).click();
  await expect(page.getByText('謝謝你的想法！')).toBeVisible();
  await page.getByRole('link', { name: '回到首頁' }).click();
  await expect(page.getByRole('link', { name: '開始今天的練習' })).toBeVisible();
});

test('PWA 可安裝：manifest 正確、service worker 生效、Chrome 回報無安裝障礙', async () => {
  // 用一般（非無痕）profile，Chrome 才會回報真實的安裝判斷
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-pwa-'));
  const ctx = await chromium.launchPersistentContext(dir, {
    executablePath: process.env.PW_CHROME_PATH,
    viewport: { width: 390, height: 844 },
  });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4173/');

  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]')!.getAttribute('href')!;
    return (await fetch(href)).json();
  });
  expect(manifest.name).toBe('軟實力多鄰國');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));

  const swScope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(swScope).toBe('http://localhost:4173/');

  const cdp = await ctx.newCDPSession(page);
  await page.reload();
  await page.waitForTimeout(1000);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  console.log('installabilityErrors =', JSON.stringify(installabilityErrors));
  expect(installabilityErrors).toEqual([]);
  await ctx.close();
});
