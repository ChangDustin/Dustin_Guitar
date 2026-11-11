// 學習路徑：由淺到深的關卡；學員的完成度＝這一關的歌裡，自己標成「已學會」的比例
import { $, esc, icon } from '../core/dom.js';
import { S, on, stages, techniqueBySlug, articleBySlug, songById } from '../core/store.js';
import { songState } from '../account/progress.js';
import { miniSongs } from './technique.js';
import { edit } from '../admin/admin.js';

export default async function ({ root, setTitle, query, onCleanup }) {
  setTitle('學習路徑');
  const draw = () => {
    root.innerHTML = `
      <section class="wrap page-head songs-head">
        <div><h1>學習路徑</h1><p class="lead">把曲庫裡的歌和技巧排成 ${stages().length} 關，由淺到深。每關先讀技巧頁，再挑一首歌練到會。${S.user ? '你標成「已學會」的歌會算進完成度。' : '登入後會顯示你每一關的完成度。'}</p></div>
        ${S.admin ? `<button class="btn amber" type="button" data-edit>${icon('edit')}編輯學習路徑</button>` : ''}
      </section>
      <section class="wrap"><ol class="path-list">${stages().map((st, i) => {
        const songs = st.songs.map(songById).filter(Boolean);
        const done = S.user ? songs.filter(s => (songState(s.id) || {}).status === '已學會').length : 0;
        return `<li class="stage" id="stage-${esc(st.id)}">
          <span class="stage-no" aria-hidden="true">${i + 1}</span>
          <div class="stage-card">
            <h2><span class="visually-hidden">第 ${i + 1} 關：</span>${esc(st.title)}</h2>
            <p class="stage-goal">${esc(st.goal)}</p>
            ${st.techniques.length ? `<h3>先讀這些技巧</h3><div class="related-links">${st.techniques.map(techniqueBySlug).filter(Boolean).map(t => `<a class="tech-chip" href="#/techniques/${esc(t.slug)}"><span class="tc-sym">${esc(t.symbol || '')}</span>${esc(t.title)}</a>`).join('')}</div>` : ''}
            ${(st.articles || []).length ? `<h3>延伸閱讀</h3><div class="related-links">${st.articles.map(articleBySlug).filter(Boolean).map(a => `<a class="tag" href="#/articles/${esc(a.slug)}">${esc(a.title)}</a>`).join('')}</div>` : ''}
            <h3>練習曲</h3><div class="stage-songs">${miniSongs(songs)}</div>
            ${S.user && songs.length ? `<div class="stage-progress"><span>我學會 <b class="num">${done}</b> / ${songs.length} 首</span><span class="progress"><i style="width:${Math.round((done / songs.length) * 100)}%"></i></span></div>` : ''}
          </div>
        </li>`;
      }).join('')}</ol></section>`;
    const b = $('[data-edit]', root);
    if (b) b.addEventListener('click', () => edit('path'));
  };
  draw();
  if (query.stage) {
    const el = document.getElementById('stage-' + query.stage);
    if (el) {
      setTimeout(() => { el.scrollIntoView({ block: 'start' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1600); }, 60);
    }
  }
  onCleanup(on('progress', draw));
}
