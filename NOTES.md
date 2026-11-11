# NOTES.md — 工作日誌

> 給接手的 AI：先讀 `CLAUDE.md`，再從〈下次從這裡開始〉接著做。
> 收工時在〈紀錄〉最上面加一筆（做了什麼、遇到什麼問題、怎麼解決），並更新待辦。

## 下次從這裡開始

- [x] 建立 `Dustin_Guitar` repo 並推上去（2026-11-11）。
- [ ] 站長：開 Pages（Settings → Pages → `main`／`/ (root)`），然後驗收線上版。
- [ ] 站長：Firebase 主控台 → Firestore → 規則，把 `firestore.rules` 整份貼上並發布；再到管理模式「設定」貼上 Firebase 網頁設定。
- [ ] 站長：建立只限 `Dustin_Guitar` 的 fine-grained token（Contents：Read and write），在管理模式「設定」填入。
- [ ] 站長：在管理模式填品牌資料（照片、自我介紹、學琴歷程、器材、社群）。**AI 不要代填。**
- [ ] 可以接著做：新增技巧頁（例如顫音 `vibrato`、推弦 `bend`、點弦 `tapping`）；「練習心得」「器材」兩個分類還沒有文章。

## 已知限制

- Firebase 設定填好之前，學員帳號是「示範模式」：資料只存在那台電腦的瀏覽器。
- 特殊調弦（Drop D、DADGAD、Open、`custom`）的歌只列和弦名稱，不畫指型圖。
- 和弦字典的封閉和弦是程式依 E 型、A 型推出來的；`chords.json` 沒收錄、程式也推不出來的和弦會顯示「尚未收錄」（`npm run check` 會警告）。

## 紀錄

### 2026-11-11　v1 完成

做了什麼：

- 由舊站「小齊的吉他寶庫」升級：曲庫 2.0（難度五格、簡單版／進階版合併、精選歌單、每首歌的技巧重點）、技巧小百科、文章（自動目錄）、學習路徑、調音器、和弦字典、節拍器、影片慢速與 A-B 循環。
- 學員帳號（Firebase＋示範模式）：歌曲進度、筆記、收藏、練習日誌與熱度圖。
- 站長管理模式：歌曲、品牌資料、歌單、學習路徑、技巧、文章的編輯器，發布前跑與 `npm run check` 相同的檢查，再用 GitHub API 一次 commit。
- `npm run check`、`npm run new`、Playwright 測試（桌機＋手機）、GitHub Actions 內容檢查。

遇到的問題與解法（下次別再踩）：

- GitHub Pages「從分支部署」預設會跑 Jekyll，把所有 `.md` 轉成 `.html`，網站就讀不到技巧與文章。根目錄放了空的 `.nojekyll` 關掉它，`npm run check` 會檢查它還在。
- 本機預覽用 `http://localhost:8790`，不要用 `127.0.0.1`：YouTube 嵌入在 `127.0.0.1` 會顯示錯誤。
- `.chip` 之類有設 `display` 的元件會蓋掉 HTML 的 `hidden`，所以 `base.css` 有全域 `[hidden] { display: none !important }`，不要刪。
- 正規表示式裡的中文範圍用 `\p{Script=Han}`、組合字元用 `\p{M}`（要加 `u` 旗標），不要寫跳脫碼範圍：有些 AI 編輯工具會把跳脫碼直接變成字元，程式就壞了。
- 檢查和弦有沒有指型要用 `chordShapes()`（同時看 `chords.json` 與程式推出的指型），不能只看和弦種類；之前因此對 `C#m9`、`E9` 誤報警告。
- CDN 偶爾下載失敗（測試時遇過 marked 載不到，整頁變成錯誤頁）：現在 `cdn.js` 的 `loadScript()`、`importCdn()` 會自動重試一次，錯誤頁也有「重新整理」按鈕；`tests/content.spec.js` 有模擬斷線的測試。
- 管理模式發布只寫入有變動的檔案；沒被引用的封面、樂譜、影片、照片會一起刪掉，但 `media/notes/` 永遠不會自動刪除。
