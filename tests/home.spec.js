// 首頁：品牌主視覺、可彈的指板、各區塊的數量要和 content/ 一致
import { test, expect } from '@playwright/test';
import { quiet, readJSON } from './helpers.js';

const songs = readJSON('content/songs.json').songs;
const index = readJSON('content/index.json');
const playlists = readJSON('content/playlists.json').playlists;
const stages = readJSON('content/path.json').stages;

test.beforeEach(async ({ page }) => { await quiet(page); });

test('首頁顯示品牌主視覺與正確的統計', async ({ page }) => {
  await page.goto('/#/');
  await expect(page).toHaveTitle(/小齊吉他/);
  await expect(page.locator('#hero-title')).toContainText('小齊吉他');
  const facts = page.locator('.hero-facts');
  await expect(facts).toContainText(String(songs.length));
  await expect(facts).toContainText(String(songs.filter(s => s.status === '已學會').length));
  await expect(page.locator('.rosette')).toBeVisible();
  await expect(page.locator('[data-neck] .neck-str')).toHaveCount(6);
});

test('點指板的弦會開聲音並顯示音名', async ({ page }) => {
  await page.goto('/#/');
  const neck = page.locator('[data-neck]');
  const box = await neck.boundingBox();
  // A 弦（第 5 條）大約在 70% 高度，第 3 格附近
  await page.mouse.click(box.x + box.width * 0.27, box.y + box.height * 0.716);
  await expect(page.locator('[data-sound]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.neck-pop')).toHaveText(/^[A-G]#?\d$/);
});

test('精選歌單、學習路徑、技巧小百科都依內容檔顯示', async ({ page }) => {
  await page.goto('/#/');
  await expect(page.locator('.playlist-tile')).toHaveCount(playlists.filter(p => p.featured).length);
  await expect(page.locator('.path-strip li')).toHaveCount(stages.length);
  await expect(page.locator('.tech-grid .tech-tile')).toHaveCount(index.techniques.length);
  await expect(page.locator('.article-list li')).toHaveCount(Math.min(3, index.articles.length));
});

test('頁首選單可以到每個主要頁面', async ({ page }) => {
  await page.goto('/#/');
  for (const [label, h1] of [['曲庫', '曲庫'], ['技巧', '技巧小百科'], ['文章', '文章'], ['學習路徑', '學習路徑'], ['關於我', /關於我|我是/]]) {
    await page.locator('#nav').getByRole('link', { name: label, exact: true }).click();
    await expect(page.locator('#app h1').first()).toHaveText(h1);
  }
  await page.locator('#nav').getByRole('button', { name: '練琴工具' }).click();
  await page.locator('#nav').getByRole('link', { name: /和弦字典/ }).click();
  await expect(page.locator('#app h1')).toHaveText('和弦字典');
});
