// 文章頁：內文＋自動目錄（由 ## 與 ### 產生）＋延伸閱讀＋上一篇／下一篇
import { $, $$, esc, icon } from '../core/dom.js';
import { S, articles, articleBySlug, techniqueBySlug, docBody } from '../core/store.js';
import { renderMarkdown } from '../core/markdown.js';
import { loadingHTML } from '../core/ui.js';
import { edit } from '../admin/admin.js';

const fmt = d => (d ? d.replace(/^(\d{4})-(\d{2})-(\d{2})$/, (_, y, m, dd) => `${y} 年 ${Number(m)} 月 ${Number(dd)} 日`) : '');

export default async function ({ root, params, setTitle, isCurrent, onCleanup }) {
  const a = articleBySlug(params.slug);
  if (!a) {
    setTitle('找不到這篇文章');
    root.innerHTML = `<section class="wrap page-head"><h1>找不到這篇文章</h1><p><a class="btn" href="#/articles">${icon('chevL')}回文章列表</a></p></section>`;
    return;
  }
  setTitle(a.title);
  root.innerHTML = loadingHTML('文章載入中');
  const body = await renderMarkdown(await docBody(a), { idPrefix: 'ar' });
  if (!isCurrent()) return;
  const list = articles();
  const i = list.indexOf(a);
  const newer = list[i - 1], older = list[i + 1];
  const related = a.related.map(r => techniqueBySlug(r) || articleBySlug(r)).filter(Boolean);

  root.innerHTML = `
    <nav class="wrap crumbs" aria-label="麵包屑"><a href="#/articles">文章</a><span aria-hidden="true">／</span><a href="#/articles?cat=${encodeURIComponent(a.category)}">${esc(a.category)}</a></nav>
    <header class="wrap article-head">
      <div class="article-meta"><span class="cat">${esc(a.category)}</span><span>${esc(fmt(a.date))}</span><span>約 ${a.minutes} 分鐘讀完</span></div>
      <h1>${esc(a.title)}</h1>
      <p class="lead">${esc(a.summary)}</p>
      ${S.admin ? `<p><button class="btn sm amber" type="button" data-edit>${icon('edit')}編輯這篇文章</button></p>` : ''}
    </header>
    <div class="wrap doc-layout">
      <article class="prose">${body.html}</article>
      <aside class="doc-side">
        ${body.headings.length ? `<nav class="toc" aria-label="文章目錄"><h2>這篇在講</h2><ol>${body.headings.map(h => `<li class="lv${h.level}"><a href="#${esc(h.id)}" data-toc="${esc(h.id)}">${esc(h.text)}</a></li>`).join('')}</ol></nav>` : ''}
        ${related.length ? `<section class="panel"><h2>延伸閱讀</h2><div class="related-links">${related.map(r => `<a class="tech-chip" href="#/${r.category ? 'articles' : 'techniques'}/${esc(r.slug)}">${r.symbol ? `<span class="tc-sym">${esc(r.symbol)}</span>` : ''}${esc(r.title)}</a>`).join('')}</div></section>` : ''}
      </aside>
    </div>
    <nav class="wrap prevnext" aria-label="上一篇與下一篇">
      ${older ? `<a class="pn" href="#/articles/${esc(older.slug)}"><small>上一篇</small><b>${esc(older.title)}</b></a>` : '<span></span>'}
      ${newer ? `<a class="pn next" href="#/articles/${esc(newer.slug)}"><small>下一篇</small><b>${esc(newer.title)}</b></a>` : '<span></span>'}
    </nav>`;

  // 目錄連結：網址是 hash 路由，所以不能用 #id，改成捲動
  $$('[data-toc]', root).forEach(l => l.addEventListener('click', e => {
    e.preventDefault();
    const target = document.getElementById(l.dataset.toc);
    if (target) target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }));
  const heads = body.headings.map(h => document.getElementById(h.id)).filter(Boolean);
  if (heads.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(ents => {
      ents.forEach(en => {
        if (!en.isIntersecting) return;
        $$('[data-toc]', root).forEach(x => x.classList.toggle('on', x.dataset.toc === en.target.id));
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    heads.forEach(h => io.observe(h));
    onCleanup(() => io.disconnect());
  }
  const b = $('[data-edit]', root);
  if (b) b.addEventListener('click', () => edit('doc', { type: 'article', slug: a.slug }));
}
