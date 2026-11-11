// 手機版（390px）：不能水平捲動、選單可以打開、歌曲頁順序是 影片 → 樂譜 → 其他
import { test, expect } from '@playwright/test';
import { quiet, fakeYouTube, readJSON } from './helpers.js';

const songs = readJSON('content/songs.json').songs;

test.beforeEach(async ({ page }) => { await quiet(page); await fakeYouTube(page); });

for (const hash of ['#/', '#/songs', `#/songs/${songs[0].id}`, '#/techniques/hammer-on', '#/articles/how-to-read-tab', '#/path', '#/chords', '#/tuner', '#/me', '#/about']) {
  test(`${hash} 沒有水平捲動`, async ({ page }) => {
    await page.goto('/' + hash);
    await expect(page.locator('#app h1').first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('漢堡選單可以打開並換頁', async ({ page }) => {
  await page.goto('/#/');
  await expect(page.locator('#nav')).toBeHidden();
  await page.getByRole('button', { name: '打開選單' }).click();
  await expect(page.locator('#nav')).toBeVisible();
  await page.locator('#nav').getByRole('link', { name: '曲庫' }).click();
  await expect(page.locator('#app h1')).toHaveText('曲庫');
  await expect(page.locator('#nav')).toBeHidden();
});

test('手機上的歌曲頁：影片在樂譜前面、樂譜在其他資訊前面', async ({ page }) => {
  await page.goto(`/#/songs/${songs[0].id}`);
  const y = async sel => (await page.locator(sel).boundingBox()).y;
  const video = await y('.song-video'), sheet = await y('.song-sheet'), rest = await y('.song-rest');
  expect(video).toBeLessThan(sheet);
  expect(sheet).toBeLessThan(rest);
});
