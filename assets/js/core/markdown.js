// Markdown → 安全的 HTML。所有 Markdown 都要經過 renderMarkdown（內含 DOMPurify）。
// 支援站內交叉連結 [[song:id]]、[[technique:slug]]、[[article:slug]]、[[chord:Am7]]，可加 |顯示文字。
import { CDN, importCdn } from './cdn.js';
import { esc } from './dom.js';
import { LINK_RE } from './schema.js';
import { songById, techniqueBySlug, articleBySlug, fileUrl } from './store.js';

let libs = null;
async function getLibs() {
  if (!libs) {
    libs = Promise.all([importCdn(CDN.marked), importCdn(CDN.purify)]).then(([m, p]) => ({ marked: m.marked, purify: p.default }));
    libs.catch(() => { libs = null; });
  }
  return libs;
}

export function linkTarget(type, target) {
  if (type === 'song') { const s = songById(target); return { href: `#/songs/${target}`, label: s ? s.title : target, ok: !!s }; }
  if (type === 'technique') { const t = techniqueBySlug(target); return { href: `#/techniques/${target}`, label: t ? t.title : target, ok: !!t }; }
  if (type === 'article') { const a = articleBySlug(target); return { href: `#/articles/${target}`, label: a ? a.title : target, ok: !!a }; }
  return { href: `#/chords?q=${encodeURIComponent(target)}`, label: target, ok: true };
}

function wikiLinks(md) {
  return String(md || '').replace(LINK_RE, (_, type, target, label) => {
    const t = linkTarget(type, target);
    return `<a class="wl wl-${type}${t.ok ? '' : ' broken'}" href="${esc(t.href)}">${esc(label || t.label)}</a>`;
  });
}

// 回傳 { html, headings: [{ id, level, text }] }
export async function renderMarkdown(md, { idPrefix = 'sec' } = {}) {
  const { marked, purify } = await getLibs();
  const raw = marked.parse(wikiLinks(md), { gfm: true, breaks: false });
  const clean = purify.sanitize(raw, { ADD_ATTR: ['target', 'rel'] });
  const tpl = document.createElement('template');
  tpl.innerHTML = clean;
  const root = tpl.content;
  const headings = [];
  let n = 0;
  root.querySelectorAll('h2, h3').forEach(h => {
    h.id = `${idPrefix}-${++n}`;
    headings.push({ id: h.id, level: Number(h.tagName[1]), text: h.textContent });
  });
  root.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src') || '';
    if (/^media\//.test(src)) img.src = fileUrl(src);
    img.loading = 'lazy';
    img.decoding = 'async';
    const p = img.parentElement;
    if (p && p.tagName === 'P' && p.childNodes.length === 1) {
      const fig = document.createElement('figure');
      fig.className = 'md-figure';
      const a = document.createElement('a');
      a.href = img.src; a.target = '_blank'; a.rel = 'noopener';
      a.appendChild(img.cloneNode());
      fig.appendChild(a);
      if (img.alt) { const cap = document.createElement('figcaption'); cap.textContent = img.alt; fig.appendChild(cap); }
      p.replaceWith(fig);
    }
  });
  root.querySelectorAll('a[href^="http"]').forEach(a => { a.target = '_blank'; a.rel = 'noopener'; });
  root.querySelectorAll('table').forEach(t => {
    const w = document.createElement('div');
    w.className = 'table-wrap';
    t.replaceWith(w);
    w.appendChild(t);
  });
  const div = document.createElement('div');
  div.appendChild(root);
  return { html: div.innerHTML, headings };
}
