// 學員帳號的入口：選擇 Firebase 或示範模式、登入／註冊對話框、記錄練習對話框。
import { S, emit, site, allSongs } from '../core/store.js';
import { $, $$, esc, icon, ymd } from '../core/dom.js';
import { modal, toast } from '../core/ui.js';
import * as progress from './progress.js';

let provider = null;

export async function initAuth() {
  const cfg = site().firebase;
  const forceDemo = new URLSearchParams(location.search).has('demo');
  if (cfg && cfg.apiKey && !forceDemo) {
    try {
      provider = await (await import('./firebase.js')).createFirebaseProvider(cfg);
      S.authKind = 'firebase';
    } catch (err) {
      console.error(err);
      toast('帳號服務連線失敗，暫時改用示範模式。', 'warn', 5000);
    }
  }
  if (!provider) {
    provider = (await import('./local.js')).createLocalProvider();
    S.authKind = 'local';
  }
  progress.setProvider(provider);
  provider.onUser(async user => {
    S.user = user;
    S.authReady = true;
    await progress.loadProgress();
    emit('user', user);
  });
}

export async function signOut() {
  await provider.signOut();
  toast('已登出');
}

const demoNote = () => (S.authKind === 'local'
  ? `<p class="notice">示範模式：帳號和紀錄只存在這台電腦的瀏覽器。站長接上 Firebase 之後，就能在任何裝置登入同一個帳號。</p>` : '');

export function openAuthDialog(mode = 'signin', { reason = '' } = {}) {
  const isUp = mode === 'signup';
  const m = modal({
    title: isUp ? '建立學員帳號' : '學員登入',
    size: 'narrow',
    body: `${reason ? `<p class="hint">${esc(reason)}</p>` : ''}${demoNote()}
      ${provider.canGoogle ? `<button class="btn google-btn" type="button" data-google>${icon('user')} 使用 Google 帳號${isUp ? '註冊' : '登入'}</button><div class="or"><span>或用 Email</span></div>` : ''}
      <form class="auth-form" novalidate>
        ${isUp ? `<div class="field"><label for="au-name">暱稱</label><input id="au-name" name="name" maxlength="30" autocomplete="nickname" required></div>` : ''}
        <div class="field"><label for="au-email">Email</label><input id="au-email" name="email" type="email" autocomplete="email" required></div>
        <div class="field"><label for="au-pw">密碼${isUp ? '（至少 6 個字元）' : ''}</label><input id="au-pw" name="pw" type="password" minlength="6" autocomplete="${isUp ? 'new-password' : 'current-password'}" required></div>
        <p class="form-error" role="alert" hidden></p>
        <button class="btn abalone wide" type="submit">${isUp ? '建立帳號' : '登入'}</button>
      </form>
      <p class="auth-switch">${isUp ? '已經有帳號了？<button class="link" type="button" data-switch="signin">登入</button>' : '還沒有帳號？<button class="link" type="button" data-switch="signup">建立帳號</button>'}
      ${!isUp && provider.canReset ? '　<button class="link" type="button" data-reset>忘記密碼</button>' : ''}</p>`,
  });
  const form = $('form', m.el);
  const errBox = $('.form-error', m.el);
  const showErr = msg => { errBox.hidden = false; errBox.textContent = msg; };
  const done = () => { m.close(); toast(`歡迎${S.user ? '，' + esc(S.user.name) : ''}！你的練習紀錄會存在帳號裡。`); };
  form.addEventListener('submit', async e => {
    e.preventDefault();
    errBox.hidden = true;
    const fd = new FormData(form);
    const btn = $('button[type=submit]', form);
    btn.disabled = true;
    try {
      if (isUp) await provider.signUp(fd.get('email'), fd.get('pw'), fd.get('name'));
      else await provider.signIn(fd.get('email'), fd.get('pw'));
      setTimeout(done, 50);
    } catch (err) {
      showErr(provider.errorMessage(err));
    } finally { btn.disabled = false; }
  });
  const g = $('[data-google]', m.el);
  if (g) g.addEventListener('click', async () => {
    try { await provider.signInGoogle(); setTimeout(done, 50); } catch (err) { showErr(provider.errorMessage(err)); }
  });
  $$('[data-switch]', m.el).forEach(b => b.addEventListener('click', () => { m.close(); openAuthDialog(b.dataset.switch, { reason }); }));
  const r = $('[data-reset]', m.el);
  if (r) r.addEventListener('click', async () => {
    const email = $('#au-email', m.el).value.trim();
    if (!email) { showErr('請先在上面填好 Email，再按「忘記密碼」。'); return; }
    try { await provider.resetPassword(email); toast('已寄出重設密碼的信，請到信箱收信。'); } catch (err) { showErr(provider.errorMessage(err)); }
  });
}

// 需要登入的動作：沒登入就先開登入框
export function requireUser(reason) {
  if (S.user) return true;
  openAuthDialog('signin', { reason });
  return false;
}

export function openLogDialog({ songId = '' } = {}) {
  if (!requireUser('登入後才能記錄練習，紀錄會存在你的帳號裡。')) return;
  const songs = [...allSongs()].sort((a, b) => String(a.title).localeCompare(String(b.title), 'zh-Hant'));
  const m = modal({
    title: '記錄這次練習',
    body: `<form class="log-form form-grid" novalidate>
      <div class="field half"><label for="lg-date">日期</label><input id="lg-date" name="date" type="date" value="${ymd()}" max="${ymd()}" required></div>
      <div class="field half"><label for="lg-min">練了幾分鐘</label><input id="lg-min" name="minutes" type="number" min="1" max="1440" inputmode="numeric" value="30" required>
        <div class="quick">${[10, 20, 30, 45, 60].map(n => `<button class="chip" type="button" data-min="${n}">${n}</button>`).join('')}</div></div>
      <div class="field"><span class="label">練了哪些歌</span>
        <input class="input" type="search" placeholder="找歌名" data-filter aria-label="篩選歌曲">
        <div class="pick-list">${songs.map(s => `<label class="check pick" data-name="${esc((s.title + ' ' + (s.titleZh || '') + ' ' + s.artist).toLowerCase())}"><input type="checkbox" name="songs" value="${esc(s.id)}" ${s.id === songId ? 'checked' : ''}>${esc(s.title)}${s.version ? `<span class="muted">（${esc(s.version)}）</span>` : ''}</label>`).join('')}</div></div>
      <div class="field"><label for="lg-note">備註（選填）</label><textarea id="lg-note" name="note" maxlength="500" placeholder="今天卡在哪一段、明天想練什麼"></textarea></div>
      <p class="form-error field" role="alert" hidden></p>
    </form>`,
    foot: `<button class="btn" type="button" data-close>取消</button><button class="btn abalone" type="button" data-save>記錄</button>`,
  });
  const form = $('form', m.el);
  $$('[data-min]', m.el).forEach(b => b.addEventListener('click', () => { $('#lg-min', m.el).value = b.dataset.min; }));
  $('[data-filter]', m.el).addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    $$('.pick', m.el).forEach(l => { l.hidden = q && !l.dataset.name.includes(q); });
  });
  const errBox = $('.form-error', m.el);
  $('[data-save]', m.el).addEventListener('click', async e => {
    const fd = new FormData(form);
    e.currentTarget.disabled = true;
    try {
      await progress.addLog({ date: fd.get('date'), minutes: fd.get('minutes'), songIds: fd.getAll('songs'), note: fd.get('note') || '' });
      m.close();
      toast(`已記錄 ${esc(fd.get('minutes'))} 分鐘，繼續保持！`);
    } catch (err) {
      errBox.hidden = false;
      errBox.textContent = err.message;
      e.currentTarget.disabled = false;
    }
  });
}
