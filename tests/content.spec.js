// 技巧頁、文章、學習路徑：結構要符合 CLAUDE.md，站內連結都要找得到對象
import { test, expect } from '@playwright/test';
import { quiet, readJSON } from './helpers.js';

const index = readJSON('content/index.json');
const songs = readJSON('content/songs.json').songs;
const stages = readJSON('content/path.json').stages;

test.beforeEach(async ({ page }) => { await quiet(page); });

test('每個技巧頁都是固定四段，練習曲由 songs.json 自動列出', async ({ page }) => {
  for (const t of index.techniques) {
    await page.goto(`/#/techniques/${t.slug}`);
    await expect(page.locator('.tech-head h1')).toHaveText(t.title);
    await expect(page.locator('.prose h2')).toHaveText(['是什麼', '怎麼練', '常見錯誤', '在譜上長這樣']);
    const using = songs.filter(s => s.techniques.includes(t.slug)).length;
    await expect(page.locator('.doc-side h2').first()).toHaveText(`練習曲（${using}）`);
    await expect(page.locator('a.wl.broken')).toHaveCount(0);
  }
});

test('文章有自動目錄，點目錄會捲到對應段落', async ({ page }) => {
  for (const a of index.articles) {
    await page.goto(`/#/articles/${a.slug}`);
    await expect(page.locator('.article-head h1')).toHaveText(a.title);
    const heads = await page.locator('.prose h2, .prose h3').count();
    await expect(page.locator('.toc li')).toHaveCount(heads);
    await expect(page.locator('a.wl.broken')).toHaveCount(0);
  }
  await page.goto(`/#/articles/${index.articles[0].slug}`);
  const last = page.locator('.toc a').last();
  const id = await last.getAttribute('data-toc');
  await last.click();
  await expect(page.locator(`#${id}`)).toBeInViewport();
});

test('文章可以依分類篩選', async ({ page }) => {
  await page.goto('/#/articles');
  await expect(page.locator('.article-card')).toHaveCount(index.articles.length);
  const cat = index.articles[0].category;
  await page.locator(`[data-cat="${cat}"]`).click();
  await expect(page.locator('.article-card')).toHaveCount(index.articles.filter(a => a.category === cat).length);
});

test('外部函式庫第一次下載失敗會自動重試', async ({ page }) => {
  let calls = 0;
  await page.route(/marked@/, route => (calls++ ? route.continue() : route.abort()));
  await page.goto(`/#/articles/${index.articles[0].slug}`);
  await expect(page.locator('.article-head h1')).toHaveText(index.articles[0].title);
  expect(calls).toBe(2);
});

test('網路一直不通時，錯誤頁會請人重新整理', async ({ page }) => {
  await page.route(/marked@/, route => route.abort());
  await page.goto(`/#/articles/${index.articles[0].slug}`);
  await expect(page.locator('#app h1')).toHaveText('網路不穩，這一頁沒有載入完成');
  await expect(page.getByRole('button', { name: '重新整理' })).toBeVisible();
});

test('學習路徑依序列出每一關，可以從網址直接跳到某一關', async ({ page }) => {
  await page.goto('/#/path');
  await expect(page.locator('.stage')).toHaveCount(stages.length);
  for (const [i, st] of stages.entries()) {
    const card = page.locator('.stage').nth(i);
    await expect(card.locator('h2')).toContainText(st.title);
    await expect(card.locator('.stage-songs .mini-songs li')).toHaveCount(st.songs.length);
  }
  const last = stages[stages.length - 1];
  await page.goto(`/#/path?stage=${last.id}`);
  await expect(page.locator(`#stage-${last.id}`)).toBeInViewport();
});
