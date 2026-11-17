# 軟實力多鄰國 MVP（PWA）

## 開發
```bash
npm install
npm run dev          # http://localhost:5173
npm test             # 單元測試（在 UTC 和 Asia/Taipei 兩種時區各跑一次）
npx playwright install chromium   # 第一次跑 E2E 前
npm run e2e          # E2E + 390px 截圖（輸出到 screenshots/）
npm run build        # 產出 dist/
npm run typecheck    # App、service worker、腳本三組型別檢查
npm run emulators    # 本機 Firebase Emulator（npm run dev 一律連這裡，不會寫到真的 Firebase）
npm run test:rules   # Firestore 安全規則測試（需要 Java，會下載 Emulator）
```

上線步驟見 [SETUP.md](SETUP.md)。角色動態規格與設計預覽在 `docs/characters/`。
- 部署到子路徑：`VITE_BASE=/repo-name/ npm run build`
- Firebase 環境變數見 `.env.example`；沒設定時 App 以離線模式運作，事件存在 `softskill_event_queue`。

## 每週回報
從 Firestore 的 `events` 印出近 N 天的 Markdown 回報（繁體中文）。金鑰只放在環境變數，不要寫進檔案，也不要把報告提交進這個公開的 repo。

```bash
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}' node scripts/weekly-report.mjs
FIREBASE_SERVICE_ACCOUNT='...' EXCLUDE_DEVICES='測試機device_id,另一台' node scripts/weekly-report.mjs --days 7
```

`EXCLUDE_DEVICES` 是逗號分隔的 `device_id`，這些裝置的事件不會進報告。`--days` 預設 7。

## 目前進度
- [x] 第 0 批：專案骨架、底部四 tab、每日出題規則（`src/lib/dailySet.ts`）
- [x] 第 1 批：痛點引導、擊掌承諾、提醒時間、`#/debug`
- [x] 第 2 批：上司角色出題（一天 3 題、背景由暗變亮）、解析、👍👎
- [x] 第 3 批：首頁、連勝、小日曆、修改提醒時間
- [x] 第 4 批：通知權限、App 內後備提醒、推播排程、Firestore 規則、SETUP.md
- [x] 角色素材改版：正式的雲朵夥伴／方塊上司、`<Character>` 元件、motion-spec 動態（回頭套用到第 0–2 批）

## 套件與理由
| 套件 | 理由 |
|---|---|
| react、react-dom | 指定技術棧 |
| vite、@vitejs/plugin-react、typescript | 指定技術棧 |
| vite-plugin-pwa | 指定；產生 manifest 和 service worker |
| vitest、jsdom、@testing-library/react、@testing-library/jest-dom | 指定的單元測試工具（jsdom 是 Testing Library 需要的瀏覽器模擬） |
| @playwright/test | 指定的 E2E 和截圖工具 |
| firebase | 指定的後端（Firestore、匿名登入、FCM）；只在設定好 Firebase 時才動態載入，不進離線快取 |
| workbox-precaching、workbox-core | 自己寫 service worker（要接推播）時，離線快取和立即接管頁面要用；vite-plugin-pwa 本來就依賴它們 |
| firebase-admin（開發用） | 排程腳本與匯出腳本讀寫 Firestore、發 FCM |
| tsx（開發用） | 在 GitHub Actions 直接執行 TypeScript 腳本，不用另外編譯 |
| @firebase/rules-unit-testing（開發用） | 在 Emulator 上測 Firestore 安全規則 |
| @types/node（開發用） | 腳本的型別檢查 |

刻意沒加：react-router（自己寫 30 行的 hash router，`src/router.ts`）、日期套件（用內建 `Intl` 處理時區）。
