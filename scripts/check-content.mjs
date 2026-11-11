// npm run check：檢查 content/ 裡所有內容是否符合 CLAUDE.md 的格式，以及互相連結是否都找得到。
// 有錯誤時以 exit code 1 結束（GitHub Actions 也會跑這支）。
import { readFile, readdir } from 'node:fs/promises';
import { validateContent } from '../assets/js/core/validate.js';
import { buildIndex, indexText } from '../assets/js/core/content-index.js';
import { abs, exists, loadAll } from './lib.mjs';

const all = await loadAll();
const { errors, warnings } = validateContent({ ...all, fileExists: exists });

// 目錄要跟 Markdown 同步
const expected = indexText(buildIndex(all.docs));
const actual = await readFile(abs('content/index.json'), 'utf8').catch(() => '');
if (expected !== actual) errors.push('content/index.json：和 Markdown 不同步，請執行 npm run index');

// CLAUDE.md 4.3：色碼只能寫在 tokens.css
for (const f of (await readdir(abs('assets/css'))).filter(f => f.endsWith('.css') && f !== 'tokens.css')) {
  const lines = (await readFile(abs(`assets/css/${f}`), 'utf8')).split('\n');
  lines.forEach((line, i) => {
    if (/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(line.replace(/\/\*.*?\*\//g, ''))) {
      errors.push(`assets/css/${f} 第 ${i + 1} 行：色碼只能寫在 tokens.css，請改用 var(--…)`);
    }
  });
}

// 手冊本身也要在
if (!exists('CLAUDE.md')) errors.push('CLAUDE.md：找不到專案手冊');
if (!exists('AGENTS.md')) warnings.push('AGENTS.md：找不到（其他 AI 工具會讀不到規則）');
if (!exists('.nojekyll')) errors.push('.nojekyll：找不到（GitHub Pages 會把 Markdown 轉成 HTML，技巧與文章頁就讀不到 .md）');

const songs = all.songs.songs.length;
const docs = all.docs.length;
console.log(`檢查範圍：歌曲 ${songs} 首、歌單 ${all.playlists.playlists.length} 個、學習路徑 ${all.path.stages.length} 關、技巧與文章 ${docs} 篇、和弦 ${Object.keys(all.chords.chords).length} 個`);
if (warnings.length) {
  console.log(`\n⚠ 警告 ${warnings.length} 個：`);
  warnings.forEach(w => console.log('  - ' + w));
}
if (errors.length) {
  console.log(`\n✖ 錯誤 ${errors.length} 個：`);
  errors.forEach(e => console.log('  - ' + e));
  process.exit(1);
}
console.log('\n✔ 全部通過');
