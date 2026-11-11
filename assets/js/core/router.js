// 路由：網址 #/xxx 對應到 assets/js/pages/xxx.js。新增頁面請照 CLAUDE.md 5.4。
import { $, esc } from './dom.js';
import { S, site } from './store.js';

// [網址樣式, 頁面模組名稱]
export const ROUTES = [
  ['/', 'home'],
  ['/songs', 'songs'],
  ['/songs/:id', 'song'],
  ['/playlists/:id', 'playlist'],
  ['/techniques', 'techniques'],
  ['/techniques/:slug', 'technique'],
  ['/articles', 'articles'],
  ['/articles/:slug', 'article'],
  ['/path', 'path'],
  ['/chords', 'chords'],
  ['/tuner', 'tuner'],
  ['/metronome', 'metronome'],
  ['/me', 'me'],
  ['/about', 'about'],
];

// 頁首選單；match 決定哪個項目要標成「目前頁」
export const NAV = [
  { href: '#/songs', label: '曲庫', match: /^\/(songs|playlists)/ },
  { href: '#/techniques', label: '技巧', match: /^\/techniques/ },
  { href: '#/articles', label: '文章', match: /^\/articles/ },
  { href: '#/path', label: '學習路徑', match: /^\/path/ },
  {
    label: '練琴工具', match: /^\/(tuner|chords|metronome)/,
    children: [
      { href: '#/tuner', label: '調音器', note: '用麥克風聽音高' },
      { href: '#/chords', label: '和弦字典', note: '查按法與指型' },
      { href: '#/metronome', label: '節拍器', note: '跟著拍子練' },
    ],
  },
  { href: '#/about', label: '關於我', match: /^\/about/ },
];

export function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [pathPart, queryPart = ''] = raw.split('?');
  const path = decodeURIComponent(pathPart.replace(/\/+$/, '') || '/');
  const query = Object.fromEntries(new URLSearchParams(queryPart));
  for (const [pattern, name] of ROUTES) {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    const m = re.exec(path);
    if (m) return { name, path, query, params: Object.fromEntries(keys.map((k, i) => [k, m[i + 1]])) };
  }
  return { name: 'notfound', path, query, params: {} };
}

let cleanups = [];
let current = null;
let seq = 0;
const scrollMemory = new Map();

// 程式檔下載失敗（Chrome、Firefox、Safari 的錯誤字樣不同）多半是網路不穩，重新整理就好
const NET_ERROR = /dynamically imported module|module script/i;
function showError(root, title, err) {
  console.error(err);
  const net = NET_ERROR.test(err && err.message);
  root.innerHTML = `<section class="wrap page-head"><h1>${net ? '網路不穩，這一頁沒有載入完成' : title}</h1>
    <p class="lead">${net ? '有些程式沒有下載成功，重新整理通常就會好。' : esc(err.message)}</p>
    <p>${net ? '<button class="btn primary" type="button" data-reload>重新整理</button> ' : ''}<a class="btn" href="#/">回首頁</a></p></section>`;
  const reload = root.querySelector('[data-reload]');
  if (reload) reload.addEventListener('click', () => location.reload());
}

export async function render({ keepScroll = false } = {}) {
  const route = parseHash();
  const mySeq = ++seq;
  const root = $('#app');
  if (current) scrollMemory.set(current.path, window.scrollY);
  cleanups.splice(0).forEach(fn => { try { fn(); } catch { /* 清理失敗不影響換頁 */ } });
  const samePage = current && current.path === route.path;
  current = route;
  document.dispatchEvent(new CustomEvent('route', { detail: route }));
  let mod;
  try {
    mod = await import(`../pages/${route.name}.js`);
  } catch (err) {
    showError(root, '這一頁載入失敗', err);
    return;
  }
  if (mySeq !== seq) return;
  const ctx = {
    root, params: route.params, query: route.query, path: route.path,
    setTitle: t => { document.title = t ? `${t}｜${site().title}` : `${site().title} ${site().titleEn || ''}`.trim(); },
    onCleanup: fn => cleanups.push(fn),
    isCurrent: () => mySeq === seq,
  };
  try {
    await mod.default(ctx);
  } catch (err) {
    showError(root, '這一頁出錯了', err);
  }
  if (mySeq !== seq) return;
  if (keepScroll || samePage) return;
  const y = scrollMemory.get(route.path);
  window.scrollTo(0, route.name === 'home' || /^\/(songs|techniques|articles)$/.test(route.path) ? y || 0 : 0);
  if (!S.firstRenderDone) S.firstRenderDone = true;
  else root.focus({ preventScroll: true });
}

export function startRouter() {
  window.addEventListener('hashchange', () => render());
  return render();
}
export const rerender = () => render({ keepScroll: true });
