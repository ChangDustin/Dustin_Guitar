// 網站設定：標題與標語、管理密碼、GitHub 發布、Firebase 帳號服務、備份與草稿
import { $, esc, icon } from '../../core/dom.js';
import { S, cur, site, ensureDraft, saveDraft, discardDraft } from '../../core/store.js';
import { modal, toast, confirmBox } from '../../core/ui.js';
import { makeAdminHash } from '../admin.js';
import { ghConfig, saveGhConfig, ghApi, ghHint } from '../github.js';

const FB_KEYS = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId', 'measurementId'];
// 接受 Firebase 主控台複製出來的整段 JS（const firebaseConfig = { apiKey: "…", … }）或 JSON
export function parseFirebaseConfig(text) {
  const out = {};
  for (const k of FB_KEYS) {
    const m = new RegExp(`["']?${k}["']?\\s*:\\s*["']([^"']+)["']`).exec(text);
    if (m) out[k] = m[1];
  }
  if (!out.apiKey || !out.projectId || !out.appId) throw new Error('看不到 apiKey、projectId 或 appId，請把 Firebase 主控台給的整段 firebaseConfig 貼上來。');
  return out;
}

export async function open({ focus = '' } = {}) {
  const st = site();
  const cfg = ghConfig();
  const fb = st.firebase;
  const m = modal({
    title: '網站設定', size: 'wide',
    body: `<section class="editor-sec"><h3>網站名稱</h3><div class="form-grid">
        <div class="field third"><label for="se-title">中文名稱</label><input id="se-title" maxlength="20" value="${esc(st.title)}"></div>
        <div class="field third"><label for="se-en">英文名稱</label><input id="se-en" maxlength="30" value="${esc(st.titleEn || '')}"></div>
        <div class="field"><label for="se-tag">標語</label><input id="se-tag" maxlength="60" value="${esc(st.tagline || '')}"></div></div>
        <div class="btn-row" style="margin-top:12px"><button class="btn sm" type="button" data-site>存成草稿</button></div></section>

      <section class="editor-sec"><h3>修改管理密碼</h3><p class="hint">發布後才會在其他裝置生效。密碼只以 PBKDF2 雜湊存在 site.json，不存明文。</p><div class="form-grid">
        <div class="field half"><label for="se-pw1">新密碼（至少 8 個字）</label><input id="se-pw1" type="password" autocomplete="new-password"></div>
        <div class="field half"><label for="se-pw2">再輸入一次</label><input id="se-pw2" type="password" autocomplete="new-password"></div></div>
        <div class="btn-row" style="margin-top:12px"><button class="btn sm" type="button" data-pw>更新密碼（草稿）</button></div></section>

      <section class="editor-sec" id="se-github"><h3>GitHub 發布設定</h3>
        <p class="hint">「發布到網站」會用 GitHub API 把草稿一次 commit 到 repo。需要一組 <b>fine-grained personal access token</b>：Repository access 只選 <b>${esc(cfg.repo)}</b>，權限 <b>Contents：Read and write</b>。token 只存在這台裝置。<a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">到 GitHub 建立 token</a></p>
        <div class="form-grid">
          <div class="field third"><label for="gh-owner">帳號 owner</label><input id="gh-owner" value="${esc(cfg.owner)}"></div>
          <div class="field third"><label for="gh-repo">Repo</label><input id="gh-repo" value="${esc(cfg.repo)}"></div>
          <div class="field third"><label for="gh-branch">分支</label><input id="gh-branch" value="${esc(cfg.branch)}"></div>
          <div class="field"><label for="gh-token">Token</label><input id="gh-token" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…" value="${esc(cfg.token)}"></div></div>
        <div class="btn-row" style="margin-top:12px"><button class="btn sm primary" type="button" data-gh-save>儲存在這台裝置</button><button class="btn sm" type="button" data-gh-test>測試連線</button><button class="btn sm ghost danger" type="button" data-gh-clear>移除 token</button></div>
        <p class="hint" data-gh-msg style="margin-top:8px"></p></section>

      <section class="editor-sec" id="se-firebase"><h3>學員帳號（Firebase）</h3>
        <p class="hint">目前：${fb && fb.projectId ? `已接上 Firebase 專案 <b>${esc(fb.projectId)}</b>` : '還沒設定，學員帳號使用「示範模式」（只存在各自的瀏覽器）'}。把 Firebase 主控台「專案設定 → 你的應用程式」裡的整段 <code>firebaseConfig</code> 貼上來。這段設定本來就會公開給每個訪客，可以放進 repo；真正保護資料的是 firestore.rules。</p>
        <div class="field"><textarea class="input" id="se-fb" rows="6" spellcheck="false" placeholder="const firebaseConfig = { apiKey: &quot;…&quot;, authDomain: &quot;…&quot;, projectId: &quot;…&quot;, … };"></textarea></div>
        <div class="btn-row" style="margin-top:12px"><button class="btn sm" type="button" data-fb>存成草稿</button>${fb ? '<button class="btn sm ghost danger" type="button" data-fb-clear>改回示範模式</button>' : ''}</div></section>

      <section class="editor-sec"><h3>備份與草稿</h3>
        <p class="hint">匯出目前看到的所有內容（JSON）。草稿裡還沒發布的上傳檔案不會包含在內。</p>
        <div class="btn-row" style="margin-top:12px"><button class="btn sm" type="button" data-export>${icon('download')}匯出備份</button>
        <button class="btn sm danger" type="button" data-discard ${S.draft ? '' : 'disabled'}>${icon('trash')}捨棄所有未發布變更</button></div></section>`,
    foot: '<button class="btn" type="button" data-close>完成</button>',
  });
  const el = m.el;
  if (focus) setTimeout(() => { const sec = $(`#se-${focus}`, el); if (sec) sec.scrollIntoView({ block: 'start' }); }, 80);

  $('[data-site]', el).addEventListener('click', async () => {
    const title = $('#se-title', el).value.trim();
    if (!title) { toast('網站名稱不能空白', 'err'); return; }
    const d = ensureDraft();
    Object.assign(d.data.site, { title, titleEn: $('#se-en', el).value.trim(), tagline: $('#se-tag', el).value.trim() });
    await saveDraft('修改網站名稱與標語');
    toast('已存成草稿');
  });
  $('[data-pw]', el).addEventListener('click', async () => {
    const a = $('#se-pw1', el).value, b = $('#se-pw2', el).value;
    if (a.length < 8) { toast('密碼至少要 8 個字', 'err'); return; }
    if (a !== b) { toast('兩次輸入的密碼不一樣', 'err'); return; }
    ensureDraft().data.site.admin = await makeAdminHash(a);
    await saveDraft('修改管理密碼');
    $('#se-pw1', el).value = $('#se-pw2', el).value = '';
    toast('新密碼已存成草稿，發布後生效');
  });
  const read = () => ({ owner: $('#gh-owner', el).value.trim(), repo: $('#gh-repo', el).value.trim(), branch: $('#gh-branch', el).value.trim() || 'main', token: $('#gh-token', el).value.trim() });
  const msg = $('[data-gh-msg]', el);
  $('[data-gh-save]', el).addEventListener('click', () => { saveGhConfig(read()); msg.textContent = '已儲存在這台裝置。'; toast('GitHub 設定已儲存'); });
  $('[data-gh-test]', el).addEventListener('click', async () => {
    const c = read();
    if (!c.token) { msg.textContent = '請先貼上 token。'; return; }
    msg.textContent = '連線中…';
    try {
      const api = ghApi(c);
      const info = await api('');
      await api(`git/ref/heads/${encodeURIComponent(c.branch)}`);
      msg.innerHTML = info.permissions && !info.permissions.push
        ? `讀得到 ${esc(info.full_name)}，但這個帳號沒有寫入權限。`
        : `連線成功：<b>${esc(info.full_name)}</b>（${esc(c.branch)} 分支），可以發布。記得按「儲存在這台裝置」。`;
    } catch (e) { msg.textContent = `連線失敗（${e.message}）：${ghHint(e)}`; }
  });
  $('[data-gh-clear]', el).addEventListener('click', () => { const c = read(); c.token = ''; saveGhConfig(c); $('#gh-token', el).value = ''; msg.textContent = 'token 已從這台裝置移除。'; });
  $('[data-fb]', el).addEventListener('click', async () => {
    try {
      const conf = parseFirebaseConfig($('#se-fb', el).value);
      ensureDraft().data.site.firebase = conf;
      await saveDraft(`接上 Firebase 專案 ${conf.projectId}`);
      toast(`已存成草稿：Firebase 專案 ${esc(conf.projectId)}。發布後學員就能註冊真正的帳號。`, 'ok', 6000);
    } catch (err) { toast(esc(err.message), 'err', 6000); }
  });
  const fbClear = $('[data-fb-clear]', el);
  if (fbClear) fbClear.addEventListener('click', async () => {
    if (!(await confirmBox('改回示範模式後，學員在 Firebase 的紀錄不會被刪除，但網站會暫時讀不到。確定嗎？', { ok: '改回示範模式' }))) return;
    ensureDraft().data.site.firebase = null;
    await saveDraft('學員帳號改回示範模式');
  });
  $('[data-export]', el).addEventListener('click', () => {
    const c = cur();
    const data = { exportedAt: new Date().toISOString(), site: { ...c.site, admin: undefined }, songs: c.songs, playlists: c.playlists, path: c.path };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = `dustin-guitar-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  $('[data-discard]', el).addEventListener('click', async () => {
    if (!(await confirmBox('確定要捨棄所有還沒發布的變更嗎？這個動作無法復原。', { ok: '捨棄', danger: true }))) return;
    m.close();
    await discardDraft();
    toast('已捨棄草稿，回到網站上的版本');
  });
}
