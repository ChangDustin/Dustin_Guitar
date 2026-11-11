// 學員帳號（示範模式）：註冊、標記進度、收藏、筆記、記錄練習、熱度圖、登出再登入
import { test, expect } from '@playwright/test';
import { quiet, readJSON } from './helpers.js';

const songs = readJSON('content/songs.json').songs;
const target = songs.find(s => s.id === 'summer') || songs[0];

test.beforeEach(async ({ page }) => { await quiet(page); });

test('學員的完整流程', async ({ page }) => {
  const email = `student${Date.now()}@example.com`;
  await page.goto('/#/me');
  await expect(page.locator('#app h1')).toHaveText('我的練習');
  await page.locator('#app').getByRole('button', { name: '建立帳號' }).click();
  await expect(page.getByRole('dialog')).toContainText('示範模式');
  await page.getByLabel('暱稱').fill('測試學員');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel(/^密碼/).fill('abc12345');
  await page.getByRole('dialog').getByRole('button', { name: '建立帳號' }).click();
  await expect(page.locator('#app h1')).toHaveText('測試學員 的練習');

  // 歌曲頁：標記進度、收藏、寫筆記
  await page.goto(`/#/songs/${target.id}`);
  const mine = page.locator('[data-mine]');
  await mine.getByRole('button', { name: '練習中' }).click();
  await expect(mine.getByRole('button', { name: '練習中' })).toHaveAttribute('aria-pressed', 'true');
  await mine.getByRole('button', { name: '收藏這首歌' }).click();
  await expect(mine.locator('[data-fav]')).toHaveAttribute('aria-pressed', 'true');
  await mine.getByLabel(/我的筆記/).fill('前奏的悶音要再輕一點');
  await expect(mine.locator('[data-saved]')).toHaveText('已儲存');

  // 記錄一次練習
  await mine.getByRole('button', { name: '記錄練習' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('[data-min="45"]').click();
  await expect(dialog.locator(`input[value="${target.id}"]`)).toBeChecked();
  await dialog.getByRole('button', { name: '記錄' }).click();
  await expect(page.locator('.toast').last()).toContainText('45 分鐘');
  await expect(mine).toContainText('共 45 分鐘');

  // 曲庫卡片會出現我的進度
  await page.goto('/#/songs');
  await page.locator('[data-mine]').selectOption('fav');
  await expect(page.locator('.song-card')).toHaveCount(1);
  await expect(page.locator('.song-card .mine')).toContainText('練習中');

  // 我的練習：統計、熱度圖、日誌、收藏
  await page.goto('/#/me');
  await expect(page.locator('.me-stats')).toContainText('45');
  await expect(page.locator('.me-stats')).toContainText('1');
  await expect(page.locator('.heatmap rect.h3')).toHaveCount(1);
  await expect(page.locator('.log-list li')).toHaveCount(1);
  await expect(page.locator('#h-fav ~ .song-grid .song-card, section[aria-labelledby="h-fav"] .song-card')).toHaveCount(1);

  // 登出再登入，資料還在
  await page.locator('[data-account]').click();
  await page.getByRole('menuitem', { name: '登出' }).click();
  await expect(page.locator('#app')).toContainText('登入後，這裡會整理');
  await page.locator('#app').getByRole('button', { name: '登入' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel(/^密碼/).fill('abc12345');
  await page.getByRole('dialog').getByRole('button', { name: '登入' }).click();
  await expect(page.locator('.log-list li')).toHaveCount(1);
});

test('密碼錯誤會顯示看得懂的錯誤訊息', async ({ page }) => {
  await page.goto('/#/');
  await page.getByRole('button', { name: '學員登入' }).click();
  await page.getByLabel('Email').fill('nobody@example.com');
  await page.getByLabel(/^密碼/).fill('wrongpass');
  await page.getByRole('dialog').getByRole('button', { name: '登入' }).click();
  await expect(page.locator('.form-error')).toHaveText('找不到這個帳號，請先建立帳號。');
});
