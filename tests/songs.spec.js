// 曲庫：版本合併、難度與調弦篩選、搜尋、列表檢視、隨機挑歌
import { test, expect } from '@playwright/test';
import { quiet, readJSON } from './helpers.js';

const songs = readJSON('content/songs.json').songs;
const groups = new Set(songs.map(s => s.group || s.id)).size;
const cardsFor = list => new Set(list.map(s => s.group || s.id)).size;

test.beforeEach(async ({ page }) => { await quiet(page); await page.goto('/#/songs'); });

test('同一首歌的不同版本合併成一張卡', async ({ page }) => {
  await expect(page.locator('.song-card')).toHaveCount(groups);
  const grouped = songs.filter(s => s.group);
  if (grouped.length) {
    const first = grouped[0];
    const card = page.locator('.song-card', { has: page.locator('.sc-versions') }).first();
    await expect(card.locator('.sc-versions a')).toHaveCount(songs.filter(s => s.group === first.group).length);
  }
});

test('難度篩選只留下該難度的歌', async ({ page }) => {
  const level = 4;
  await page.locator(`[data-level="${level}"]`).click();
  await expect(page.locator('.song-card')).toHaveCount(cardsFor(songs.filter(s => s.difficulty === level)));
  await expect(page.locator('.song-card .sc-meta .dots').first().locator('i.on')).toHaveCount(level);
});

test('調弦篩選：特殊調弦', async ({ page }) => {
  await page.locator('[data-tuning]').selectOption('alt');
  await expect(page.locator('.song-card')).toHaveCount(cardsFor(songs.filter(s => s.tuning !== 'standard')));
});

test('搜尋歌名與標籤，找不到時可以清除篩選', async ({ page }) => {
  await page.locator('[data-q]').fill('董運昌');
  await expect(page.locator('.song-card')).toHaveCount(cardsFor(songs.filter(s => [s.arranger, ...s.tags].join(' ').includes('董運昌'))));
  await page.locator('[data-q]').fill('完全不存在的歌名xyz');
  await expect(page.locator('.empty')).toBeVisible();
  await page.getByRole('button', { name: '清除所有篩選' }).click();
  await expect(page.locator('.song-card')).toHaveCount(groups);
});

test('切換成列表檢視', async ({ page }) => {
  await page.locator('[data-view="list"]').click();
  await expect(page.locator('.song-row')).toHaveCount(groups);
  await page.locator('[data-view="grid"]').click();
});

test('隨機挑一首會打開某首歌', async ({ page }) => {
  await page.getByRole('button', { name: '隨機挑一首' }).click();
  await expect(page).toHaveURL(/#\/songs\/[a-z0-9-]+$/);
  await expect(page.locator('.song-head h1')).toBeVisible();
});
