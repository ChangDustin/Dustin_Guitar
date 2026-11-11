// 驗收線上版：npm run live-check（GitHub Pages 部署完成後跑；別的網址：npm run live-check -- <網址>）
// 1. git 追蹤的網站檔案在線上都拿得到（GitHub Pages 的網址分大小寫，Windows 本機分不出來）
// 2. 逐頁打開：JS 錯誤、失敗的請求、錯誤頁、樂譜 PDF 有畫出來
// 3. 手機版不能水平捲動；截圖存到 test-results/live-check/
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const BASE = (process.argv[2] || 'https://changdustin.github.io/Dustin_Guitar/').replace(/\/?$/, '/');
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SHOTS = ROOT + 'test-results/live-check/';
mkdirSync(SHOTS, { recursive: true });
const J = p => JSON.parse(readFileSync(ROOT + p, 'utf8'));
const songs = J('content/songs.json').songs;
const idx = J('content/index.json');
const lists = J('content/playlists.json').playlists;
let total = 0;

// 1. 檔案
const files = execSync('git -c core.quotepath=off ls-files', { cwd: ROOT }).toString().trim().split('\n')
  .filter(f => /^(index\.html|assets\/|content\/|media\/)/.test(f));
const missing = [];
for (let i = 0; i < files.length; i += 8) {
  await Promise.all(files.slice(i, i + 8).map(async f => {
    const r = await fetch(BASE + f.split('/').map(encodeURIComponent).join('/'), { method: 'HEAD' });
    if (r.status !== 200) missing.push(`${r.status} ${f}`);
  }));
}
total += missing.length;
console.log(`檔案：${files.length - missing.length}/${files.length} 線上拿得到`);
missing.forEach(m => console.log('  ✖', m));

// 2. 逐頁
const browser = await chromium.launch({ channel: 'chrome' });
async function crawl(label, opts, routes, extra) {
  const ctx = await browser.newContext({ locale: 'zh-TW', ...opts });
  const page = await ctx.newPage();
  const problems = [];
  let where = '';
  page.on('pageerror', e => problems.push(`${where} JS 錯誤：${e.message}`));
  page.on('console', m => { if (m.type() === 'error') problems.push(`${where} console：${m.text().slice(0, 200)}`); });
  page.on('response', r => { if (r.status() >= 400) problems.push(`${where} HTTP ${r.status()}：${r.url()}`); });
  // 換頁時網站會取消還沒下載完的樂譜（net::ERR_ABORTED），那不是錯誤
  page.on('requestfailed', r => { const e = (r.failure() || {}).errorText || ''; if (!e.includes('ERR_ABORTED')) problems.push(`${where} 請求失敗：${r.url().slice(0, 120)} ${e}`); });
  for (const route of routes) {
    where = route;
    await page.goto(BASE + route);
    const h1 = page.locator('#app h1').first();
    try { await h1.waitFor({ timeout: 20_000 }); } catch { problems.push(`${route} 20 秒內沒有出現標題`); continue; }
    await page.waitForTimeout(600);
    const text = (await h1.textContent()) || '';
    if (/出錯|載入失敗|網路不穩|不存在/.test(text)) problems.push(`${route} 顯示錯誤頁：${text}`);
    if (extra) await extra(page, route, problems);
  }
  await ctx.close();
  total += problems.length;
  console.log(`${label}：${routes.length} 頁，${problems.length ? problems.length + ' 個問題' : '沒有問題'}`);
  problems.forEach(p => console.log('  ✖', p));
}

const main = ['#/', '#/songs', '#/techniques', '#/articles', '#/path', '#/chords', '#/tuner', '#/metronome', '#/me', '#/about'];
const all = [...main,
  ...songs.map(s => `#/songs/${s.id}`),
  ...idx.techniques.map(t => `#/techniques/${t.slug}`),
  ...idx.articles.map(a => `#/articles/${a.slug}`),
  ...lists.map(p => `#/playlists/${p.id}`)];

await crawl('桌機', { viewport: { width: 1280, height: 860 } }, all, async (page, route, problems) => {
  const s = songs.find(x => route === `#/songs/${x.id}`);
  if (s && s.pdf) {
    // 只看第一頁：後面的頁要捲到才會畫
    try { await page.waitForFunction(() => { const p = document.querySelector('.page'); return p && !p.classList.contains('loading'); }, null, { timeout: 30_000 }); }
    catch { problems.push(`${route} 樂譜第一頁 30 秒內沒畫出來`); }
  }
  if (route === '#/') await page.screenshot({ path: SHOTS + '1-home.png' });
  if (route === '#/songs') await page.screenshot({ path: SHOTS + '2-songs.png' });
  if (route === `#/songs/${songs[0].id}`) { await page.waitForTimeout(1500); await page.screenshot({ path: SHOTS + '3-song.png' }); }
  if (route === '#/techniques/hammer-on') await page.screenshot({ path: SHOTS + '4-technique.png' });
});

await crawl('手機', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, [...main, `#/songs/${songs[0].id}`], async (page, route, problems) => {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (over > 0) problems.push(`${route} 水平捲動 ${over}px`);
  if (route === '#/') await page.screenshot({ path: SHOTS + '5-mobile-home.png' });
});

await browser.close();
console.log(total ? `線上版共 ${total} 個問題` : `線上版沒有問題（截圖在 test-results/live-check/）`);
if (total) process.exitCode = 1;
