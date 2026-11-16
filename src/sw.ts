/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { notificationUrl, parsePushPayload } from './lib/swHelpers';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// 每日提醒：FCM 送 data 訊息，由我們自己顯示通知（iOS 規定每則推播都要顯示）
self.addEventListener('push', (event) => {
  let raw: unknown = {};
  try {
    raw = event.data?.json();
  } catch {
    raw = { body: event.data?.text() };
  }
  const p = parsePushPayload(raw);
  event.waitUntil(
    self.registration.showNotification(p.title, {
      body: p.body,
      icon: `${self.registration.scope}icons/icon-192.png`,
      badge: `${self.registration.scope}icons/icon-192.png`,
      tag: 'daily-reminder', // 同一天就算重複送，也只會留一則
      data: { link: p.link },
    }),
  );
});

// 點通知：已開著 App 就切過去並進入今日題，沒開就開新視窗
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = notificationUrl(self.registration.scope, (event.notification.data as { link?: string })?.link ?? '');
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const client = all.find((c) => c.url.startsWith(self.registration.scope)) as WindowClient | undefined;
      if (client) {
        await client.focus();
        await client.navigate(url).catch(() => undefined);
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
