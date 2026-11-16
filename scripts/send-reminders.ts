/**
 * 每日提醒排程腳本（GitHub Actions 每 15 分鐘跑一次）。
 *   npx tsx scripts/send-reminders.ts            # 真的發送
 *   npx tsx scripts/send-reminders.ts --dry-run  # 只印出會發給誰
 * 需要環境變數 FIREBASE_SERVICE_ACCOUNT（服務帳號 JSON，放在 GitHub Secret）。
 */
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { initAdmin } from './lib/admin';
import { NOTIFICATION, runReminders, type PushSub } from './lib/reminders';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const app = initAdmin();
  if (!app) {
    console.log('尚未設定 FIREBASE_SERVICE_ACCOUNT，略過（Firebase 專案建立前這是正常的）。');
    return;
  }
  const db = getFirestore(app);
  const messaging = getMessaging(app);
  const col = db.collection('push_subs');

  const summary = await runReminders(
    {
      async listSubs() {
        const snap = await col.get();
        return snap.docs.map((d) => ({ id: d.id, data: d.data() as PushSub }));
      },
      async send(token) {
        await messaging.send({
          token,
          // 只送 data，由 App 的 service worker 顯示通知並處理點擊
          data: { title: NOTIFICATION.title, body: NOTIFICATION.body, link: NOTIFICATION.link },
          webpush: { headers: { Urgency: 'high', TTL: String(4 * 60 * 60) } },
        });
      },
      async markNotified(id, date) {
        await col.doc(id).set({ last_notified_date: date }, { merge: true });
      },
      async remove(id) {
        await col.doc(id).delete();
      },
      log: (m) => console.log(m),
    },
    new Date(),
    dryRun,
  );
  console.log(JSON.stringify({ dryRun, ...summary }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
