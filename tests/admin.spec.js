// 站長管理模式：密碼登入、編輯歌曲與品牌資料、發布前檢查、發布到（假的）GitHub
import { test, expect } from '@playwright/test';
import { quiet, fakeAdminPassword, fakeGitHub, TEST_PASSWORD, readJSON } from './helpers.js';

const songs = readJSON('content/songs.json').songs;

async function login(page) {
  await page.goto('/#/');
  await page.locator('#footer').getByRole('button', { name: '站長管理' }).click();
  await page.getByLabel('管理密碼').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: '進入管理模式' }).click();
  await expect(page.locator('[data-admin]')).toBeVisible();
}

test.beforeEach(async ({ page }) => { await quiet(page); await fakeAdminPassword(page); });

test('密碼錯誤進不去，密碼正確才出現管理按鈕', async ({ page }) => {
  await page.goto('/#/');
  await expect(page.locator('[data-admin]')).toHaveCount(0);
  await page.locator('#footer').getByRole('button', { name: '站長管理' }).click();
  await page.getByLabel('管理密碼').fill('wrong-password');
  await page.getByRole('button', { name: '進入管理模式' }).click();
  await expect(page.locator('.form-error')).toHaveText('密碼不正確。');
  await page.getByLabel('管理密碼').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: '進入管理模式' }).click();
  await expect(page.locator('[data-admin]')).toBeVisible();
  await expect(page.locator('.todo-card').first()).toBeVisible();
});

test('編輯歌曲 → 草稿 → 發布成一個 commit', async ({ page }) => {
  const calls = await fakeGitHub(page);
  await page.addInitScript(() => localStorage.setItem('dg-gh-token', JSON.stringify('fake-token-for-tests')));
  await login(page);
  const s = songs.find(x => x.status !== '已學會') || songs[0];
  await page.goto(`/#/songs/${s.id}`);
  await page.getByRole('button', { name: '編輯這首歌' }).click();
  await page.getByLabel('小齊的進度').selectOption('已學會');
  await page.getByRole('button', { name: '存成草稿' }).click();
  await expect(page.locator('#pubbar')).toContainText('1 項變更');
  await expect(page.locator('.sh-badges .status')).toHaveText('已學會');

  await page.locator('#pubbar').getByRole('button', { name: '發布到網站' }).click();
  await expect(page.getByRole('dialog')).toContainText('發布成功', { timeout: 30_000 });
  const tree = calls.find(c => c.method === 'POST' && c.path.endsWith('/git/trees')).body.tree;
  const paths = tree.map(t => t.path);
  expect(paths).toContain('content/songs.json');
  expect(paths).toContain('content/site.json');
  expect(paths).not.toContain('content/chords.json');
  const written = JSON.parse(tree.find(t => t.path === 'content/songs.json').content);
  expect(written.songs.find(x => x.id === s.id).status).toBe('已學會');
  const commit = calls.find(c => c.method === 'POST' && c.path.endsWith('/git/commits'));
  expect(commit.body.message).toContain(s.title);
  expect(calls.some(c => c.method === 'PATCH' && c.path.endsWith('/git/refs/heads/main'))).toBe(true);
});

test('格式錯誤的內容會在發布前被擋下來', async ({ page }) => {
  const calls = await fakeGitHub(page);
  await page.addInitScript(() => localStorage.setItem('dg-gh-token', JSON.stringify('fake-token-for-tests')));
  await login(page);
  // 學習路徑引用一首不存在的歌（模擬手動改壞的資料）
  await page.evaluate(async () => {
    const store = await import('/assets/js/core/store.js');
    const d = store.ensureDraft();
    d.data.path.stages[0].songs.push('no-such-song');
    await store.saveDraft('測試：引用不存在的歌');
  });
  await page.locator('#pubbar').getByRole('button', { name: '發布到網站' }).click();
  await expect(page.getByRole('dialog')).toContainText('這次沒有發布');
  await expect(page.getByRole('dialog')).toContainText('no-such-song');
  expect(calls.some(c => c.method === 'POST' && c.path.endsWith('/git/commits'))).toBe(false);
});

test('品牌資料：填寫歷程後首頁出現時間軸', async ({ page }) => {
  await login(page);
  await page.locator('[data-edit-brand="timeline"]').first().click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('#pf-name').fill('小齊');
  await dialog.locator('[data-timeline]').getByRole('button', { name: '新增一個節點' }).click();
  await dialog.locator('[data-timeline] [data-k="date"]').fill('2024-09');
  await dialog.locator('[data-timeline] [data-k="title"]').fill('開始上 Yamaha 吉他課');
  await dialog.getByRole('button', { name: '存成草稿' }).click();
  await expect(page.locator('.timeline li')).toHaveCount(1);
  await expect(page.locator('.timeline')).toContainText('開始上 Yamaha 吉他課');
});
