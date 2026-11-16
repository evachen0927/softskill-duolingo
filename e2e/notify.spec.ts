import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const shot = (name: string) => `screenshots/batch4/${name}.png`;
const full = { fullPage: true, style: 'nav { position: static !important; }' } as const;

async function toNotifStep(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('softskill_pain_points', '["unsure"]'));
  await page.reload();
  await page.getByRole('button', { name: /擊掌/ }).click();
  await page.getByRole('button', { name: '開始第一題' }).click();
}

const permEvents = (page: Page) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem('softskill_event_queue') || '[]')
      .filter((e: { type: string }) => e.type === 'notif_permission')
      .map((e: { permission: string; platform: string; standalone: boolean }) => ({ permission: e.permission, platform: e.platform, standalone: e.standalone })),
  );

test('允許通知：說明文案 → 設定好了 → 第一題；首頁顯示已開啟', async ({ page, context }) => {
  await context.grantPermissions(['notifications']);
  await toNotifStep(page);
  await expect(page.getByRole('heading', { name: '要讓雲朵夥伴每天提醒你嗎？' })).toBeVisible();
  await expect(page.getByText(/不是行銷推播/)).toBeVisible();
  await page.screenshot({ path: shot('01-notif-ask'), ...full });

  await page.getByRole('button', { name: '開啟提醒' }).click();
  await expect(page.getByRole('heading', { name: '設定好了！' })).toBeVisible();
  await page.screenshot({ path: shot('02-notif-granted') });
  expect(await permEvents(page)).toEqual([{ permission: 'granted', platform: 'desktop', standalone: false }]);
  expect(await page.evaluate(() => localStorage.getItem('softskill_notif_status'))).toBe('"granted"');

  await page.getByRole('button', { name: '開始第一題' }).click();
  await expect(page).toHaveURL(/#\/practice$/);
  await page.goto('/#/');
  await expect(page.getByTestId('notif-state')).toHaveText(/系統通知已開啟/);
  await expect(page.getByText('今天的 5 分鐘還沒練')).toBeVisible(); // 開了通知，後備橫幅仍保留到今天完成
  await page.screenshot({ path: shot('03-home-granted'), ...full });
});

test('拒絕通知：安撫文案 → 第一題；首頁說明怎麼到系統設定打開，不再跳框', async ({ page }) => {
  // 模擬使用者在系統權限框按「封鎖」
  await page.addInitScript(() => {
    let p: NotificationPermission = 'default';
    (window as unknown as { __asked: number }).__asked = 0;
    Object.defineProperty(Notification, 'permission', { get: () => p, configurable: true });
    Notification.requestPermission = async () => {
      (window as unknown as { __asked: number }).__asked++;
      p = 'denied';
      return p;
    };
  });
  await toNotifStep(page);
  await page.getByRole('button', { name: '開啟提醒' }).click();
  await expect(page.getByRole('status')).toHaveText('沒關係，還是可以開始；今天沒練的話，回到 App 也會看到提醒。');
  await page.screenshot({ path: shot('04-notif-denied') });
  await page.getByRole('button', { name: '開始第一題' }).click();
  await expect(page).toHaveURL(/#\/practice$/);

  await page.goto('/#/');
  await expect(page.getByText('今天的 5 分鐘還沒練')).toBeVisible();
  await expect(page.getByTestId('notif-state')).toContainText('系統通知目前是關閉的');
  await expect(page.getByRole('button', { name: '開啟通知' })).toHaveCount(0);
  // 整段流程只在擊掌後問過那一次，首頁沒有再請求
  expect(await page.evaluate(() => (window as unknown as { __asked: number }).__asked)).toBe(1);
  await page.getByTestId('notif-state').scrollIntoViewIfNeeded();
  await page.screenshot({ path: shot('05-home-denied'), ...full });
});

test('先不要：首頁有「開啟通知」入口，按了才請求', async ({ page, context }) => {
  await toNotifStep(page);
  await page.getByRole('button', { name: '先不要' }).click();
  await expect(page.getByRole('status')).toContainText('沒關係，還是可以開始');
  await page.getByRole('button', { name: '開始第一題' }).click();
  await page.goto('/#/');
  await context.grantPermissions(['notifications']);
  await page.getByRole('button', { name: '開啟通知' }).click();
  await expect(page.getByTestId('notif-state')).toHaveText(/系統通知已開啟/);
  expect((await permEvents(page)).map((e) => e.permission)).toEqual(['skipped', 'granted']);
});

test('不支援通知的瀏覽器：直接安撫，不跳框', async ({ page }) => {
  await page.addInitScript(() => {
    // @ts-expect-error 模擬不支援
    delete window.Notification;
  });
  await toNotifStep(page);
  await expect(page.getByRole('status')).toContainText('沒關係，還是可以開始');
  await expect(page.getByText('這個瀏覽器不支援系統通知。')).toBeVisible();
  expect((await permEvents(page)).map((e) => e.permission)).toEqual(['unsupported']);
});

test.describe('iPhone', () => {
  const iphone = {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  };

  test('沒從主畫面開啟：顯示加入主畫面教學，不請求權限', async ({ browser }) => {
    const ctx: BrowserContext = await browser.newContext({ ...iphone, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      (window as unknown as { __asked: number }).__asked = 0;
      Notification.requestPermission = async () => {
        (window as unknown as { __asked: number }).__asked++;
        return 'granted';
      };
    });
    await toNotifStep(page);
    await expect(page.getByRole('heading', { name: 'iPhone 要先加入主畫面' })).toBeVisible();
    await expect(page.getByRole('list', { name: '加入主畫面的步驟' })).toContainText('分享');
    await page.screenshot({ path: shot('06-ios-install-guide'), ...full });
    await page.getByRole('button', { name: '我知道了，先開始第一題' }).click();
    await expect(page).toHaveURL(/#\/practice$/);
    expect(await page.evaluate(() => (window as unknown as { __asked: number }).__asked)).toBe(0);
    expect(await permEvents(page)).toEqual([{ permission: 'ios_needs_install', platform: 'ios', standalone: false }]);

    // 首頁也提供教學
    await page.goto('/#/');
    await page.getByRole('button', { name: '看怎麼加入主畫面' }).click();
    await expect(page.getByRole('list', { name: '加入主畫面的步驟' })).toBeVisible();
    await ctx.close();
  });

  test('從主畫面開啟（standalone）：才請求權限', async ({ browser }) => {
    const ctx = await browser.newContext({ ...iphone, viewport: { width: 390, height: 844 }, isMobile: true });
    await ctx.grantPermissions(['notifications']);
    const page = await ctx.newPage();
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true }));
    await toNotifStep(page);
    await expect(page.getByRole('heading', { name: '要讓雲朵夥伴每天提醒你嗎？' })).toBeVisible();
    await page.getByRole('button', { name: '開啟提醒' }).click();
    await expect(page.getByRole('heading', { name: '設定好了！' })).toBeVisible();
    expect(await permEvents(page)).toEqual([{ permission: 'granted', platform: 'ios', standalone: true }]);
    await ctx.close();
  });
});

test('推播送達 service worker：顯示通知文案、點擊連到今日題', async ({ page, context }) => {
  await context.grantPermissions(['notifications']);
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  const cdp = await context.newCDPSession(page);
  await cdp.send('ServiceWorker.enable');
  const regId = await new Promise<string>((resolve) => {
    cdp.on('ServiceWorker.workerRegistrationUpdated', ({ registrations }) => {
      const r = registrations.find((x: { scopeURL: string }) => x.scopeURL.startsWith('http://localhost:4173/'));
      if (r) resolve(r.registrationId);
    });
  });
  // 模擬排程腳本送出的 FCM data 訊息
  await cdp.send('ServiceWorker.deliverPushMessage', {
    origin: 'http://localhost:4173',
    registrationId: regId,
    data: JSON.stringify({ data: { title: '軟實力多鄰國', body: '今天的 5 分鐘練習還沒完成，要不要現在練？', link: '#/practice' } }),
  });
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const reg = await navigator.serviceWorker.ready;
        return (await reg.getNotifications()).map((n) => ({ title: n.title, body: n.body, data: n.data, tag: n.tag }));
      }),
    )
    .toEqual([{ title: '軟實力多鄰國', body: '今天的 5 分鐘練習還沒完成，要不要現在練？', data: { link: '#/practice' }, tag: 'daily-reminder' }]);
});
