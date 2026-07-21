# AI 八字秘書（純前端可安裝版）

不用 npm、不用終端機、不用後端伺服器。純 HTML + CSS + JS，打開 `index.html`
就能用，並且可以安裝到手機主畫面，成為一個離線可用的 App。

## 這個版本跟原本規劃的差異

| 項目 | 原規劃 | 這個簡化版 |
|---|---|---|
| 技術架構 | React + Vite + Supabase | 純 HTML/CSS/JS，無需建置 |
| 資料儲存 | Supabase 雲端資料庫 | IndexedDB（純本機，只存在您的裝置） |
| 會員系統 | Email/Google 登入 | 無需登入，資料自動留在本機 |
| 付費解鎖 | 銀行匯款＋後台審核 | 輸入兌換碼即可解鎖（見下方說明） |
| AI 分析 | 可切換 OpenAI/Claude/Gemini | 純前端規則引擎，不連網也能運作 |

## 功能

- ✅ 八字排盤：年柱／月柱以「節氣」精確計算（非農曆初一），日柱用連續干支曆推算
  - 已用兩筆獨立公開命例交叉驗證排盤結果完全正確
- ✅ 命盤顯示：四柱、天干地支、藏干、十神、五行比例圖、納音
- ✅ 簡化版神煞：桃花、驛馬、華蓋
- ✅ 免費內容：四柱、五行、基礎性格分析
- ✅ 付費內容（兌換碼解鎖）：天賦分析、事業方向、感情策略（男女分流）、財富運勢、健康提醒
- ✅ 歷史命盤：可重複查看，存於本機 IndexedDB
- ✅ PWA：可安裝到 Android／iPhone 主畫面，支援離線使用

## 本機測試（不用裝任何東西）

方法一：直接雙擊 `index.html` 用瀏覽器打開即可看到畫面。

> 注意：直接用 `file://` 打開時，Service Worker（離線快取）與部分瀏覽器的
> IndexedDB 權限可能受限，建議測試「安裝」與「離線」功能時改用方法二。

方法二（推薦）：用簡易本機伺服器開啟，才能完整測試安裝與離線功能。
若電腦有裝 Python：

```bash
cd bazi-pwa
python3 -m http.server 8080
```

然後瀏覽器打開 `http://localhost:8080`。

## 部署到 GitHub Pages（讓手機可以真的安裝）

1. 到 [github.com](https://github.com) 新增一個 Repository（例如命名為 `bazi-app`）
2. 把這個資料夾（`bazi-pwa` 內的所有檔案，包含 `index.html`、`manifest.json`、
   `service-worker.js`、`css/`、`js/`、`icons/`）上傳到該 Repository 的根目錄
   - 最簡單的方式：在 GitHub 網頁上點「Add file → Upload files」，把整個資料夾內容拖曳上去
3. 進入 Repository 的 **Settings → Pages**
4. 「Source」選擇 **Deploy from a branch**，Branch 選 `main`，資料夾選 `/ (root)`，按 Save
5. 等 1-2 分鐘，GitHub 會給您一個網址，格式類似：
   `https://您的帳號.github.io/bazi-app/`
6. 用手機瀏覽器打開這個網址：
   - **Android（Chrome）**：畫面會跳出「加到主畫面」提示，或點右上角選單 →「安裝應用程式」
   - **iPhone（Safari）**：點下方分享圖示 →「加入主畫面」
7. 安裝完成後，手機主畫面會出現「八字秘書」App 圖示，點開就是全螢幕運作，
   之後離線也能開啟使用（排盤運算全部在手機本機完成）。

## 兌換碼設定

預設兌換碼是 `BAZI2026`，寫在 `js/app.js` 檔案最上方：

```js
const VALID_REDEEM_CODES = ['BAZI2026'];
```

**正式使用前，請務必修改成您自己的兌換碼**（可以放多組，用逗號分隔），
例如：

```js
const VALID_REDEEM_CODES = ['BAZI2026', 'VIP888', 'FRIEND999'];
```

改完存檔後，重新上傳到 GitHub 即可生效（若使用者已安裝 App，
下次開啟時 Service Worker 會自動檢查更新）。

## 更新版本後如何讓已安裝的使用者更新

修改任何檔案後，記得打開 `service-worker.js`，把這一行的版本號改掉：

```js
const CACHE_VERSION = 'ai-bazi-secretary-v1'; // 改成 v2, v3...
```

否則已安裝的使用者裝置上會一直保留舊版快取，看不到您的更新內容。

## 排盤準確度說明

- 節氣計算使用天文學通用的太陽視黃經近似公式，經與公開發布的節氣時刻比對，
  誤差約在 15-20 分鐘內，足以正確判斷「日期」層級的年柱／月柱交界。
- 極少數情況下，若出生時刻剛好落在節氣交界前後 20 分鐘內，可能出現邊界誤判，
  屬於已知限制。
- 日柱計算錨點已用兩筆獨立公開命例交叉驗證（1980-03-10 12:00 與
  2000-01-01 08:00，北京時間），排盤結果完全正確。

## 資料夾結構

```
bazi-pwa/
├── index.html          單頁應用主檔案
├── manifest.json        PWA 安裝設定
├── service-worker.js    離線快取
├── css/
│   └── style.css        科技玄學風格樣式
├── js/
│   ├── astro.js          天文節氣計算
│   ├── bazi.js            八字排盤核心引擎
│   ├── ai-rules.js       結構化命理規則引擎
│   ├── db.js              IndexedDB 儲存模組
│   └── app.js             主應用程式邏輯
└── icons/                PWA 圖示（192/512/maskable/apple-touch-icon）
```

## 之後想擴充怎麼辦？

- **想串接真正的 AI（GPT/Claude）分析文字**：修改 `js/ai-rules.js` 的
  `generateFullAnalysis()`，改成 `fetch()` 呼叫您的 AI API（需要另外架一個
  小型後端代理來保護 API 金鑰，不能把金鑰直接寫在前端程式碼裡）。
- **想要真的收款而不是兌換碼**：可以串接金流的付款連結，付款成功後由您
  手動告知使用者兌換碼即可，不需要大改架構。
- **想要跨裝置同步歷史命盤**：那就會需要回到原本規劃的 Supabase 後端版本。
