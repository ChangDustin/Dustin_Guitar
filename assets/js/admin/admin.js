// 站長管理模式：密碼登入、管理選單、底部發布列。各種編輯器按需載入（editors/*.js）。
import { S, emit, on, restoreDraft, discardDraft, site } from '../core/store.js';
import { $, esc, icon, sess } from '../core/dom.js';
import { modal, toast, confirmBox } from '../core/ui.js';

export async function initAdmin() {
  S.admin = sess.get('dg-admin', false) === true;
  await restoreDraft();
  renderPubBar();
  on('content', renderPubBar);
  on('admin', renderPubBar);
}

// 打開某個編輯器：kind = song | doc | profile | playlists | path | settings
export async function edit(kind, opts = {}) {
  if (!S.admin) { openAdminLogin(); return; }
  try {
    const mod = await import(`./editors/${kind}.js`);
    await mod.open(opts);
  } catch (err) {
    console.error(err);
    toast('編輯器載入失敗：' + esc(err.message), 'err', 6000);
  }
}

const pending = () => (S.draft && !S.draft.publishedRev ? S.draft.log.length : 0);

export function adminMenuItems() {
  const n = pending();
  return [
    { label: '新增歌曲', icon: 'plus', onClick: () => edit('song') },
    { label: '新增技巧頁', icon: 'book', onClick: () => edit('doc', { type: 'technique' }) },
    { label: '新增文章', icon: 'file', onClick: () => edit('doc', { type: 'article' }) },
    { label: '品牌資料', note: '自我介紹、照片、歷程、器材、社群', icon: 'user', onClick: () => edit('profile') },
    { label: '精選歌單', icon: 'list', onClick: () => edit('playlists') },
    { label: '學習路徑', icon: 'route', onClick: () => edit('path') },
    'sep',
    { label: '發布到網站', icon: 'cloud', badge: n ? String(n) : '', onClick: () => (n ? publish() : toast('目前沒有需要發布的變更')) },
    { label: '網站設定', note: '標題、密碼、GitHub、Firebase、備份', icon: 'gear', onClick: () => edit('settings') },
    { label: '離開管理模式', icon: 'logout', onClick: logout },
  ];
}

// 管理密碼：PBKDF2-SHA256，和 content/site.json 的 admin 雜湊比對
const b64ToBytes = b => Uint8Array.from(atob(b), c => c.charCodeAt(0));
export const bytesToB64 = u => btoa(String.fromCharCode(...u));
export async function pbkdf2(pw, saltB64, iter) {
  if (!window.crypto || !crypto.subtle) throw new Error('這個瀏覽器不支援（需要 https 網址）');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: b64ToBytes(saltB64), iterations: iter }, key, 256);
  return bytesToB64(new Uint8Array(bits));
}
export async function makeAdminHash(pw) {
  const salt = bytesToB64(crypto.getRandomValues(new Uint8Array(16)));
  const iter = 150000;
  return { salt, hash: await pbkdf2(pw, salt, iter), iter };
}

let fails = 0, lockUntil = 0;
export function openAdminLogin() {
  const m = modal({
    title: '站長管理',
    size: 'narrow',
    body: `<form class="admin-login" novalidate>
      <div class="field"><label for="ad-pw">管理密碼</label><input id="ad-pw" type="password" autocomplete="current-password" required></div>
      <p class="hint">只有站長小齊可以新增、修改與發布內容。學員請用右上角的「學員登入」。</p>
      <p class="form-error" role="alert" hidden></p>
      <button class="btn primary wide" type="submit">${icon('lock')}進入管理模式</button>
    </form>`,
  });
  const form = $('form', m.el);
  const err = $('.form-error', m.el);
  const pw = $('#ad-pw', m.el);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    err.hidden = true;
    if (Date.now() < lockUntil) { err.hidden = false; err.textContent = `錯太多次了，請 ${Math.ceil((lockUntil - Date.now()) / 1000)} 秒後再試。`; return; }
    if (!pw.value) { pw.focus(); return; }
    const btn = $('button[type=submit]', form);
    btn.disabled = true;
    try {
      const cands = [S.pub.site.admin, S.draft && S.draft.data.site.admin].filter(a => a && a.salt && a.hash);
      let pass = false;
      for (const a of cands) if (await pbkdf2(pw.value, a.salt, a.iter || 150000) === a.hash) { pass = true; break; }
      if (!pass) {
        fails++;
        if (fails >= 5) { lockUntil = Date.now() + 30000; fails = 0; }
        err.hidden = false;
        err.textContent = '密碼不正確。';
        pw.select();
        return;
      }
      fails = 0;
      S.admin = true;
      sess.set('dg-admin', true);
      m.close();
      emit('admin');
      toast('已進入管理模式。改好的內容會先存成草稿，按「發布到網站」才會公開。');
    } catch (e2) {
      err.hidden = false;
      err.textContent = '無法驗證：' + e2.message;
    } finally { btn.disabled = false; }
  });
}

function logout() {
  S.admin = false;
  sess.del('dg-admin');
  emit('admin');
  toast(pending() ? `已離開管理模式。還有 ${pending()} 項變更沒發布，草稿留在這台電腦。` : '已離開管理模式');
}

export async function publish() {
  const mod = await import('./publish.js');
  return mod.publish();
}

function renderPubBar() {
  const bar = $('#pubbar');
  if (!bar) return;
  if (!S.admin || !S.draft || (S.draft.publishedRev && S.pubbarHidden)) { bar.hidden = true; return; }
  bar.hidden = false;
  if (S.draft.publishedRev) {
    bar.innerHTML = `<span class="dot ok"></span><span class="txt">已發布！GitHub Pages 大約 1 分鐘後更新</span><button class="btn sm ghost" type="button" data-ok>知道了</button>`;
    $('[data-ok]', bar).onclick = () => { S.pubbarHidden = true; renderPubBar(); };
    return;
  }
  const n = S.draft.log.length;
  bar.innerHTML = `<span class="dot"></span><span class="txt"><b class="num">${n}</b> 項變更只存在這台電腦，還沒公開</span>
    <button class="btn sm ghost" type="button" data-log>查看</button>
    <button class="btn sm ghost" type="button" data-discard>捨棄</button>
    <button class="btn sm amber" type="button" data-pub>${icon('cloud')}發布到網站</button>`;
  $('[data-log]', bar).onclick = () => modal({ title: '還沒發布的變更', body: `<ol class="loglist">${S.draft.log.map(l => `<li>${esc(l)}</li>`).join('')}</ol>`, foot: '<button class="btn" type="button" data-close>關閉</button>' });
  $('[data-discard]', bar).onclick = async () => {
    if (await confirmBox('確定要捨棄這些還沒發布的變更嗎？捨棄後無法復原。', { ok: '捨棄', danger: true })) { await discardDraft(); toast('已捨棄草稿'); }
  };
  $('[data-pub]', bar).onclick = publish;
}

export const siteTitle = () => site().title;
