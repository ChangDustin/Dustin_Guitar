// 提示訊息、對話框、確認框。所有彈出介面都走這裡，行為才會一致（Esc 關閉、焦點移入）。
import { $, $$, esc, icon } from './dom.js';
import { on } from './store.js';

export function toast(msg, type = 'ok', ms = 3600) {
  const box = $('#toasts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = msg;
  box.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 260); }, ms);
}
on('toast', ({ msg, type }) => toast(esc(msg), type));

const stack = [];
export function modal({ title, body, foot = '', size = '', dismissible = true, onClose, label }) {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(label || title)}">
    <div class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn sm" type="button" data-close aria-label="關閉">${icon('x')}</button></div>
    <div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</div>`;
  const opener = document.activeElement;
  document.body.appendChild(back);
  document.body.classList.add('no-scroll');
  const m = {
    el: back.firstElementChild, back, dismissible, closed: false,
    close(v) {
      if (m.closed) return;
      m.closed = true;
      stack.splice(stack.indexOf(m), 1);
      back.classList.add('out');
      setTimeout(() => back.remove(), 160);
      if (!stack.length) document.body.classList.remove('no-scroll');
      if (opener && opener.focus && document.contains(opener)) opener.focus({ preventScroll: true });
      if (onClose) onClose(v);
    },
  };
  let downOnBack = false;
  back.addEventListener('pointerdown', e => { downOnBack = e.target === back; });
  back.addEventListener('click', e => { if (e.target === back && downOnBack && m.dismissible) m.close(); });
  $$('[data-close]', back).forEach(b => b.addEventListener('click', () => m.close()));
  stack.push(m);
  // 立刻把焦點移進對話框，避免 Enter 又按到背後的按鈕
  const f = $('.modal-body input:not([type=hidden]):not([type=file]):not([readonly]):not([disabled]), .modal-body textarea, .modal-body select', m.el);
  if (f && matchMedia('(pointer: fine)').matches) f.focus({ preventScroll: true });
  else { m.el.tabIndex = -1; m.el.focus({ preventScroll: true }); }
  return m;
}
export const openModals = () => stack.length;

export function confirmBox(html, { ok = '確定', danger = false, title = '請確認' } = {}) {
  return new Promise(res => {
    const m = modal({
      title, body: `<div class="confirm-text">${html}</div>`,
      foot: `<button class="btn" type="button" data-close>取消</button><button class="btn ${danger ? 'danger solid' : 'primary'}" type="button" data-ok>${esc(ok)}</button>`,
      onClose: v => res(v === true),
    });
    $('[data-ok]', m.el).addEventListener('click', () => m.close(true));
  });
}

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const m = stack[stack.length - 1];
  if (m && m.dismissible) m.close();
});

// 下拉選單：items = [{ label, icon, href?, onClick?, note?, badge? } | 'sep']
let openMenu = null;
export function closeMenu() { if (openMenu) { openMenu.el.remove(); openMenu.btn.setAttribute('aria-expanded', 'false'); openMenu = null; } }
export function toggleMenu(btn, items, { align = 'right' } = {}) {
  if (openMenu && openMenu.btn === btn) { closeMenu(); return; }
  closeMenu();
  const el = document.createElement('div');
  el.className = `menu ${align}`;
  el.setAttribute('role', 'menu');
  el.innerHTML = items.map((it, i) => (it === 'sep' ? '<hr>'
    : it.html ? `<div class="menu-info">${it.html}</div>`
      : it.href ? `<a role="menuitem" href="${esc(it.href)}">${it.icon ? icon(it.icon) : ''}<span>${esc(it.label)}${it.note ? `<small>${esc(it.note)}</small>` : ''}</span>${it.badge ? `<em class="badge">${esc(it.badge)}</em>` : ''}</a>`
        : `<button role="menuitem" type="button" data-i="${i}">${it.icon ? icon(it.icon) : ''}<span>${esc(it.label)}${it.note ? `<small>${esc(it.note)}</small>` : ''}</span>${it.badge ? `<em class="badge">${esc(it.badge)}</em>` : ''}</button>`)).join('');
  btn.parentElement.appendChild(el);
  btn.setAttribute('aria-expanded', 'true');
  openMenu = { el, btn };
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-i]');
    const a = e.target.closest('a');
    if (b) { const it = items[Number(b.dataset.i)]; closeMenu(); it.onClick && it.onClick(); }
    else if (a) closeMenu();
  });
  const first = el.querySelector('a, button');
  if (first) first.focus({ preventScroll: true });
}
document.addEventListener('click', e => { if (openMenu && !openMenu.el.contains(e.target) && !openMenu.btn.contains(e.target)) closeMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && openMenu) { const b = openMenu.btn; closeMenu(); b.focus(); } });

// 給載入中的區塊用
export const loadingHTML = (text = '載入中') => `<div class="loading" role="status"><span class="spinner" aria-hidden="true"></span>${esc(text)}…</div>`;
export const emptyHTML = (title, hint = '', action = '') => `<div class="empty"><p class="empty-title">${esc(title)}</p>${hint ? `<p class="hint">${hint}</p>` : ''}${action}</div>`;
