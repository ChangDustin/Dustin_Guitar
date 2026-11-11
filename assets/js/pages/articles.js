// 文章列表：依分類篩選
import { $$, esc, icon } from '../core/dom.js';
import { S, articles } from '../core/store.js';
import { ARTICLE_CATEGORIES } from '../core/schema.js';
import { edit } from '../admin/admin.js';

const fmt = d => (d ? d.replace(/^(\d{4})-(\d{2})-(\d{2})$/, (_, y, m, dd) => `${y} 年 ${Number(m)} 月 ${Number(dd)} 日`) : '');
let cat = '';

export default async function ({ root, setTitle, query }) {
  setTitle('文章');
  if (query.cat) cat = query.cat;
  const all = articles();
  const used = ARTICLE_CATEGORIES.filter(c => all.some(a => a.category === c));
  root.innerHTML = `
    <section class="wrap page-head songs-head">
      <div><h1>文章</h1><p class="lead">讀譜方法、樂理筆記與練琴心得。提到的技巧、歌曲與和弦都可以直接點過去。</p></div>
      ${S.admin ? `<button class="btn amber" type="button" data-add>${icon('plus')}新增文章</button>` : ''}
    </section>
    <section class="wrap">
      <div class="cat-filter" role="group" aria-label="文章分類">
        <button class="chip" type="button" data-cat="" aria-pressed="${!cat}">全部（${all.length}）</button>
        ${used.map(c => `<button class="chip" type="button" data-cat="${esc(c)}" aria-pressed="${cat === c}">${esc(c)}（${all.filter(a => a.category === c).length}）</button>`).join('')}
      </div>
      <div class="article-cards" data-list></div>
    </section>`;
  const draw = () => {
    const list = all.filter(a => !cat || a.category === cat);
    root.querySelector('[data-list]').innerHTML = list.map(a => `<article class="article-card">
      <div class="article-meta"><span class="cat">${esc(a.category)}</span><span>${esc(fmt(a.date))}</span><span>約 ${a.minutes} 分鐘讀完</span></div>
      <h2><a class="stretched" href="#/articles/${esc(a.slug)}">${esc(a.title)}</a></h2>
      <p>${esc(a.summary)}</p>
    </article>`).join('');
  };
  draw();
  $$('[data-cat]', root).forEach(b => b.addEventListener('click', () => {
    cat = b.dataset.cat;
    $$('[data-cat]', root).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    draw();
  }));
  const add = root.querySelector('[data-add]');
  if (add) add.addEventListener('click', () => edit('doc', { type: 'article' }));
}
