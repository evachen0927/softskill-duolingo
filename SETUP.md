# 上線步驟（給 Eva）

這份文件說明從「建立 Firebase 專案」到「App 上線、每天自動發提醒」要做哪些事。
**照著做就好，不需要寫程式。** 每一步都標了大約要花多久。

> 目前什麼都還沒建立、也還沒部署。App 在沒有 Firebase 的情況下照樣能用（資料只存在手機裡，可以在 `#/debug` 匯出）。

---

## 總覽

| 步驟 | 在哪裡做 | 時間 |
|---|---|---|
| 1. 建立 Firebase 專案 | Firebase 網站 | 5 分鐘 |
| 2. 開啟匿名登入 | Firebase 網站 | 1 分鐘 |
| 3. 建立 Firestore 資料庫、貼上安全規則 | Firebase 網站 | 5 分鐘 |
| 4. 註冊網頁 App，拿到設定值 | Firebase 網站 | 3 分鐘 |
| 5. 產生推播用的 VAPID 金鑰 | Firebase 網站 | 1 分鐘 |
| 6. 下載服務帳號金鑰 | Firebase 網站 | 2 分鐘 |
| 7. 把設定值和金鑰放進 GitHub | GitHub 網站 | 10 分鐘 |
| 8. 開啟 GitHub Pages、部署 | GitHub 網站 | 5 分鐘 |
| 9. 用手機測試 | 手機 | 10 分鐘 |

---

## 1. 建立 Firebase 專案

1. 打開 <https://console.firebase.google.com>，用要管理這個產品的 Google 帳號登入。
2. 點「建立專案」（Create a project）。
3. 專案名稱填 `softskill-duolingo`（或妳喜歡的名字）。**這是新專案，不要選既有專案。**
4. 「Google Analytics」可以先關掉，按「建立專案」，等它跑完。

## 2. 開啟匿名登入

使用者不用註冊帳號，App 會自動用「匿名身分」登入，才能把資料存到雲端。

1. 左邊選單 →「建構」（Build）→「Authentication」→「開始使用」。
2. 「登入方式」（Sign-in method）分頁 → 點「匿名」（Anonymous）→ 打開「啟用」→ 儲存。

## 3. 建立 Firestore 資料庫、貼上安全規則

Firestore 是存「答題紀錄」和「推播設定」的雲端資料庫。

1. 左邊選單 →「建構」→「Firestore Database」→「建立資料庫」。
2. 位置選 **`asia-east1`（台灣）**。這個之後不能改。
3. 模式選「正式版模式」（production mode），按「建立」。
4. 建好之後，點上方的「規則」（Rules）分頁。
5. 把專案裡 `firestore.rules` 這個檔案的**全部內容**複製，貼上取代原本的文字，按「發布」。

> 這份規則的意思是：使用者只能「新增」答題紀錄，不能讀別人的、也不能改；推播設定每人一份，只有本人能讀寫。

## 4. 註冊網頁 App，拿到設定值

1. 左上角齒輪 →「專案設定」→ 往下捲到「你的應用程式」→ 點網頁圖示 `</>`。
2. 暱稱填 `softskill-web`，**不要**勾「Firebase Hosting」，按「註冊應用程式」。
3. 畫面會出現一段 `firebaseConfig = { ... }`。把這 6 個值記下來（等一下第 7 步要用）：

| firebaseConfig 裡的名稱 | 等一下要填的名稱 |
|---|---|
| `apiKey` | `VITE_FIREBASE_API_KEY` |
| `authDomain` | `VITE_FIREBASE_AUTH_DOMAIN` |
| `projectId` | `VITE_FIREBASE_PROJECT_ID` |
| `storageBucket` | `VITE_FIREBASE_STORAGE_BUCKET` |
| `messagingSenderId` | `VITE_FIREBASE_MESSAGING_SENDER_ID` |
| `appId` | `VITE_FIREBASE_APP_ID` |

> 這 6 個值會出現在網頁裡，**不是秘密**，外人看到也沒關係（真正的保護是第 3 步的安全規則）。

## 5. 產生推播用的 VAPID 金鑰

1. 「專案設定」→「雲端通訊」（Cloud Messaging）分頁。
2. 往下找到「網路設定」→「網路推播憑證」（Web Push certificates）→ 點「產生金鑰組」。
3. 複製出現的那一長串金鑰，它就是 `VITE_FIREBASE_VAPID_KEY`。

## 6. 下載服務帳號金鑰（⚠️ 這是秘密）

每天發提醒的排程程式，需要這把鑰匙才能讀推播設定、發通知。

1. 「專案設定」→「服務帳戶」（Service accounts）分頁。
2. 點「產生新的私密金鑰」→「產生金鑰」，會下載一個 `.json` 檔。

> ⚠️ **這個檔案等於整個資料庫的管理員密碼。**
> - 不要傳到 LINE、Email、雲端硬碟，也不要放進程式碼或 GitHub 的檔案裡。
> - 只貼到第 7 步的 GitHub Secret，貼完就把電腦裡的檔案刪掉。
> - 如果不小心外流：回到這一頁把那把金鑰刪除，再產生一把新的。

## 7. 把設定值和金鑰放進 GitHub

打開這個專案的 GitHub 頁面 →「Settings」→ 左邊「Secrets and variables」→「Actions」。

**7-1. 放秘密（Secrets 分頁）** → 點「New repository secret」：

| Name | Secret（要貼的內容） |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | 第 6 步下載的 `.json` 檔，用記事本打開，**全部內容**複製貼上 |

**7-2. 放一般設定值（Variables 分頁）** → 點「New repository variable」，一個一個新增：

| Name | Value |
|---|---|
| `VITE_FIREBASE_API_KEY` | 第 4 步的 `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | 第 4 步的 `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | 第 4 步的 `projectId` |
| `VITE_FIREBASE_STORAGE_BUCKET` | 第 4 步的 `storageBucket` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | 第 4 步的 `messagingSenderId` |
| `VITE_FIREBASE_APP_ID` | 第 4 步的 `appId` |
| `VITE_FIREBASE_VAPID_KEY` | 第 5 步的金鑰 |

## 8. 開啟 GitHub Pages、部署

1. 「Settings」→ 左邊「Pages」→「Build and deployment」的「Source」選 **GitHub Actions**。
2. 到上方「Actions」分頁 → 左邊選「部署到 GitHub Pages（手動）」→ 右邊「Run workflow」→ 綠色按鈕「Run workflow」。
3. 大約 2 分鐘後跑完，網址會是 `https://<妳的 GitHub 帳號>.github.io/<專案名稱>/`。

> 部署只會在妳手動按下時發生，平常改程式不會自動上線。

**每日提醒的排程**（`每日提醒` 這個 workflow）會在專案推上 GitHub 後自動每 15 分鐘跑一次。
- 想先確認會發給誰：「Actions」→「每日提醒」→「Run workflow」，勾著「只印出會發給誰」（預設就是勾的）→ Run。點進那次執行看紀錄，就會列出名單，**不會真的發送**。
- GitHub 的排程可能會晚 5–15 分鐘，這是正常的；程式的判斷是「時間已過、今天還沒發」，所以晚了也不會漏發。
- 如果專案 60 天沒有任何更新，GitHub 會自動停用排程，要到「Actions」頁面重新啟用。

## 9. 用手機測試

**Android（Chrome）**
1. 用 Chrome 打開網址 → 走完引導 → 擊掌後按「開啟提醒」→ 允許。
2. 回到首頁「提醒設定」，把時間改成「現在時間的下一個 15 分鐘」。
3. 等排程跑（最多約 30 分鐘），應該會收到「今天的 5 分鐘練習還沒完成，要不要現在練？」。點通知會直接進今天的題目。

**iPhone（Safari，iOS 16.4 以上）**
1. 用 Safari 打開網址 → 點下方「分享」→「加入主畫面」→「加入」。
2. **從主畫面的圖示打開**（從 Safari 打開收不到通知）→ 走完引導 → 開啟提醒 → 允許。
3. 其餘同 Android。

> iPhone 的網頁通知限制比較多：沒有加入主畫面就收不到；使用者在系統設定關掉也收不到。這些情況 App 首頁都會顯示「今天的 5 分鐘還沒練」橫幅當後備提醒。

---

## 之後常用的事

**下載答題紀錄（分析答對率、錯選分布、👍👎）**
請工程師在電腦上執行：

```bash
FIREBASE_SERVICE_ACCOUNT="$(cat 金鑰.json)" npm run export-events
```

會產出 `events-日期.csv`，可以直接用 Excel 或 Google 試算表打開。

**不想讓排程繼續發提醒**
「Actions」→「每日提醒」→ 右上角「⋯」→「Disable workflow」。

---

## 給工程師：本機開發與測試

- `npm run dev`：開發模式**一律連本機 Emulator**，不會寫到真的 Firebase。要先另開一個終端機跑 `npm run emulators`（需要 Java 11+）。
- `npm test`：單元測試（Firebase 全部 mock）。
- `npm run test:rules`：用 Firestore Emulator 跑安全規則測試。
- `npm run e2e`：Playwright E2E 與 390px 截圖。
- `npm run reminders:dry-run`：本機試跑排程（要設 `FIREBASE_SERVICE_ACCOUNT`，或設 `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` 連 Emulator）。
