# 角色待機微動態規格（雲朵夥伴 orca-*／方塊上司 boss-*）

版本：2026-11-16　適用檔案：`final/` 內 7 支 SVG（檔名、viewBox、錨點不變）

## 0. 先說結論：「有桶」logo 實際上**沒有動畫**

查過 `/workspace/design-shots/logo/`（v2–v5 全部 svg／html）、`/workspace/trash-mvp/`（含 `assets/logo.svg`、`ui.css`、`ui.js`、所有 html）以及整個 `/workspace` 的 `@keyframes`／`<animate>`／`animation`：

- logo 與吉祥物 **沒有任何動畫實作**。v3 只有靜態表情檔（平常／開心／眨眼／休息中／快滿了），差異是靜態的蓋子角度，例如 `v3/M2-happy.svg` 為 `rotate(-18 6 9)`、`M2-neutral` `rotate(-8 6 9)`、`M2-wink` `rotate(-12 6 9)`、`M2-sleepy` `rotate(0 6 9)`。
- 上線版 logo `trash-mvp/assets/logo.svg`（v5）是純靜態；`ui.css` 對 logo 只有靜態的 `filter: drop-shadow(...)`。
- 「有桶」唯一的循環動畫在地圖「需求點」標記，不是 logo：`trash-mvp/index.html` 第 3–5 行
  `animation: needPulse 1.8s ease-out infinite`；`@keyframes needPulse{0%{transform:scale(1);opacity:.7}100%{transform:scale(2.6);opacity:0}}`；並有 `@media (prefers-reduced-motion:reduce){.needmk::after{animation:none;opacity:0}}`。

所以這份規格承接的「精神」是：**表情用靜態狀態切換來表達、循環動畫只有一種且很安靜、一定支援減少動態**。下面的微動態是新設計，不是復刻。

## 1. 圖層 id 與軸心

規則：**會被 CSS 動的圖層，本身都沒有 `transform` 屬性**（CSS transform 會覆蓋 SVG transform 屬性），所以可以直接動。`#face` 在 boss-correct／boss-wrong 有傾斜屬性，**不要對 `#face` 下 transform**，改動它裡面的 `#eye-l`／`#eye-r`。

軸心一律用 `transform-box: fill-box`（以該圖層自己的外框為準，跨瀏覽器可用），下表座標是驗證用（各檔自身 viewBox 單位，Chrome getBBox 實測）。

### 雲朵夥伴（orca-idle／raise／highfive，viewBox `-2 -4 38 36`，錨點＝腳底 y=29、x=14.2）

| id | 內容 | 建議 transform-origin（fill-box） | 參考座標 |
|---|---|---|---|
| `art` | 全部 | — | — |
| `bob` | 身體＋臉＋手（不含腿，腳底不動） | `50% 100%` | 底 (14.2, 24.0) |
| `body` / `sprout` | 身體／頭頂捲芽（三檔完全相同） | sprout：`40% 100%`（芽根） | 芽根約 (15.7, 4.5) |
| `eye-l` / `eye-r` | 單眼（白＋瞳孔＋反光一組） | `50% 50%` | idle (11.45, 11.40)／(17.27, 11.49)；raise (11.45, 11.18)／(17.27, 11.27) |
| `arm-l` / `arm-r` | 左／右手（＝舊 flipper-l／flipper-r，觀看者的左右） | `0% 100%`（肩） | — |
| `legs` | 腿＋腳（三檔相同，不要動） | — | 腳底 y=29.0 |
| `sparks` | 擊掌火花（只在 highfive） | `50% 50%` | (16.9, 4.5) |

highfive 的 `eye-l`/`eye-r` 是閉眼弧線，不做眨眼。

### 方塊上司（boss-ask／correct／wrong，viewBox `0 0 400 440`，半身，底邊 y=440 平切，身體底部中心 x=199）

| id | 內容 | transform-origin（fill-box） | 參考座標（ask） |
|---|---|---|---|
| `art` | 全部（含 clip `cut`） | 只在狀態切換用 `50% 100%` | 底邊中心 (200, 440) |
| `body` / `tie` / `arm-l` | 三檔完全相同 | tie：`50% 0%`（領結） | 領結 (202.9, 359.3) |
| `face` | 臉（correct +4°、wrong −5° 傾斜是屬性，不要動它） | — | — |
| `eye-l` / `eye-r` | 單眼一組；左小右大 | `50% 50%` | (145.8, 263.7)／(247.9, 249.1) |
| `brow-l` / `brow-r` | 眉毛 | `50% 50%` | (143.0, 225.4)／(244.8, 184.1) |
| `arm-r` | 姿勢手（ask 托下巴、correct 讚、wrong 拍拍） | ask/correct：`100% 100%`；wrong：`50% 50%` | — |
| `arm-l` | 下垂手 | — | — |

boss-enter（viewBox `80 90 686 690`，全身）：同樣有 `body face eye-l eye-r brow-l brow-r tie arm-l arm-r legs mug`；眼睛 (288.0, 385.3)／(413.6, 356.0)，領結 (369.6, 498.2)。

## 2. 待機循環（idle loops）

共通：所有循環都是 `transform`（不動 opacity 閃爍），沒有任何閃光；最快的動作是眨眼 160ms、間隔 ≥3.5s，遠低於每秒 3 次閃爍門檻。

| 角色 | 動作 | 圖層 | 屬性／幅度 | 時長 | 曲線 | 節奏 |
|---|---|---|---|---|---|---|
| 兩者 | 眨眼 | `#eye-l, #eye-r`（同時） | `scaleY(1→0.12→1)` | 160ms | `cubic-bezier(.4,0,.2,1)` | JS 隨機 3.5–5s 一次；10% 機率連眨兩下（間隔 220ms） |
| 夥伴 | 呼吸上下 | `#bob` | `translateY(0→-0.5)`（viewBox 單位，≈1.4% 畫布高；@190×180 約 2.5px） | 2.8s／來回 | `cubic-bezier(.45,0,.55,1)` | `infinite alternate` |
| 夥伴 | 捲芽擺動 | `#sprout` | `rotate(0→6°→-4°→0)` | 1.2s 動作＋2.4s 靜止（keyframe 0–33% 動、33–100% 停） | `cubic-bezier(.37,0,.63,1)` | 3.6s `infinite` |
| 上司 | 領帶輕擺 | `#tie` | `rotate(0→2.5°→-2°→0)` | 1.4s 動作＋3.6s 靜止 | `cubic-bezier(.37,0,.63,1)` | 5s `infinite`；**出題中只跑第一輪，見下** |
| 上司 | 不做上下呼吸 | — | 半身底邊必須貼齊題目卡，translateY 會露出縫 | — | — | — |

### 出題中（題目顯示時）的上司規則
- 只保留**眨眼**；`#tie` 只在題目出現後的前 2s 擺一次，之後停住（`animation-iteration-count:1`）。
- 任何東西都不往下動、不靠近選項區；`#arm-r` 在出題中完全靜止。
- 作答回饋（correct／wrong）結束、回到下一題前，才可恢復循環。

### 何時暫停
- 角色不在畫面上（IntersectionObserver `threshold:0`）或分頁隱藏（`visibilitychange`）→ 加 `.is-paused`：`animation-play-state:paused`，並停掉眨眼計時器。

## 3. 狀態切換動態（工程已規劃的部分）

| 時機 | 圖層 | 動態 | 時長／曲線 |
|---|---|---|---|
| 上司出場 boss-enter | `#art` | `translate(-12%, 10%) rotate(-6deg)` → 0，opacity 0→1（只在開頭 120ms） | 480ms `cubic-bezier(.22,1,.36,1)`；落地後 120ms 交叉淡入 boss-ask |
| 答對 boss-correct | `#art`（origin `50% 100%`） | 擠壓回彈：`scaleY 1→1.05→0.97→1`、`scaleX 1→0.97→1.02→1`（**底邊不離開題目卡**） | 520ms `cubic-bezier(.34,1.56,.64,1)` 一次 |
| 答對 boss-correct | `#arm-r`（origin `100% 100%`） | 讚的手 `rotate(-14deg→0)` 彈出 | 320ms `cubic-bezier(.34,1.56,.64,1)`，延遲 80ms |
| 答錯 boss-wrong | `#arm-r`（origin `50% 50%`） | 拍拍：`translateY(0→6→0→4→0)`（viewBox 單位） | 2 下共 640ms `cubic-bezier(.45,0,.55,1)`；**不搖頭**（左右搖頭容易讀成「不對！」） |
| 夥伴 raise→highfive | `#arm-r`（origin `0% 100%`） | `rotate(8deg→0)` 拍上去 | 200ms `cubic-bezier(.2,.9,.3,1.3)` |
| 夥伴 highfive | `#sparks`（origin `50% 50%`） | `scale(.6→1)` + `opacity 0→1`（單次，不閃），900ms 後 `opacity→0` 300ms | 260ms `cubic-bezier(.22,1,.36,1)` |
| 夥伴 highfive | `#bob` | 跳一下 `translateY(0→-1.2→0)`（腳不離地） | 360ms `cubic-bezier(.34,1.56,.64,1)` |

## 4. 減少動態 `prefers-reduced-motion: reduce`
- 關掉所有循環（眨眼計時器也不啟動），角色保持靜態。
- 狀態切換改為 150ms opacity 交叉淡入（或直接切換）；出場不位移。

## 5. CSS 片段

```css
/* 共用：要動的圖層用自身外框當軸心 */
.char svg #eye-l, .char svg #eye-r { transform-box: fill-box; transform-origin: 50% 50%; }
.char svg #sprout { transform-box: fill-box; transform-origin: 40% 100%; }
.char svg #tie    { transform-box: fill-box; transform-origin: 50% 0%; }
.char svg #bob    { transform-box: fill-box; transform-origin: 50% 100%; }
.char svg #art    { transform-box: fill-box; transform-origin: 50% 100%; }

/* 眨眼：由 JS 加上 .blink，結束後移除 */
@keyframes blink { 0%,100% { transform: scaleY(1); } 45%,55% { transform: scaleY(.12); } }
.char.blink svg #eye-l, .char.blink svg #eye-r { animation: blink 160ms cubic-bezier(.4,0,.2,1); }

/* 夥伴：呼吸＋捲芽 */
@keyframes bob { from { transform: translateY(0); } to { transform: translateY(-0.5px); } } /* 單位＝viewBox 單位（SVG 內 px 即 user unit） */
.buddy svg #bob { animation: bob 2.8s cubic-bezier(.45,0,.55,1) infinite alternate; }
@keyframes sprout { 0%,33%,100% { transform: rotate(0); } 11% { transform: rotate(6deg); } 22% { transform: rotate(-4deg); } }
.buddy svg #sprout { animation: sprout 3.6s cubic-bezier(.37,0,.63,1) infinite; }

/* 上司：領帶輕擺；出題中只擺一次 */
@keyframes tie { 0%,28%,100% { transform: rotate(0); } 9% { transform: rotate(2.5deg); } 19% { transform: rotate(-2deg); } }
.boss svg #tie { animation: tie 5s cubic-bezier(.37,0,.63,1) infinite; }
.boss.is-asking svg #tie { animation-iteration-count: 1; animation-duration: 2s; }  /* 前 2s 擺一次後停 */

/* 狀態切換 */
@keyframes enter { from { transform: translate(-12%,10%) rotate(-6deg); opacity: 0; } 25% { opacity: 1; } to { transform: none; opacity: 1; } }
.boss.entering svg #art { animation: enter 480ms cubic-bezier(.22,1,.36,1) both; }
@keyframes squash { 0%,100% { transform: scale(1,1); } 35% { transform: scale(.97,1.05); } 70% { transform: scale(1.02,.97); } }
.boss.correct svg #art { animation: squash 520ms cubic-bezier(.34,1.56,.64,1); }
@keyframes pat { 0%,50%,100% { transform: translateY(0); } 25% { transform: translateY(6px); } 75% { transform: translateY(4px); } }
.boss.wrong svg #arm-r { animation: pat 640ms cubic-bezier(.45,0,.55,1); }

/* 暫停／減少動態 */
.char.is-paused svg * { animation-play-state: paused !important; }
@media (prefers-reduced-motion: reduce) {
  .char svg * { animation: none !important; }
  .char-swap { transition: opacity 150ms linear; }
}
```

注意：要讓 CSS 選到 SVG 內的 id，SVG 必須**內嵌**（inline，或用 `<object>`／fetch 後插入）；用 `<img>` 載入時無法動內部圖層，只能動整張圖。同一頁若同時內嵌多張，id 會重複，請用外層 class（如上面的 `.buddy`、`.boss`）限定選取範圍；`boss-*` 的 `clipPath id="cut"` 三檔定義相同，重複不影響外觀，若要嚴謹可在插入時改名。

```js
// 隨機眨眼（3.5–5s），10% 機率連眨；分頁隱藏或離開畫面時暫停
function startBlink(el){
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  let t;
  const once = () => { el.classList.remove('blink'); void el.getBoundingClientRect(); el.classList.add('blink'); };
  const tick = () => {
    if (!el.classList.contains('is-paused')) { once(); if (Math.random() < .1) setTimeout(once, 220); }
    t = setTimeout(tick, 3500 + Math.random() * 1500);
  };
  t = setTimeout(tick, 1200 + Math.random() * 1500);
  const io = new IntersectionObserver(([e]) => el.classList.toggle('is-paused', !e.isIntersecting));
  io.observe(el);
  const vis = () => el.classList.toggle('is-paused', document.hidden);
  document.addEventListener('visibilitychange', vis);
  return () => { clearTimeout(t); io.disconnect(); document.removeEventListener('visibilitychange', vis); };
}
```

## 6. 預覽
`final/motion-preview.html`：內嵌 7 支 SVG 套用上面的 CSS／JS，可切換「出題中」、觸發答對／答錯、模擬減少動態。
