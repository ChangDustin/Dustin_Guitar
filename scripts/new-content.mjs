// npm run new -- <類型> <slug> "<名稱>"
//   song <id>                    印出一筆歌曲樣板（自己貼進 content/songs.json）
//   playlist <id> "<名稱>"        印出一筆歌單樣板
//   technique <slug> "<名稱>"     建立 content/techniques/<slug>.md
//   article <slug> "<標題>"       建立 content/articles/<slug>.md
//   page <name>                  建立 assets/js/pages/<name>.js
import { readFile, writeFile } from 'node:fs/promises';
import { SLUG_RE } from '../assets/js/core/schema.js';
import { abs, exists } from './lib.mjs';

const [type, slug, ...rest] = process.argv.slice(2);
const name = rest.join(' ').trim();
const today = new Date().toISOString().slice(0, 10);
const now = new Date().toISOString();
const fail = msg => { console.error('✖ ' + msg); process.exit(1); };

if (!type || !slug) fail('用法：npm run new -- <song|playlist|technique|article|page> <slug> "<名稱>"');
if (!SLUG_RE.test(slug)) fail(`「${slug}」不是合法的 slug：只能用小寫英文、數字與連字號`);

const fill = (tpl, map) => Object.entries(map).reduce((t, [k, v]) => t.split(`{{${k}}}`).join(v), tpl);

if (type === 'song' || type === 'playlist') {
  const tpl = await readFile(abs(`templates/${type}.json`), 'utf8');
  console.log(fill(tpl, { id: slug, title: name || '歌名', now }));
  console.log(`\n↑ 把這一筆貼進 content/${type === 'song' ? 'songs' : 'playlists'}.json，填好後執行 npm run check`);
} else if (type === 'technique' || type === 'article') {
  const dir = type === 'technique' ? 'content/techniques' : 'content/articles';
  const out = `${dir}/${slug}.md`;
  if (exists(out)) fail(`${out} 已經存在`);
  const tpl = await readFile(abs(`templates/${type}.md`), 'utf8');
  await writeFile(abs(out), fill(tpl, { slug, title: name || slug, today }), 'utf8');
  console.log(`已建立 ${out}\n下一步：寫完內容 → npm run index → npm run check`);
} else if (type === 'page') {
  const out = `assets/js/pages/${slug}.js`;
  if (exists(out)) fail(`${out} 已經存在`);
  const tpl = await readFile(abs('templates/page.js'), 'utf8');
  await writeFile(abs(out), fill(tpl, { name: slug, title: name || slug }), 'utf8');
  console.log(`已建立 ${out}\n下一步：在 assets/js/core/router.js 的 ROUTES 加上 ['/${slug}', '${slug}']，並在 tests/ 加測試`);
} else {
  fail(`不認得的類型「${type}」`);
}
