// 技巧頁：內文（四段固定格式）＋用到這個技巧的歌（由 songs.json 自動產生）＋相關技巧＋所在的學習關卡
import { $, esc, icon } from '../core/dom.js';
import { S, techniqueBySlug, articleBySlug, songsUsing, stages, docBody } from '../core/store.js';
import { difficultyLabel } from '../core/schema.js';
import { renderMarkdown } from '../core/markdown.js';
import { dots, coverHTML } from '../components/song-card.js';
import { loadingHTML } from '../core/ui.js';
import { edit } from '../admin/admin.js';

export const miniSongs = list => `<ul class="mini-songs">${list.map(s => `<li><a href="#/songs/${esc(s.id)}"><span class="sr-thumb">${coverHTML(s)}</span><span><b>${esc(s.title)}${s.version ? `（${esc(s.version)}）` : ''}</b>${dots(s.difficulty, 'tiny')}</span></a></li>`).join('')}</ul>`;

export default async function ({ root, params, setTitle, isCurrent }) {
  const t = techniqueBySlug(params.slug);
  if (!t) {
    setTitle('找不到這個技巧');
    root.innerHTML = `<section class="wrap page-head"><h1>找不到這個技巧</h1><p><a class="btn" href="#/techniques">${icon('chevL')}回技巧小百科</a></p></section>`;
    return;
  }
  setTitle(t.title);
  root.innerHTML = loadingHTML('技巧頁載入中');
  const body = await renderMarkdown(await docBody(t), { idPrefix: 'tq' });
  if (!isCurrent()) return;
  const songs = songsUsing(t.slug);
  const related = t.related.map(r => techniqueBySlug(r) || articleBySlug(r)).filter(Boolean);
  const stage = stages().find(st => st.techniques.includes(t.slug));
  const stageNo = stage ? stages().indexOf(stage) + 1 : 0;

  root.innerHTML = `
    <nav class="wrap crumbs" aria-label="麵包屑"><a href="#/techniques">技巧小百科</a><span aria-hidden="true">／</span><span aria-current="page">${esc(t.title)}</span></nav>
    <header class="wrap tech-head">
      <span class="tech-symbol-big" aria-hidden="true">${esc(t.symbol || '♪')}</span>
      <div>
        <h1>${esc(t.title)}</h1>
        <p class="lead">${esc(t.summary)}</p>
        <div class="tech-meta"><span>${esc(t.group)}</span><span>建議難度 ${dots(t.level, 'tiny')} ${esc(difficultyLabel(t.level))}</span>${t.symbol ? `<span>譜上記號 <b class="num">${esc(t.symbol)}</b></span>` : ''}
          ${S.admin ? `<button class="btn sm amber" type="button" data-edit>${icon('edit')}編輯這一頁</button>` : ''}</div>
      </div>
    </header>
    <div class="wrap doc-layout">
      <article class="prose">${body.html}</article>
      <aside class="doc-side">
        <section class="panel"><h2>練習曲（${songs.length}）</h2>${songs.length ? miniSongs(songs) : '<p class="hint">曲庫裡還沒有歌標記這個技巧。</p>'}</section>
        ${related.length ? `<section class="panel"><h2>相關內容</h2><div class="related-links">${related.map(r => `<a class="tech-chip" href="#/${r.category ? 'articles' : 'techniques'}/${esc(r.slug)}">${r.symbol ? `<span class="tc-sym">${esc(r.symbol)}</span>` : ''}${esc(r.title)}</a>`).join('')}</div></section>` : ''}
        ${stage ? `<section class="panel"><h2>在學習路徑的位置</h2><p>第 <b class="num">${stageNo}</b> 關：<a href="#/path?stage=${esc(stage.id)}">${esc(stage.title)}</a></p></section>` : ''}
      </aside>
    </div>`;
  const b = $('[data-edit]', root);
  if (b) b.addEventListener('click', () => edit('doc', { type: 'technique', slug: t.slug }));
}
