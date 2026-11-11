# 小齊吉他 Dustin Guitar

小齊（張紘齊）的個人指彈吉他網站：把練過的每一首指彈，整理成看得懂、學得會的樣子。

- 網站：<https://changdustin.github.io/Dustin_Guitar/>
- 原始碼：<https://github.com/ChangDustin/Dustin_Guitar>

## 網站有什麼

| 區塊 | 內容 |
|---|---|
| 曲庫 | 難度五格、同一首歌的不同版本合併成一張卡、精選歌單、PDF 樂譜、YouTube 慢速播放與 A-B 循環、每首歌的技巧重點 |
| 技巧小百科 | 每個技巧固定四段：是什麼、怎麼練、常見錯誤、在譜上長這樣；自動列出用到這個技巧的歌 |
| 文章 | 自動目錄、分類篩選、延伸閱讀 |
| 學習路徑 | 由淺到深的關卡，每關搭配技巧、歌曲與文章 |
| 練琴工具 | 調音器（用麥克風）、和弦字典、節拍器 |
| 學員帳號 | 自己的歌曲進度、筆記、收藏、練習日誌與熱度圖（Firebase，只有本人看得到） |
| 管理模式 | 站長用密碼登入，直接在網站上編輯內容，按「發布到網站」commit 回這個 repo |

## 給 AI 的規則

- [CLAUDE.md](CLAUDE.md)：專案手冊。內容格式、命名、檔案放哪裡、常見工作的步驟、不能做的事、驗收清單。
- [AGENTS.md](AGENTS.md)：給其他 AI 工具的入口，指向 CLAUDE.md。
- [NOTES.md](NOTES.md)：工作日誌，記錄做到哪、下次從哪開始。

## 本機開發

純靜態網站（HTML、CSS、原生 JavaScript ES modules），不需要建置。

```bash
npm install      # 只有跑測試需要（Playwright）
npm run dev      # 本機預覽 http://localhost:8790
npm run verify   # 重建目錄 → 檢查內容 → 跑全部測試
npm run live-check   # 驗收線上版（GitHub Pages 部署完成後）
```
