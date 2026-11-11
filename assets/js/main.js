// 啟動：載入內容 → 站長草稿 → 頁首頁尾 → 學員帳號 → 路由
import { $, $$, esc, icon } from './core/dom.js';
import { S, loadContent, on, site, allSongs } from './core/store.js';
import { NAV, startRouter, rerender } from './core/router.js';
import { toggleMenu, closeMenu } from './core/ui.js';
import { initAuth, openAuthDialog, openLogDialog, signOut } from './account/auth.js';
import { initAdmin, adminMenuItems, openAdminLogin } from './admin/admin.js';
import { SOCIAL_TYPES } from './core/schema.js';

function renderNav() {
  const nav = $('#nav');
  nav.innerHTML = `<ul>${NAV.map((n, i) => (n.children
    ? `<li class="has-sub"><button type="button" class="nav-link" data-sub="${i}" aria-expanded="false" aria-haspopup="true">${esc(n.label)}${icon('chevD')}</button>
        <ul class="sub">${n.children.map(c => `<li><a href="${c.href}"><b>${esc(c.label)}</b><small>${esc(c.note)}</small></a></li>`).join('')}</ul></li>`
    : `<li><a class="nav-link" href="${n.href}">${esc(n.label)}</a></li>`)).join('')}</ul>`;
  $$('[data-sub]', nav).forEach(b => b.addEventListener('click', () => {
    const open = b.getAttribute('aria-expanded') !== 'true';
    $$('[data-sub]', nav).forEach(x => x.setAttribute('aria-expanded', 'false'));
    b.setAttribute('aria-expanded', String(open));
  }));
  document.addEventListener('click', e => {
    if (!e.target.closest('.has-sub')) $$('[data-sub]', nav).forEach(x => x.setAttribute('aria-expanded', 'false'));
  });
  const toggle = $('#nav-toggle');
  toggle.addEventListener('click', () => {
    const open = !nav.classList.contains('open');
    nav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? '關閉選單' : '打開選單');
  });
}

function markNav(route) {
  const nav = $('#nav');
  nav.classList.remove('open');
  $('#nav-toggle').setAttribute('aria-expanded', 'false');
  $$('[data-sub]', nav).forEach(x => x.setAttribute('aria-expanded', 'false'));
  $$('.nav-link', nav).forEach((a, i) => {
    const item = NAV[i];
    const on = item && item.match && item.match.test(route.path);
    a.classList.toggle('on', !!on);
    if (on && a.tagName === 'A') a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

function renderActions() {
  const box = $('#top-actions');
  const u = S.user;
  box.innerHTML = `
    ${S.admin ? `<div class="menu-anchor"><button class="btn sm amber" type="button" data-admin aria-haspopup="true" aria-expanded="false">${icon('gear')}管理模式</button></div>` : ''}
    <div class="menu-anchor">${u
      ? `<button class="avatar" type="button" data-account aria-haspopup="true" aria-expanded="false" aria-label="${esc(u.name)} 的帳號選單">${esc([...u.name][0] || '我')}</button>`
      : `<button class="btn sm" type="button" data-login>${icon('user')}學員登入</button>`}</div>`;
  const a = $('[data-admin]', box);
  if (a) a.addEventListener('click', () => toggleMenu(a, adminMenuItems()));
  const login = $('[data-login]', box);
  if (login) login.addEventListener('click', () => openAuthDialog('signin'));
  const acc = $('[data-account]', box);
  if (acc) acc.addEventListener('click', () => toggleMenu(acc, [
    { html: `<b>${esc(u.name)}</b><small>${esc(u.email)}${S.authKind === 'local' ? '（示範模式）' : ''}</small>` },
    { label: '我的練習', icon: 'clock', href: '#/me' },
    { label: '記錄一次練習', icon: 'plus', onClick: () => openLogDialog() },
    'sep',
    { label: '登出', icon: 'logout', onClick: () => signOut() },
  ]));
}

function renderFooter() {
  const st = site();
  const socials = (st.socials || []).filter(s => s.url);
  $('#footer').innerHTML = `<div class="wrap foot">
    <div class="foot-brand"><b>${esc(st.title)}</b> <span>${esc(st.titleEn)}</span><p>${esc(st.tagline)}</p></div>
    ${socials.length ? `<ul class="socials">${socials.map(s => `<li><a href="${esc(s.type === 'email' ? 'mailto:' + s.url : s.url)}" target="_blank" rel="noopener" aria-label="${esc(SOCIAL_TYPES[s.type] || s.type)}">${icon(s.type === 'email' ? 'mail' : s.type === 'website' ? 'globe' : s.type)}</a></li>`).join('')}</ul>` : ''}
    <nav class="foot-links" aria-label="頁尾連結">
      <a href="#/songs">曲庫（${allSongs().length} 首）</a><a href="#/techniques">技巧小百科</a><a href="#/path">學習路徑</a>
      <a href="https://github.com/${esc((st.github && st.github.owner) || 'ChangDustin')}/${esc((st.github && st.github.repo) || 'Dustin_Guitar')}" target="_blank" rel="noopener">GitHub 原始碼</a>
      ${S.admin ? '' : '<button class="link" type="button" data-admin-login>站長管理</button>'}
    </nav>
    <p class="foot-note">樂譜與影片版權屬原作者與原上傳者，本站作為個人練習紀錄。</p>
  </div>`;
  const b = $('[data-admin-login]');
  if (b) b.addEventListener('click', openAdminLogin);
}

async function boot() {
  renderNav();
  try {
    await loadContent();
  } catch (err) {
    $('#app').innerHTML = `<section class="wrap page-head"><h1>內容載入失敗</h1>
      <p class="lead">如果你是直接雙擊打開 index.html，瀏覽器會擋住讀取 content/ 資料夾。請改用網址開啟，或在專案資料夾執行 <code>npm run dev</code>。</p>
      <p class="hint">錯誤訊息：${esc(err.message)}</p></section>`;
    return;
  }
  await initAdmin();
  renderActions();
  renderFooter();
  document.addEventListener('route', e => { closeMenu(); markNav(e.detail); });
  on('user', () => { renderActions(); rerender(); });
  on('content', () => { renderActions(); renderFooter(); rerender(); });
  on('admin', () => { renderActions(); renderFooter(); rerender(); });
  initAuth();
  await startRouter();
}

boot();
