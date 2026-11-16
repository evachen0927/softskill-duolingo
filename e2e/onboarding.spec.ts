import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const shot = (name: string) => `screenshots/batch1/${name}.png`;

test('第一次開啟：痛點 → 擊掌承諾 → 第一題佔位；重新整理後直接到首頁', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));

  await page.goto('/#/library'); // 就算直接開其他 tab 也要先走引導
  const painHeading = page.getByRole('heading', { name: '你在職場溝通上，最常卡在哪裡？' });
  await expect(painHeading).toBeVisible();
  await expect(page.getByRole('navigation', { name: '主要導覽' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '下一步' })).toBeDisabled();
  await page.screenshot({ path: shot('01-pain-empty'), fullPage: true });

  await page.getByRole('checkbox', { name: '被主管突然提問，臨場講不快、講不準' }).click();
  await page.getByRole('checkbox', { name: '要報告壞消息或進度落後，不知道怎麼開口' }).click();
  // 每個選項點擊高度至少 44px
  for (const box of await page.getByRole('checkbox').all()) {
    expect((await box.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({ path: shot('02-pain-selected'), fullPage: true });
  await page.getByRole('checkbox', { name: '還不確定，先從基礎開始' }).click();
  await expect(page.getByRole('checkbox', { name: '被主管突然提問，臨場講不快、講不準' })).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('checkbox', { name: '被主管突然提問，臨場講不快、講不準' }).click();
  await page.getByRole('button', { name: '下一步' }).click();

  await expect(page.getByRole('heading', { name: '跟雲朵夥伴約定好，一起練' })).toBeVisible();
  await expect(page.getByText('每天約 5 分鐘、一起練 30 天')).toBeVisible();
  await expect(page.getByLabel('每天幾點提醒你？')).toHaveValue('20:00');
  await expect(page.getByRole('button', { name: '開始第一題' })).toHaveCount(0);
  await page.screenshot({ path: shot('03-commit-before'), fullPage: true });

  await page.getByLabel('每天幾點提醒你？').selectOption('21:30');
  await page.getByRole('button', { name: '跟雲朵夥伴擊掌' }).click();
  await expect(page.getByRole('status')).toHaveText('擊掌成功！約好了，30 天一起練。');
  await expect(page.getByTestId('buddy')).toHaveAttribute('data-name', 'orca-highfive');
  await page.waitForTimeout(700); // 等彈跳動畫結束再截圖
  await page.screenshot({ path: shot('04-commit-after'), fullPage: true });

  await page.getByRole('button', { name: '開始第一題' }).click();
  // 第 4 批：通知權限步驟（這裡選「先不要」，其他路徑在 notify.spec.ts）
  await page.getByRole('button', { name: '先不要' }).click();
  await page.getByRole('button', { name: '開始第一題' }).click();
  await expect(page).toHaveURL(/#\/practice$/);
  await expect(page.getByRole('heading', { name: '今天的練習' })).toBeVisible();
  await page.screenshot({ path: shot('05-practice-placeholder') });

  const stored = await page.evaluate(() => ({
    pain: localStorage.getItem('softskill_pain_points'),
    time: localStorage.getItem('softskill_reminder_time'),
    start: localStorage.getItem('softskill_journey_start'),
    committed: localStorage.getItem('softskill_committed_at'),
    events: JSON.parse(localStorage.getItem('softskill_event_queue') || '[]').map((e: { type: string }) => e.type),
  }));
  expect(stored.pain).toBe('["impromptu"]');
  expect(stored.time).toBe('"21:30"');
  expect(stored.start).toMatch(/^"\d{4}-\d\d-\d\d"$/);
  expect(stored.committed).not.toBeNull();
  expect(stored.events).toEqual(['onboarding_done', 'commit', 'notif_permission']);

  // 第二次開啟：直接到首頁，不重跑引導
  await page.goto('/');
  await page.reload();
  await expect(page.getByRole('heading', { name: '軟實力多鄰國' })).toBeVisible();
  await expect(page.getByRole('link', { name: '首頁' })).toHaveAttribute('aria-current', 'page');
  expect(errors).toEqual([]);
});

test('滑動手勢也能擊掌', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('softskill_pain_points', '["unsure"]'));
  await page.reload();
  const box = (await page.getByRole('button', { name: '跟雲朵夥伴擊掌' }).boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx - 50, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 20, cy - 10, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: '已和雲朵夥伴擊掌' })).toBeVisible();
  const commits = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('softskill_event_queue') || '[]').filter((e: { type: string }) => e.type === 'commit').length,
  );
  expect(commits).toBe(1);
});

test('一般情況下有待機循環和擊掌動畫（motion-spec）', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('softskill_pain_points', '["unsure"]'));
  await page.reload();
  const anim = (sel: string) => page.locator(`[data-testid="buddy"] svg ${sel}`).evaluate((el) => getComputedStyle(el).animationName);
  expect(await anim('#bob')).toBe('bob');
  expect(await anim('#sprout')).toBe('sprout');
  await page.getByRole('button', { name: '跟雲朵夥伴擊掌' }).click();
  expect(await anim('#arm-r')).toBe('highfiveArm');
  expect(await anim('#sparks')).toBe('sparksIn, sparksOut');
  expect(await anim('#bob')).toBe('bobJump, bob');
});

test('prefers-reduced-motion：沒有任何循環，擊掌改成 150ms 淡入淡出換圖', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('softskill_pain_points', '["unsure"]'));
  await page.reload();
  const running = () => page.evaluate(() => document.querySelectorAll('.char svg *').length && [...document.querySelectorAll('.char svg *')].filter((e) => getComputedStyle(e).animationName !== 'none').length);
  expect(await running()).toBe(0);
  await page.getByRole('button', { name: '跟雲朵夥伴擊掌' }).click();
  // 交叉淡入淡出：舊圖 is-leaving、新圖 is-entering，150ms
  const entering = page.locator('[data-testid="buddy"] .char-swap.is-entering');
  await expect(entering).toHaveAttribute('data-layer', 'orca-highfive');
  expect(await entering.evaluate((el) => getComputedStyle(el).animationDuration)).toBe('0.15s');
  await expect(page.locator('[data-testid="buddy"] .char-swap')).toHaveCount(1);
  expect(await running()).toBe(0);
  await expect(page.getByRole('status')).toHaveText('擊掌成功！約好了，30 天一起練。');
});

test('#/debug：匯出 JSON／CSV，清除後重新進入引導', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('checkbox', { name: '還不確定，先從基礎開始' }).click();
  await page.getByRole('button', { name: '下一步' }).click();
  await page.getByRole('button', { name: '跟雲朵夥伴擊掌' }).click();
  await page.goto('/#/debug');
  await expect(page.getByRole('heading', { name: 'Debug' })).toBeVisible();
  await page.screenshot({ path: shot('06-debug'), fullPage: true });

  const grab = async (name: string) => {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name }).click()]);
    return { file: dl.suggestedFilename(), text: fs.readFileSync((await dl.path())!, 'utf-8') };
  };
  const json = await grab('匯出全部（JSON）');
  expect(json.file).toMatch(/^softskill-\d{4}-\d\d-\d\d\.json$/);
  expect(JSON.parse(json.text).data.pain_points).toEqual(['unsure']);
  const ev = await grab('匯出事件（CSV）');
  expect(ev.text.replace(/^﻿/, '').split('\r\n')[0]).toBe('device_id,uid,type,question_id,choice,correct,feedback,slot,review,permission,platform,standalone,ts');
  expect(ev.text).toContain(',onboarding_done,');
  expect(ev.text).toContain(',commit,');
  const local = await grab('匯出本機資料（CSV）');
  expect(local.text).toContain('reminder_time,"""20:00"""');

  await page.getByRole('button', { name: '清除全部本機資料' }).click();
  await page.getByRole('button', { name: '再按一次，確定清除' }).click();
  await expect(page.getByRole('heading', { name: '你在職場溝通上，最常卡在哪裡？' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '你在職場溝通上，最常卡在哪裡？' })).toBeVisible();
});
