// 測試共用：擋掉不需要的外部資源、假的 YouTube、假的管理密碼、假的 GitHub API
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const readJSON = p => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

// 字型不影響功能，擋掉讓測試快一點
export async function quiet(page) {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
}

// 假的 YouTube IFrame API：記錄跳轉與速度，讓 A-B 循環可以被驗證
export async function fakeYouTube(page) {
  await page.route('https://www.youtube.com/iframe_api', r => r.fulfill({
    contentType: 'text/javascript',
    body: `window.YT = { Player: class {
      constructor(el, opts) { this.t = (opts.playerVars && opts.playerVars.start) || 0; this.rate = 1; window.__yt = this; window.__seeks = []; setTimeout(() => opts.events.onReady({ target: this }), 10); }
      getCurrentTime() { return this.t; } seekTo(t) { this.t = t; window.__seeks.push(t); } setPlaybackRate(r) { this.rate = r; } destroy() {}
    } }; if (window.onYouTubeIframeAPIReady) window.onYouTubeIframeAPIReady();`,
  }));
}

// 假的管理密碼：把 site.json 的雜湊換成已知密碼（次數調低讓測試快）
export const TEST_PASSWORD = 'test-password-123';
export async function fakeAdminPassword(page) {
  const salt = randomBytes(16);
  const admin = { salt: salt.toString('base64'), hash: pbkdf2Sync(TEST_PASSWORD, salt, 1000, 32, 'sha256').toString('base64'), iter: 1000 };
  await page.route('**/content/site.json*', async route => {
    const res = await route.fetch();
    const json = await res.json();
    route.fulfill({ response: res, json: { ...json, admin } });
  });
}

// repo 裡目前所有檔案（給假的 GitHub tree 用）
export function repoFiles() {
  const out = [];
  const walk = dir => {
    for (const f of readdirSync(dir)) {
      if (['node_modules', '.git', 'test-results', 'playwright-report', '_local'].includes(f)) continue;
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p); else out.push(relative(ROOT, p).split('\\').join('/'));
    }
  };
  walk(ROOT);
  return out;
}

// 假的 GitHub Git Data API：回傳 calls 陣列，記錄每個請求
export async function fakeGitHub(page) {
  const calls = [];
  const files = repoFiles();
  let n = 0;
  await page.route('https://api.github.com/**', async route => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace('/repos/ChangDustin/Dustin_Guitar', '');
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    calls.push({ method: req.method(), path, body });
    const json = o => route.fulfill({ json: o });
    if (path.endsWith('/git/ref/heads/main')) return json({ object: { sha: 'c0' } });
    if (path.endsWith('/git/commits/c0')) return json({ tree: { sha: 't0' } });
    if (path.includes('/git/trees/t0')) return json({ tree: files.map(p => ({ path: p, type: 'blob' })) });
    if (path.endsWith('/git/blobs')) return json({ sha: 'blob' + ++n });
    if (path.endsWith('/git/trees')) return json({ sha: 't1' });
    if (path.endsWith('/git/commits')) return json({ sha: 'c1' });
    if (path.endsWith('/git/refs/heads/main')) return json({});
    if (path === '' || path === '/') return json({ full_name: 'ChangDustin/Dustin_Guitar', permissions: { push: true } });
    return route.fulfill({ status: 404, json: {} });
  });
  return calls;
}
