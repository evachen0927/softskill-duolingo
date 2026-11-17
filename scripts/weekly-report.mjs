/**
 * 近 N 天的使用回報，印到標準輸出（Markdown，繁體中文）。
 *   FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}' node scripts/weekly-report.mjs
 *   FIREBASE_SERVICE_ACCOUNT='...' EXCLUDE_DEVICES='id1,id2' node scripts/weekly-report.mjs --days 14
 * 不要把服務帳號或報告內容提交進這個公開的 repo。
 */
import { pathToFileURL } from 'node:url';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const REASON_LABEL = {
  too_easy: '太簡單',
  irrelevant: '跟我的工作無關',
  unclear: '解析看不懂',
  other: '其他',
};

const USEFUL_LABEL = {
  yes: '用得到',
  maybe: '可能',
  no: '用不到',
};

const TAB_ORDER = ['題庫', 'AI 對話練習', '關於我'];

function quote(text) {
  return `「${String(text).replace(/\s+/g, ' ').trim()}」`;
}

function pct(part, whole) {
  if (!whole) return '尚無';
  return `${Math.round((100 * part) / whole)}%`;
}

/** 純函式：把事件陣列做成 Markdown。測試與指令稿共用。 */
export function buildWeeklyReport(events, { days = 7, since, until = new Date(), exclude = [] } = {}) {
  const skip = new Set(exclude.map((id) => String(id).trim()).filter(Boolean));
  const start = since ? new Date(since) : new Date(until.getTime() - days * 86_400_000);
  const rows = events.filter((e) => {
    if (!e || skip.has(e.device_id)) return false;
    const t = Date.parse(e.ts);
    return Number.isFinite(t) && t >= start.getTime() && t <= until.getTime();
  });

  const devices = new Set(rows.map((e) => e.device_id));
  const finished = new Set(rows.filter((e) => e.type === 'day_complete').map((e) => e.device_id));

  const questions = new Map();
  const touch = (id) => {
    if (!questions.has(id)) {
      questions.set(id, { answers: 0, correct: 0, up: 0, down: 0, reasons: { too_easy: 0, irrelevant: 0, unclear: 0, other: 0 }, notes: [] });
    }
    return questions.get(id);
  };
  for (const e of rows) {
    if (e.type === 'answer' && e.question_id) {
      const q = touch(e.question_id);
      q.answers += 1;
      if (e.correct === true) q.correct += 1;
    } else if (e.type === 'feedback' && e.question_id) {
      const q = touch(e.question_id);
      if (e.feedback === 'up') q.up += 1;
      if (e.feedback === 'down') q.down += 1;
    } else if (e.type === 'feedback_reason' && e.question_id && REASON_LABEL[e.reason]) {
      const q = touch(e.question_id);
      q.reasons[e.reason] += 1;
      if (e.text) q.notes.push(e.text);
    }
  }

  const useful = { yes: 0, maybe: 0, no: 0 };
  for (const e of rows) {
    if (e.type === 'unit_useful' && USEFUL_LABEL[e.answer]) useful[e.answer] += 1;
  }

  const tabs = new Map();
  const tabOf = (name) => {
    if (!tabs.has(name)) tabs.set(name, { views: new Set(), interest: new Set(), wishes: [] });
    return tabs.get(name);
  };
  for (const e of rows) {
    if (!e.tab) continue;
    if (e.type === 'tab_view') tabOf(e.tab).views.add(e.device_id);
    if (e.type === 'feature_interest') tabOf(e.tab).interest.add(e.device_id);
    if (e.type === 'feature_wish' && e.text) tabOf(e.tab).wishes.push(e.text);
  }

  const fmt = (d) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const lines = [
    `# 軟實力多鄰國｜近 ${days} 天回報`,
    '',
    `統計區間：${fmt(start)} ～ ${fmt(until)}（台北時間）`,
    '',
    '## 使用狀況',
    `- 有活動的裝置：${devices.size}`,
    `- 完成過一天的裝置：${finished.size}`,
    '',
    '## 各題',
  ];
  const qids = [...questions.keys()];
  if (qids.length === 0) lines.push('- 這段時間沒有作答。');
  for (const id of qids) {
    const q = questions.get(id);
    lines.push(`### ${id}`);
    lines.push(`- 作答 ${q.answers} 次，答對率 ${pct(q.correct, q.answers)}`);
    lines.push(`- 👍 ${q.up}、👎 ${q.down}`);
    lines.push(`- 👎 原因：太簡單 ${q.reasons.too_easy}、跟我的工作無關 ${q.reasons.irrelevant}、解析看不懂 ${q.reasons.unclear}、其他 ${q.reasons.other}`);
    if (q.notes.length) {
      lines.push('- 其他原話：');
      for (const note of q.notes) lines.push(`  - ${quote(note)}`);
    }
    lines.push('');
  }

  lines.push('## 這週用得到嗎');
  lines.push(`- 用得到 ${useful.yes}`);
  lines.push(`- 可能 ${useful.maybe}`);
  lines.push(`- 用不到 ${useful.no}`);
  lines.push('');
  lines.push('## 即將推出');
  const names = [...new Set([...TAB_ORDER, ...tabs.keys()])].filter((name) => tabs.has(name));
  if (names.length === 0) lines.push('- 這段時間沒有人打開即將推出的分頁。');
  for (const name of names) {
    const t = tabs.get(name);
    lines.push(`### ${name}`);
    lines.push(`- 看過的裝置：${t.views.size}`);
    lines.push(`- 想要的裝置：${t.interest.size}`);
    lines.push(`- 興趣率：${pct(t.interest.size, t.views.size)}`);
    if (t.wishes.length) {
      lines.push('- 想法：');
      for (const text of t.wishes) lines.push(`  - ${quote(text)}`);
    } else {
      lines.push('- 想法：沒有');
    }
    lines.push('');
  }
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n')}\n`;
}

function readDays(argv) {
  const i = argv.indexOf('--days');
  if (i < 0) return 7;
  const n = Number(argv[i + 1]);
  if (!Number.isInteger(n) || n < 1) {
    console.error('--days 要是正整數');
    process.exit(1);
  }
  return n;
}

async function main() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.error('請設定環境變數 FIREBASE_SERVICE_ACCOUNT（服務帳號 JSON 字串）。');
    process.exit(1);
  }
  let sa;
  try {
    sa = JSON.parse(raw);
  } catch {
    console.error('FIREBASE_SERVICE_ACCOUNT 不是合法的 JSON。');
    process.exit(1);
  }
  const days = readDays(process.argv);
  const until = new Date();
  const since = new Date(until.getTime() - days * 86_400_000);
  const exclude = (process.env.EXCLUDE_DEVICES || '').split(',');
  const app = initializeApp({ credential: cert(sa), projectId: sa.project_id });
  const snap = await getFirestore(app).collection('events').where('ts', '>=', since.toISOString()).get();
  const events = snap.docs.map((d) => d.data());
  process.stdout.write(buildWeeklyReport(events, { days, since, until, exclude }));
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
