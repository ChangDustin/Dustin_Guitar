// Playwright 設定：用電腦上已安裝的 Chrome（不另外下載瀏覽器）
// npm test 會自動開本機伺服器在 8791 埠（和 npm run dev 的 8790 分開）
import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const fakeAudio = fileURLToPath(new URL('./tests/fixtures/a2-110hz.wav', import.meta.url));

export default defineConfig({
  testDir: './tests',
  globalSetup: './tests/global-setup.js',
  timeout: 45_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  // 測試會連到 CDN（PDF.js、marked…）：網路偶發失敗時重跑一次，報告會標成 flaky
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:8791',
    channel: 'chrome',
    locale: 'zh-TW',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      // 調音器測試用：假的麥克風，播放 110Hz（A2）的正弦波
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${fakeAudio}`, '--autoplay-policy=no-user-gesture-required'],
    },
  },
  projects: [
    { name: 'desktop', testIgnore: /mobile\.spec/, use: { viewport: { width: 1280, height: 860 } } },
    { name: 'mobile', testMatch: /mobile\.spec/, use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: 'node scripts/serve.mjs 8791',
    url: 'http://localhost:8791',
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
  },
});
