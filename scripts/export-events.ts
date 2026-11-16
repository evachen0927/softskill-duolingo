/**
 * 把 Firestore 的 events 匯出成 CSV（給 Eva 看答對率、錯選分布、👍👎）。
 *   npx tsx scripts/export-events.ts                  # 輸出 events-YYYY-MM-DD.csv
 *   npx tsx scripts/export-events.ts out/events.csv   # 指定檔名
 * 需要 FIREBASE_SERVICE_ACCOUNT；設定 FIRESTORE_EMULATOR_HOST 時改讀 Emulator。
 */
import { writeFileSync } from 'node:fs';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from './lib/admin';
import { eventsToCSV } from '../src/lib/csv';

async function main() {
  const app = initAdmin();
  if (!app) {
    console.error('請先設定 FIREBASE_SERVICE_ACCOUNT（服務帳號 JSON）。');
    process.exit(1);
  }
  const snap = await getFirestore(app).collection('events').orderBy('ts').get();
  const rows = snap.docs.map((d) => d.data());
  const file = process.argv[2] || `events-${new Date().toISOString().slice(0, 10)}.csv`;
  writeFileSync(file, '﻿' + eventsToCSV(rows)); // BOM：Excel 開中文不亂碼
  console.log(`已匯出 ${rows.length} 筆事件到 ${file}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
