// 練琴工具：和弦字典、節拍器、調音器（假的麥克風播放 110Hz = A2）
import { test, expect } from '@playwright/test';
import { quiet, readJSON } from './helpers.js';

const table = readJSON('content/chords.json').chords;

test.beforeEach(async ({ page }) => { await quiet(page); });

test('和弦字典：預設列出開放和弦，可以搜尋、選根音與種類', async ({ page }) => {
  await page.goto('/#/chords');
  await expect(page.locator('.chord-card')).toHaveCount(Object.keys(table).length);
  await page.locator('[data-q]').fill('F#m7');
  await expect(page.locator('.chord-card')).toHaveCount(1);
  await expect(page.locator('.chord-card .chord-name')).toHaveText('F#m7');
  await expect(page.locator('.chord-card [data-shape]')).toHaveCount(2);
  await page.locator('.chord-card [data-shape="1"]').click();
  await expect(page.locator('.chord-card [data-shape="1"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-q]').fill('');
  await page.locator('[data-root="G"]').click();
  await page.locator('[data-quality="7"]').click();
  await expect(page.locator('.chord-card .chord-name')).toHaveText('G7');
});

test('從歌曲頁的和弦連結進來會直接查那個和弦', async ({ page }) => {
  await page.goto('/#/chords?q=D%2FF%23');
  await expect(page.locator('.chord-card .chord-name')).toHaveText('D/F#');
  await page.goto('/#/chords');
  await expect(page.locator('[data-q]')).toHaveValue('');
});

test('節拍器可以調速、開始與停止', async ({ page }) => {
  await page.goto('/#/metronome?bpm=90');
  await expect(page.locator('[data-bpm]')).toHaveText('90');
  await page.locator('[data-step="5"]').click();
  await expect(page.locator('[data-bpm]')).toHaveText('95');
  await page.locator('[data-sig]').selectOption('3');
  await expect(page.locator('[data-beats] i')).toHaveCount(3);
  await page.locator('[data-play]').click();
  await expect(page.locator('[data-beats] i.on')).toHaveCount(1);
  await page.locator('[data-play]').click();
  await expect(page.locator('[data-play]')).toContainText('開始');
});

test('調音器聽到 110Hz 會判斷成 5 弦 A，而且已經調準', async ({ page }) => {
  await page.goto('/#/tuner');
  await page.locator('[data-mic]').click();
  await expect(page.locator('[data-note]')).toContainText('A', { timeout: 15_000 });
  await expect(page.locator('[data-status]')).toContainText('5 弦 A 準了');
  await expect(page.locator('[data-freq]')).toHaveText(/^1(09|10|11)\.\d Hz$/);
});

test('調音器可以切換成歌曲的特殊調弦', async ({ page }) => {
  const songs = readJSON('content/songs.json').songs;
  const s = songs.find(x => x.tuning === 'custom');
  await page.goto(`/#/tuner?song=${s.id}`);
  const names = s.tuningNotes.map(n => n.replace(/-?\d+$/, ''));
  await expect(page.locator('[data-strings] b')).toHaveText(names);
});
