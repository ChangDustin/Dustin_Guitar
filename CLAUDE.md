# 小齊吉他 Dustin Guitar — 專案手冊（CLAUDE.md）

> 這份手冊寫給「之後接手這個專案的 AI」。每次開工前先完整讀完本檔與 `NOTES.md`；收工前更新 `NOTES.md`。
> 手冊與實際程式不一致時，以手冊為準並回報差異；若站長糾正了你的做法，把新規則補進本檔並記在最後的〈手冊更新紀錄〉。

---

## 1. 這裡是什麼

**小齊吉他 Dustin Guitar** 是站長小齊（張紘齊，中央大學資工）的個人指彈吉他網站，網址
<https://changdustin.github.io/Dustin_Guitar/>，原始碼 <https://github.com/ChangDustin/Dustin_Guitar>。

網站有三種使用者：

| 角色 | 能做什麼 | 資料存在哪 |
|---|---|---|
| 訪客 | 看品牌介紹、逛曲庫、看譜與影片、讀技巧小百科與文章、用練琴工具 | — |
| 學員（註冊帳號） | 標記自己的歌曲進度與筆記、收藏歌曲、記錄練習日誌（熱度圖） | Firebase（只有本人讀寫得到） |
| 站長（管理密碼） | 用「管理模式」編輯所有內容，按「發布到網站」commit 回 GitHub | 本 repo 的 `content/` 與 `media/` |

網站由下列區塊組成，每一塊都對應一種內容檔（見第 3 節）：

- **首頁／關於我**：自我介紹、照片、學琴歷程、器材、社群連結 → `content/site.json`
- **曲庫**：歌曲卡片、難度五格、版本（簡單版／進階版）、精選歌單 → `content/songs.json`、`content/playlists.json`
- **技巧小百科**：每個技巧一頁 → `content/techniques/*.md`
- **文章**：教學與樂理筆記 → `content/articles/*.md`
- **學習路徑**：由淺到深的關卡 → `content/path.json`
- **練琴工具**：調音器、和弦字典、節拍器、影片 A-B 循環 → 程式在 `assets/js/`，和弦資料在 `content/chords.json`

技術一句話：**純靜態網站**（HTML＋CSS＋原生 JavaScript ES modules，沒有框架、沒有建置步驟），放在 GitHub Pages；內容全部是 `content/` 裡的 JSON 與 Markdown；學員資料在 Firebase Authentication＋Firestore。

---

## 2. 資料夾地圖

```
index.html                 網站外殼（頁首、<main id="app">、頁尾），所有頁面都由 JS 渲染
assets/css/
  tokens.css               設計變數（色票、字體、間距、圓角）——唯一可以寫色碼的地方
  base.css                 重設、排版、按鈕、表單
  components.css           共用元件（卡片、徽章、對話框、提示、發布列…）
  pages.css                各頁面專屬樣式，依頁面分段，段落標題 /* == 頁面名 == */
assets/js/
  main.js                  啟動：載入內容 → 初始化帳號 → 啟動路由
  core/                    共用核心：dom、store（內容與草稿）、router、ui、markdown、music、chords、audio、cdn、frontmatter、schema、validate、content-index
  components/              可重複使用的介面元件（歌曲卡、難度、和弦圖、熱度圖、PDF 檢視器、影片播放器、指板…）
  pages/                   一個路由一個檔案（home.js、songs.js、song.js…）
  account/                 學員帳號：auth.js（統一介面）、firebase.js、local.js（示範模式）、progress.js
  admin/                   站長管理模式：admin.js（登入、選單）、publish.js（發布）、github.js、media.js（裁切封面、PDF 抽頁）、editors/*.js（每種內容一個編輯器）
assets/img/                網站圖示（favicon）
content/
  site.json                網站設定＋站長品牌資料
  songs.json               所有歌曲
  playlists.json           精選歌單／合輯
  path.json                學習路徑
  chords.json              和弦字典的開放和弦指型（封閉和弦由程式自動產生）
  techniques/<slug>.md     技巧小百科，一個技巧一個檔
  articles/<slug>.md       文章，一篇一個檔
  index.json               ⚠️ 自動產生的目錄（npm run index），不要手改
media/
  covers/                  歌曲方形封面（720×720 JPG）
  tabs/                    樂譜 PDF
  videos/                  上傳的影片檔（盡量改用 YouTube）
  photos/                  站長照片、器材照、歷程照片
  notes/                   上課筆記與文章插圖
scripts/                   Node 工具（不需安裝任何套件）：serve、build-index、check-content、new-content；live-check（驗收線上版，要先 npm install）
templates/                 新內容的樣板（歌曲、技巧、文章、歌單、頁面）
tests/                     Playwright 自動化測試；helpers.js 提供假的 YouTube、假管理密碼、假 GitHub API
playwright.config.js       測試設定（桌機 1280px＋手機 390px，用電腦已安裝的 Chrome）
.github/workflows/         GitHub Actions：每次 push（包含站長從網站發布）自動跑 npm run check
firestore.rules            Firebase 安全規則（學員只能讀寫自己的資料）
CLAUDE.md                  本手冊（AGENTS.md 只是指向本檔）
NOTES.md                   工作日誌：做到哪、下次從哪開始
README.md                  給人看的專案簡介
.nojekyll                  空檔案，關掉 GitHub Pages 的 Jekyll（不然 .md 會被轉成 .html，網站讀不到）
```

---

## 3. 內容格式（最重要）

### 3.1 共同規則

- **slug／id**：小寫英文、數字、連字號，例如 `like-a-star`、`hammer-on`。中文歌名用拼音或英文意譯（`童話` → `tonghua`）。**檔名必須等於 slug**。
- **日期**：文章日期用 `YYYY-MM-DD`；`createdAt`／`updatedAt` 用 ISO 時間（`2026-11-11T08:00:00.000Z`）。
- **文字**：繁體中文、全形標點（，。、：「」），中英文之間加半形空格。
- **交叉連結語法**（Markdown 與歌曲的 `highlights` 都能用）：
  `[[song:like-a-star]]`、`[[technique:hammer-on]]`、`[[article:how-to-read-tab]]`、`[[chord:Am7]]`
  可加顯示文字：`[[technique:hammer-on|搥弦]]`。`npm run check` 會檢查每個連結都找得到對象。

### 3.2 歌曲 `content/songs.json`

格式：`{ "songs": [ 歌曲, … ] }`。一首歌（或一個版本）一筆：

| 欄位 | 必填 | 格式 | 說明 |
|---|---|---|---|
| `id` | ✔ | slug | 唯一；決定網址 `#/songs/<id>` 與封面、樂譜檔名 |
| `title` | ✔ | 字串 | 歌名（保留原文，例：`小さな恋のうた`） |
| `titleZh` | | 字串 | 中文譯名（例：`小小戀歌`） |
| `artist` | ✔ | 字串 | 原唱／作曲；不知道就寫 `""` |
| `arranger` | | 字串 | 編曲／採譜者 |
| `difficulty` | ✔ | 整數 1–5 | 1 入門、2 初階、3 中階、4 中進階、5 高階（顯示成 ●●●○○） |
| `status` | ✔ | `想學`／`練習中`／`已學會` | **站長自己的**進度（學員的進度存在 Firebase，不寫在這裡） |
| `group` | | slug | 同一首歌的不同編曲用同一個 `group`，網站會合併成一張卡片 |
| `version` | 有 `group` 時必填 | 字串 | 版本名稱，例：`簡單版`、`Sungha Jung 版` |
| `tuning` | ✔ | 調弦 id | `standard`、`half-step-down`、`whole-step-down`、`drop-d`、`dadgad`、`open-d`、`open-g`、`cgdgad`、`custom` |
| `tuningNotes` | `custom` 時必填 | 6 個音名陣列 | **由 6 弦（最低）到 1 弦**，例：`["B1","G2","D3","F#3","A3","D4"]` |
| `capo` | ✔ | 整數 0–12 | 0 代表不用 |
| `bpm` | | 整數或 `null` | 譜上標的速度 |
| `key` | | 字串 | 調性，例 `E`、`C#m` |
| `tags` | | 字串陣列 | 自由標籤（`動漫`、`華語`…） |
| `techniques` | ✔ | 技巧 slug 陣列 | **唯一的「哪首歌用到哪個技巧」來源**；技巧頁的「練習曲」清單由這裡自動產生 |
| `chords` | | 和弦名稱陣列 | 名稱寫法見 3.8。標準調弦、降半音、降全音的歌會畫出指型圖；其他調弦（Drop D、DADGAD、Open、`custom`）一般指型對不上，只列出和弦名稱 |
| `highlights` | ✔ | Markdown 字串 | 技巧重點：2–4 個條列，每條說「哪一段＋要注意什麼」，並用 `[[technique:…]]` 連到技巧頁 |
| `cover` | | 路徑 | `media/covers/<id>.jpg` |
| `pdf` | | 物件 | `{ "path": "media/tabs/<id>.pdf", "pages": 9, "totalPages": 9, "preview": false }`；`preview: true` 代表站長只公開部分頁面（`pages` 小於 `totalPages`） |
| `videos` | | 陣列 | `[{ "label": "參考演奏：Sungha Jung", "url": "https://www.youtube.com/watch?v=…" }]` |
| `source` | | 物件 | 樂譜來源 `{ "name": "Musicnotes", "url": "https://…" }` |
| `notes` | | 字串 | 站長的練習筆記（純文字，可換行） |
| `createdAt` / `updatedAt` | ✔ | ISO 時間 | |

- 首頁「小齊最近在練」自動列出 `status` 為 `練習中` 的歌（依 `updatedAt` 新到舊，最多 4 張），不需要另外標記。
- 範例與空白樣板：`templates/song.json`。

### 3.3 歌單 `content/playlists.json`

`{ "playlists": [ { "id", "title", "description", "cover"（可空）, "songIds": [歌曲 id…], "featured": true } ] }`
`songIds` 的順序就是顯示順序；同一首歌可以在多個歌單。

### 3.4 技巧 `content/techniques/<slug>.md`

開頭是 front matter，內文**固定四段、順序不可改**：

```markdown
---
title: 搥弦
slug: hammer-on
symbol: H
group: 左手
level: 2
summary: 左手手指像小鐵鎚一樣敲下琴格發出聲音，右手不用再撥一次。
tags: [連音, 左手]
related: [pull-off, slide]
cover: ""
updated: 2026-11-11
---

## 是什麼
（2–4 句，說明聲音與原理）

## 怎麼練
1. （3–5 個步驟，從慢到快）

## 常見錯誤
- （2–4 條，錯在哪＋怎麼改）

## 在譜上長這樣
（說明 TAB 記號；可插入站內圖片 `![說明](media/notes/xxx.jpg)`）
```

- `group`：`左手`、`右手`、`和弦`、`調弦與移調` 其中之一。
- `level`：建議開始學的難度（1–5），學習路徑會參考。
- **不要在技巧頁手寫「哪些歌用到」**——網站會從 `songs.json` 的 `techniques` 自動列出。

### 3.5 文章 `content/articles/<slug>.md`

```markdown
---
title: 第一次看 TAB 譜就上手
slug: how-to-read-tab
category: 新手上路
summary: 一句話說這篇在講什麼（顯示在卡片上，60 字內）。
tags: [TAB, 新手]
related: [hammer-on, capo]
cover: ""
date: 2026-11-11
---
```

- `category` 只能是：`新手上路`、`技巧教學`、`樂理筆記`、`練習心得`、`器材`。
- 內文用 `##`（大段）與 `###`（小段）標題；網站會自動用 `##`／`###` 產生目錄，所以**不要手寫目錄**。
- `related` 可以放技巧或文章的 slug，網站會顯示成「延伸閱讀」。

### 3.6 學習路徑 `content/path.json`

`{ "stages": [ { "id", "title", "goal", "techniques": [slug…], "songs": [id…], "articles": [slug…] } ] }`
陣列順序就是學習順序；每關 2–4 個技巧、3–6 首歌。學員的完成度由他們標成「已學會」的歌自動計算。

### 3.7 網站設定與品牌資料 `content/site.json`

- `title`、`titleEn`、`tagline`：網站名稱與標語。
- `profile`：`name`、`photo`、`bio`（Markdown）、`location`、`startedYear`。
- `timeline`：學琴歷程 `[{ "date": "2024-09", "title", "text", "photo" }]`，依時間排序。
- `gear`：器材 `[{ "name", "type", "photo", "note" }]`，`type` 例：`吉他`、`弦`、`Capo`、`配件`。
- `socials`：`[{ "type": "youtube", "url" }]`，`type` 可用 `youtube`、`instagram`、`facebook`、`threads`、`tiktok`、`website`、`email`。
- `firebase`：Firebase 網頁設定（公開資訊，可以 commit）。是 `null` 時學員功能自動改用「示範模式」，帳號與進度只存在該瀏覽器的 localStorage；網址加 `?demo`（例如 `/?demo#/me`）也會強制示範模式。
- `admin`：管理密碼的 PBKDF2 雜湊。**AI 絕對不能修改這一欄。**
- `github`：發布目標 `{ "owner", "repo", "branch" }`。

站長資料（照片、介紹、歷程、器材、社群）**由站長自己在管理模式填寫**。AI 不要替站長編造個人經歷；欄位空著時網站會自動隱藏該區塊。

### 3.8 和弦 `content/chords.json`

`{ "chords": { "Am7": [ { "frets": [-1,0,2,0,1,0], "fingers": [0,0,2,0,1,0] } ] } }`

- `frets` 由 6 弦到 1 弦，`-1` 不彈、`0` 空弦；`fingers` 0 代表不按；可加 `"barre": { "fret": 1, "from": 6, "to": 1 }`。
- 和弦名稱寫法：`C`、`Cm`、`C7`、`Cmaj7`、`Cm7`、`Csus2`、`Csus4`、`Cadd9`、`Cdim`、`Cm7b5`、`C/E`（升記號用 `#`，降記號用 `b`）。
- 封閉和弦（E 型、A 型）由程式自動產生，這裡只需要放開放和弦與常用分割和弦。

---

## 4. 我的習慣（命名、放置、風格）

### 4.1 檔案放置

| 內容 | 放哪裡 | 檔名 |
|---|---|---|
| 歌曲封面 | `media/covers/` | `<歌曲 id>.jpg`，720×720 |
| 樂譜 | `media/tabs/` | `<歌曲 id>.pdf` |
| 站長／器材照片 | `media/photos/` | `<用途>-<簡短名稱>.jpg`，長邊 ≤ 1600px |
| 筆記與文章插圖 | `media/notes/` | `<文章或技巧 slug>-<序號>.jpg` |

管理模式上傳的檔案會自動加上亂數後綴（避免快取），這是正常的；**AI 不要改既有媒體檔的檔名**（會讓連結失效）。

### 4.2 文字風格

- 用第一人稱「我」代表小齊，語氣像學長分享練琴心得：具體、誠實、不誇大。
- 技巧講解要能照著做：說清楚「哪隻手、哪個手指、哪一格、多快」。
- 歌曲的 `highlights` 只寫譜上看得到、可以驗證的事（調弦、Capo、技巧記號、段落），不要編造。
- 不寫「完美」「超神」這類空話；不用表情符號當標題。

### 4.3 視覺風格（原木琥珀）

- 色票只能用 `assets/css/tokens.css` 的變數，**禁止在其他檔案寫色碼**（`#xxxxxx`、`rgb()`、`hsl()`；CSS 檔由 `npm run check` 自動檢查，JS 裡的 inline style 也一樣不准）：
  `--spruce`（底色 #F7F0E1）、`--bone`（卡片 #FCFAF4）、`--rosewood`（深色 #2B1A12）、`--ink`（文字）、`--amber`（主色 #B0692B）、`--abalone`（學員自己的資料、互動狀態 #2E7D76）、`--nickel`（線條）。
- 字體：標題「霞鶩文楷 TC」（`--font-hand`），內文 Noto Sans TC（`--font-body`），數字 Barlow Condensed（`--font-num`）。
- 首頁唯一的大動作是「音孔花紋相框＋可彈指板」；其他區塊保持安靜：不要每張卡片都加進場動畫、不要漸層裝飾。
- 編號只用在真的有順序的內容（學習路徑、歷程）。不要全大寫英文標籤，不要在連結文字後面加「→」。
- 手機（375px）不能出現水平捲動；鍵盤焦點要看得見；尊重 `prefers-reduced-motion`。

### 4.4 程式寫法

- 原生 ES modules，不引入框架、不加建置步驟。外部函式庫只用固定版本 CDN，目前清單：
  PDF.js `3.11.174`、pdf-lib `1.17.1`、marked `12.0.2`、DOMPurify `3.1.6`、Firebase `10.14.1`、YouTube IFrame API（全部在 `assets/js/core/cdn.js` 統一管理，用到才載入）。字體只從 Google Fonts 載入（寫在 `index.html`）。
- 載入外部函式庫一律經過 `cdn.js`：一般 script 用 `loadScript()`，單檔 ES module 用 `importCdn()`，兩者失敗都會自動重試一次。不要在別的檔案直接寫 CDN 網址或 `import('https://…')`（Firebase 例外，原因寫在 `cdn.js` 的 `importCdn` 註解）。
- 頁面模組格式：`export default async function (ctx) { … }`，用 `ctx.root.innerHTML` 渲染、`ctx.onCleanup(fn)` 登記離開時要清掉的東西（計時器、播放器、監聽器）。
- **任何插入 HTML 的文字都要經過 `esc()`**；Markdown 一律經 `renderMarkdown()`（內含 DOMPurify）。
- 共用的資料規則（欄位、可用值）寫在 `assets/js/core/schema.js`；驗證寫在 `core/validate.js`，網站發布前與 `npm run check` 共用同一份。
- 註解用中文，寫「為什麼」，不寫「做了什麼」。

---

## 5. 常見工作 SOP（照步驟做）

### 5.1 新增一首歌
1. `npm run new -- song <id>`，會印出一筆樣板；貼進 `content/songs.json` 的 `songs` 陣列。
2. 封面放 `media/covers/<id>.jpg`（720×720），樂譜放 `media/tabs/<id>.pdf`。
3. 讀樂譜決定 `tuning`、`capo`、`bpm`、`chords`、`techniques`；寫 2–4 條 `highlights`。
4. 若同一首歌已有別的編曲，給兩筆相同的 `group` 並各寫 `version`。
5. 考慮加進合適的歌單（`playlists.json`）與學習路徑關卡（`path.json`）。
6. 跑第 7 節的驗收。

### 5.2 新增技巧頁
1. `npm run new -- technique <slug> "<中文名稱>"` 產生 `content/techniques/<slug>.md`。
2. 依 3.4 寫滿四段；`related` 至少放一個相關技巧。
3. 到 `songs.json` 把確實用到這個技巧的歌加上這個 slug。
4. `npm run index` 更新目錄，再做第 7 節的驗收。

### 5.3 新增文章
1. `npm run new -- article <slug> "<標題>"`。
2. 選一個合法 `category`，`summary` 60 字內，內文至少兩個 `##` 段落。
3. 用交叉連結把提到的技巧、歌曲、和弦連起來。
4. `npm run index`，再做第 7 節的驗收。

### 5.4 新增一個頁面（新路由）
1. 複製 `templates/page.js` 到 `assets/js/pages/<name>.js`。
2. 在 `assets/js/core/router.js` 的 `ROUTES` 加一行；需要出現在選單就加到 `NAV`。
3. 樣式加在 `assets/css/pages.css` 的新段落 `/* == <name> == */`，只用 tokens 變數。
4. 在 `tests/` 加一個至少會打開這頁並檢查標題的測試，並把新網址加進 `tests/mobile.spec.js` 的「沒有水平捲動」清單。

### 5.5 調整歌單、學習路徑
直接改 `playlists.json`／`path.json`；引用的 id 必須存在（check 會擋）。

---

## 6. 不能做的事（地雷）

1. **不要修改 `content/site.json` 的 `admin`**，也不要把密碼、GitHub token 寫進任何檔案或 commit 訊息。
2. **不要手改 `content/index.json`**，它由 `npm run index` 產生。
3. **不要改既有歌曲的 `id`、既有文章／技巧的 `slug`**——學員進度與外部連結都靠它們。真的要改，先問站長。
4. **不要刪除或改名 `media/` 裡的既有檔案**；不要上傳超過 50MB 的檔案（影片請用 YouTube）。
5. **不要替站長編造個人資料**（經歷、器材、照片、社群帳號）；`site.json` 的品牌欄位只能由站長填。
6. 不要放寬 `firestore.rules`：學員只能讀寫 `users/<自己的 uid>` 底下的資料。
7. 不要引入框架、打包工具或沒列在 4.4 的 CDN 函式庫；要加新的先問站長。
8. 不要 `git push --force`、不要改寫 git 歷史；不要直接推到 GitHub，除非站長說可以。
9. 樂譜由站長決定公開範圍：保持 `songs.json` 裡 `pdf` 的設定，不要自行裁切或替換站長上傳的檔案。
10. **不要刪除根目錄的 `.nojekyll`**：少了它，GitHub Pages 會用 Jekyll 把所有 `.md` 轉成 `.html`，技巧與文章頁全部讀不到（`npm run check` 會擋）。

---

## 7. 開工前與做完要（驗收清單）

**開工前先 `git pull`。** 站長在網站上按「發布到網站」會直接 commit 到 GitHub 的 `main`；不先拉下來，你的修改會和站長剛發布的內容衝突。

每次新增或修改後，全部做完才算完成：

1. `npm run index` — 重新產生目錄（有改 Markdown 時）。
2. `npm run check` — 必須 **0 個錯誤**（警告要看過並說明）。
3. `npm test` — Playwright 測試全部通過；新頁面要有新測試。
4. `npm run dev` 打開 <http://localhost:8790>，實際點開改到的頁面；用 375px 寬再看一次。
5. 更新 `NOTES.md`：今天做了什麼、遇到什麼問題、下次從哪開始。
6. 若這次被站長糾正，把新規則寫進本手冊並在〈手冊更新紀錄〉加一行。
7. commit 訊息用中文，第一行 50 字內：`新增：…`、`修正：…`、`內容：…`、`手冊：…`。
8. 推上 GitHub 之後（要站長同意才推），Actions 的「內容檢查」必須是綠的；等「pages build and deployment」也跑完，再跑 `npm run live-check`，線上版必須 **0 個問題**。GitHub Pages 的網址分大小寫，Windows 本機不分，檔名大小寫寫錯只有線上驗收抓得到。

### 7.1 測試怎麼寫

- 期望值從內容檔讀（例如 `readJSON('content/songs.json')`），不要把「25 首」這種數字寫死，新增內容才不用改測試。
- 測試失敗時先修程式或內容；只有站長要求的行為本來就改了，才改測試的期望值。
- 不碰真的外部服務：YouTube、管理密碼、GitHub API 用 `tests/helpers.js` 的假物件；學員功能走示範模式；調音器用假麥克風（測試開始時自動產生 110Hz 音檔到 `tests/fixtures/`）。
- 本機網址用 `localhost`，不要用 `127.0.0.1`（YouTube 嵌入會拒絕播放）。
- 測試會連到真的 CDN（PDF.js、marked…），所以設定了失敗自動重跑一次；報告裡標成 flaky 的多半是網路，**同一個測試重跑還是失敗才是真的壞了**。

---

## 8. 常用指令

```bash
npm install            # 第一次：安裝 Playwright（只有測試需要）
npm run dev            # 本機預覽 http://localhost:8790
npm run new -- song <id>                     # 印出歌曲樣板
npm run new -- technique <slug> "<名稱>"      # 建立技巧頁
npm run new -- article <slug> "<標題>"        # 建立文章
npm run index          # 由 Markdown 產生 content/index.json
npm run check          # 檢查所有內容與連結
npm test               # Playwright 自動化測試
npm run verify         # index → check → test 一次跑完
npm run live-check     # 驗收線上版（推上去、Pages 部署完成後）
```

---

## 9. 手冊更新紀錄

| 日期 | 版本 | 改了什麼 | 為什麼 |
|---|---|---|---|
| 2026-11-11 | v1 | 第一版：由 AI 訪談站長 4 輪後起草 | 讓 AI 照同一套方式新增歌曲、技巧、文章與頁面 |
| 2026-11-11 | v2 | 依完成的網站校正：資料夾地圖、和弦圖只畫在標準／降半音／降全音、刪掉沒用到的歌曲 `featured`、示範模式、色碼自動檢查、外部函式庫一律經 `cdn.js` 載入並自動重試、開工前 `git pull`、GitHub Actions、7.1 測試寫法 | 手冊要和程式一致，AI 才不會照著錯的說明做事 |
| 2026-11-11 | v2.1 | 加入 `.nojekyll` 與第 6 節第 10 條 | 第一次部署前發現 GitHub Pages 預設的 Jekyll 會吃掉 `.md` 檔 |
| 2026-11-11 | v2.2 | 加入 `npm run live-check`，驗收清單第 8 條要求推上去後驗收線上版 | 本機檢查抓不到線上才有的問題（網址大小寫、Pages 設定）；第一次上線就是用它驗收的 |
