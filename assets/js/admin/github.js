// GitHub 發布設定與 API。token 只存在這台裝置的 localStorage，不會進 repo。
import { store } from '../core/dom.js';
import { S } from '../core/store.js';

export function ghConfig() {
  const saved = store.get('dg-gh', {});
  const site = (S.pub && S.pub.site.github) || {};
  return {
    owner: saved.owner || site.owner || 'ChangDustin',
    repo: saved.repo || site.repo || 'Dustin_Guitar',
    branch: saved.branch || site.branch || 'main',
    token: store.get('dg-gh-token', ''),
  };
}
export function saveGhConfig({ owner, repo, branch, token }) {
  store.set('dg-gh', { owner, repo, branch });
  if (token) store.set('dg-gh-token', token); else store.del('dg-gh-token');
}

export function ghApi(cfg) {
  return async (path, { method = 'GET', body } = {}) => {
    const r = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}${path ? '/' + path : ''}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${cfg.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) {
      let msg = '';
      try { msg = (await r.json()).message || ''; } catch { /* 沒有 JSON 內容 */ }
      throw Object.assign(new Error(`${r.status} ${msg}`.trim()), { status: r.status });
    }
    return r.status === 204 ? null : r.json();
  };
}

export const ghHint = e => (e.status === 401 ? 'token 無效或過期了，請到「網站設定」換一組新的。'
  : e.status === 403 ? 'token 沒有寫入權限（需要 Contents：Read and write），或 GitHub API 次數用完了。'
    : e.status === 404 ? '找不到 repo 或分支：請檢查 owner／repo／branch，以及 token 有沒有授權這個 repo。'
      : e.status === 409 || e.status === 422 ? 'GitHub 拒絕了這次更新，請重新整理頁面再發布一次。'
        : '請確認網路連線後再試一次。');

export function toBase64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] || '');
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}
