// 歌曲頁：樂譜、影片練習控制列（慢速、A-B 循環）、技巧重點連結、調弦、和弦圖、版本切換
import { test, expect } from '@playwright/test';
import { quiet, fakeYouTube, readJSON } from './helpers.js';

const songs = readJSON('content/songs.json').songs;
const withVideo = songs.find(s => s.videos.some(v => /youtu/.test(v.url)));
const altTuning = songs.find(s => s.tuning === 'cgdgad') || songs.find(s => s.tuning !== 'standard');
const withChords = songs.find(s => s.tuning === 'standard' && s.chords.length >= 3);
const grouped = songs.find(s => s.group);

test.beforeEach(async ({ page }) => { await quiet(page); await fakeYouTube(page); });

test('樂譜 PDF 會畫出第一頁並顯示頁數', async ({ page }) => {
  const s = songs.find(x => x.pdf);
  await page.goto(`/#/songs/${s.id}`);
  await expect(page.locator('.song-head h1')).toHaveText(s.title);
  await expect(page.locator('.page').first()).not.toHaveClass(/loading/, { timeout: 30_000 });
  await expect(page.locator('[data-pgi]')).toHaveText(new RegExp(`/ ${s.pdf.pages} 頁`));
  await page.locator('[data-zi]').click();
  await expect(page.locator('[data-zl]')).toHaveText('125%');
});

test('影片可以慢速播放，也可以 A-B 循環', async ({ page }) => {
  await page.goto(`/#/songs/${withVideo.id}`);
  await page.waitForFunction(() => window.__yt);
  await page.locator('[data-rate="0.75"]').click();
  expect(await page.evaluate(() => window.__yt.rate)).toBe(0.75);
  await page.evaluate(() => { window.__yt.t = 10; });
  await page.getByRole('button', { name: '設 A 點' }).click();
  await page.evaluate(() => { window.__yt.t = 20; });
  await page.getByRole('button', { name: '設 B 點' }).click();
  await expect(page.locator('[data-state]')).toContainText('0:10');
  await expect(page.locator('[data-state]')).toContainText('0:20');
  // 播超過 B 點會被拉回 A 點
  await page.evaluate(() => { window.__seeks.length = 0; window.__yt.t = 21; });
  await expect.poll(() => page.evaluate(() => window.__seeks)).toContain(10);
  await page.getByRole('button', { name: '清除' }).click();
  await expect(page.locator('[data-state]')).toContainText('挑一段重複練');
});

test('技巧重點的連結都找得到對應頁面', async ({ page }) => {
  await page.goto(`/#/songs/${altTuning.id}`);
  await expect(page.locator('.highlights a.wl').first()).toBeVisible();
  await expect(page.locator('.highlights a.wl.broken')).toHaveCount(0);
  await expect(page.locator('.tech-chip')).toHaveCount(altTuning.techniques.length);
});

test('特殊調弦會顯示改了哪幾條弦，並能帶到調音器', async ({ page }) => {
  await page.goto(`/#/songs/${altTuning.id}`);
  await expect(page.locator('.facts-panel')).toContainText('弦');
  await page.getByRole('link', { name: '用這個調弦開調音器' }).click();
  await expect(page).toHaveURL(new RegExp(`tuner\\?song=${altTuning.id}`));
  await expect(page.locator('[data-strings] button')).toHaveCount(6);
});

test('標準調弦的歌會畫出和弦圖', async ({ page }) => {
  await page.goto(`/#/songs/${withChords.id}`);
  await expect(page.locator('.chord-row .chord')).toHaveCount(withChords.chords.length);
  await expect(page.locator('.chord-row .chord-svg').first()).toBeVisible();
});

test('同一首歌可以在版本之間切換', async ({ page }) => {
  test.skip(!grouped, '目前沒有分版本的歌');
  const versions = songs.filter(s => s.group === grouped.group);
  await page.goto(`/#/songs/${versions[0].id}`);
  await expect(page.locator('.versions a')).toHaveCount(versions.length);
  await page.locator('.versions a').nth(1).click();
  await expect(page).toHaveURL(new RegExp(`#/songs/${versions[1].id}$`));
  await expect(page.locator('.versions a[aria-current="page"]')).toContainText(versions[1].version);
});
