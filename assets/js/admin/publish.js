// 發布到網站：先用和 npm run check 同一套規則檢查草稿，通過後用 GitHub Git Data API 一次 commit。
import { $, $$, esc, icon } from '../core/dom.js';
import { S, emit, saveDraft, collectPaths, fileUrl } from '../core/store.js';
import { validateContent } from '../core/validate.js';
import { buildIndex, indexText } from '../core/content-index.js';
import { modal } from '../core/ui.js';
import { ghConfig, ghApi, ghHint, toBase64 } from './github.js';

const json = v => JSON.stringify(v, null, 2) + '\n';
// 媒體只自動清掉這幾個資料夾裡沒人用的檔案；media/notes 是手動放的插圖，不動
const AUTO_CLEAN = /^media\/(covers|tabs|videos|photos)\//;

async function fetchText(path) {
  const r = await fetch(fileUrl(path) + '?t=' + Date.now(), { cache: 'no-store' });
  if (!r.ok) throw new Error(`${path} 讀不到（HTTP ${r.status}）`);
  return r.text();
}

let running = false;
export async function publish() {
  if (running || !S.draft) return;
  const cfg = ghConfig();
  if (!cfg.token) {
    const mod = await import('./editors/settings.js');
    mod.open({ focus: 'github' });
    emit('toast', { msg: '第一次發布前，請先在「GitHub 發布設定」貼上 token。', type: 'warn' });
    return;
  }
  running = true;
  const dr = S.draft;
  const steps = ['檢查內容格式與連結', '連線 GitHub，讀取最新版本', '上傳新檔案', '建立 commit', '更新網站分支'];
  const m = modal({
    title: '發布到網站', dismissible: false,
    body: `<ol class="steps">${steps.map(t => `<li><span class="sdot"></span><span>${t}</span><em></em></li>`).join('')}</ol>
      <div class="progress" style="margin-top:16px"><i data-bar></i></div><div data-result></div>`,
    foot: '<button class="btn" type="button" data-close disabled>關閉</button>',
  });
  const lis = $$('.steps li', m.el), bar = $('[data-bar]', m.el), result = $('[data-result]', m.el);
  let at = -1;
  const step = i => { if (at >= 0) lis[at].className = 'done'; at = i; lis[i].className = 'run'; bar.style.width = `${(i / steps.length) * 100}%`; };
  const done = () => { running = false; const b = $('[data-close]', m.el); b.disabled = false; b.classList.add('primary'); };

  try {
    // 1. 檢查：所有 Markdown 的全文（草稿裡改過的用草稿，其餘從網站讀）
    step(0);
    const data = structuredClone(dr.data);
    const entries = [...data.index.techniques.map(e => ({ ...e, type: 'technique' })), ...data.index.articles.map(e => ({ ...e, type: 'article' }))];
    const docs = await Promise.all(entries.map(async e => ({ type: e.type, path: e.path, text: dr.bodies[e.path] != null ? dr.bodies[e.path] : await fetchText(e.path) })));
    const api = ghApi(cfg);
    const ref = await api(`git/ref/heads/${encodeURIComponent(cfg.branch)}`);
    const baseCommit = await api(`git/commits/${ref.object.sha}`);
    const baseTree = await api(`git/trees/${baseCommit.tree.sha}?recursive=1`);
    const existing = new Set(baseTree.tree.filter(t => t.type === 'blob').map(t => t.path));
    const report = validateContent({ site: data.site, songs: data.songs, playlists: data.playlists, path: data.path, chords: data.chords, docs, fileExists: p => existing.has(p) || !!dr.files[p] });
    if (report.errors.length) {
      lis[0].className = 'fail';
      result.innerHTML = `<div class="check-report bad"><b>有 ${report.errors.length} 個問題要先修正，這次沒有發布：</b><ul>${report.errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul></div>`;
      done();
      return;
    }
    if (report.warnings.length) result.innerHTML = `<div class="check-report warn"><b>提醒 ${report.warnings.length} 項（不影響發布）：</b><ul>${report.warnings.map(e => `<li>${esc(e)}</li>`).join('')}</ul></div>`;

    // 2. 決定要寫哪些檔
    step(1);
    data.site.rev = new Date().toISOString();
    data.site.github = { owner: cfg.owner, repo: cfg.repo, branch: cfg.branch };
    data.index = buildIndex(docs);
    const tree = [];
    const changed = (a, b) => JSON.stringify(a) !== JSON.stringify(b);
    tree.push({ path: 'content/site.json', mode: '100644', type: 'blob', content: json(data.site) });
    if (changed(data.songs, S.pub.songs)) tree.push({ path: 'content/songs.json', mode: '100644', type: 'blob', content: json(data.songs) });
    if (changed(data.playlists, S.pub.playlists)) tree.push({ path: 'content/playlists.json', mode: '100644', type: 'blob', content: json(data.playlists) });
    if (changed(data.path, S.pub.path)) tree.push({ path: 'content/path.json', mode: '100644', type: 'blob', content: json(data.path) });
    tree.push({ path: 'content/index.json', mode: '100644', type: 'blob', content: indexText(data.index) });
    for (const [path, text] of Object.entries(dr.bodies)) {
      if (entries.some(e => e.path === path)) tree.push({ path, mode: '100644', type: 'blob', content: text.endsWith('\n') ? text : text + '\n' });
    }
    const keptDocs = new Set(entries.map(e => e.path));
    for (const e of [...S.pub.index.techniques, ...S.pub.index.articles]) {
      if (!keptDocs.has(e.path) && existing.has(e.path)) tree.push({ path: e.path, mode: '100644', type: 'blob', sha: null });
    }

    // 3. 上傳新檔案
    step(2);
    const used = collectPaths(data, Object.fromEntries(docs.map(d => [d.path, d.text])));
    const uploads = Object.entries(dr.files).filter(([p]) => used.has(p));
    let k = 0;
    for (const [path, blob] of uploads) {
      const b = await api('git/blobs', { method: 'POST', body: { content: await toBase64(blob), encoding: 'base64' } });
      tree.push({ path, mode: '100644', type: 'blob', sha: b.sha });
      k++;
      lis[2].querySelector('em').textContent = `${k} / ${uploads.length}`;
      bar.style.width = `${((2 + k / Math.max(1, uploads.length)) / steps.length) * 100}%`;
    }
    const removed = [...existing].filter(p => AUTO_CLEAN.test(p) && !used.has(p));
    for (const p of removed) tree.push({ path: p, mode: '100644', type: 'blob', sha: null });

    // 4–5. 建立 commit、移動分支
    step(3);
    const newTree = await api('git/trees', { method: 'POST', body: { base_tree: baseCommit.tree.sha, tree } });
    const log = dr.log.length ? dr.log : ['更新內容'];
    const message = `網站更新：${log.slice(0, 3).join('、')}${log.length > 3 ? ` 等 ${log.length} 項` : ''}\n\n${log.map(l => '- ' + l).join('\n')}\n\n由「小齊吉他」管理模式發布`;
    const commit = await api('git/commits', { method: 'POST', body: { message, tree: newTree.sha, parents: [ref.object.sha] } });
    step(4);
    await api(`git/refs/heads/${encodeURIComponent(cfg.branch)}`, { method: 'PATCH', body: { sha: commit.sha } });
    lis[4].className = 'done';
    bar.style.width = '100%';

    dr.data = data;
    dr.publishedRev = data.site.rev;
    dr.log = [];
    await saveDraft();
    result.innerHTML += `<div class="result-box ok"><b>發布成功！</b>這次寫入 ${tree.length - removed.length} 個檔案${removed.length ? `、清掉 ${removed.length} 個沒在用的舊檔` : ''}。GitHub Pages 大約 1 分鐘後更新，所有人就看得到。<br>
      <a href="https://github.com/${esc(cfg.owner)}/${esc(cfg.repo)}/commit/${esc(commit.sha)}" target="_blank" rel="noopener">${icon('ext')}在 GitHub 查看這次的 commit</a></div>`;
  } catch (e) {
    if (at >= 0) lis[at].className = 'fail';
    result.innerHTML += `<div class="result-box bad"><b>發布失敗</b>（${esc(e.message)}）<br>${esc(e.status ? ghHint(e) : '請確認網路連線後再試一次。')}<br><span class="hint">草稿還在，修正後可以再按一次「發布到網站」。</span></div>`;
  } finally {
    done();
  }
}
