// 曲庫：搜尋、難度五格、狀態、調弦、歌單篩選；方塊／列表；同一首歌的版本合併成一張卡
import { $, $$, esc, icon, store } from '../core/dom.js';
import { S, on, allSongs, playlists, groupSongs } from '../core/store.js';
import { STATUSES, DIFFICULTY_LABELS } from '../core/schema.js';
import { songCard, songRow, dots } from '../components/song-card.js';
import { songState } from '../account/progress.js';
import { emptyHTML } from '../core/ui.js';
import { edit } from '../admin/admin.js';

const F = { q: '', level: 0, status: '', tuning: '', list: '', mine: '', sort: 'new' };

const SORTS = {
  new: (a, b) => String(b.createdAt).localeCompare(String(a.createdAt)),
  title: (a, b) => String(a.title).localeCompare(String(b.title), 'zh-Hant'),
  easy: (a, b) => a.difficulty - b.difficulty || String(a.title).localeCompare(String(b.title), 'zh-Hant'),
  hard: (a, b) => b.difficulty - a.difficulty || String(a.title).localeCompare(String(b.title), 'zh-Hant'),
};

function filtered() {
  const q = F.q.trim().toLowerCase();
  const pl = F.list ? playlists().find(p => p.id === F.list) : null;
  const list = allSongs().filter(s => {
    if (F.level && s.difficulty !== F.level) return false;
    if (F.status && s.status !== F.status) return false;
    if (F.tuning === 'standard' && s.tuning !== 'standard') return false;
    if (F.tuning === 'alt' && s.tuning === 'standard') return false;
    if (pl && !pl.songIds.includes(s.id)) return false;
    if (F.mine && S.user) {
      const m = songState(s.id);
      if (F.mine === 'fav' && !(m && m.fav)) return false;
      if (F.mine === 'none' && m && m.status) return false;
      if (STATUSES.includes(F.mine) && !(m && m.status === F.mine)) return false;
    }
    if (!q) return true;
    return [s.title, s.titleZh, s.artist, s.arranger, s.version, ...(s.tags || [])].join(' ').toLowerCase().includes(q);
  });
  return list.sort(SORTS[F.sort] || SORTS.new);
}

export default async function ({ root, query, setTitle, onCleanup }) {
  setTitle('曲庫');
  if (query.list) F.list = query.list;
  if (query.q) F.q = query.q;
  let view = store.get('dg-view', 'grid');
  const all = allSongs();
  const groups = groupSongs(all).length;

  root.innerHTML = `
    <section class="wrap page-head songs-head">
      <div><h1>曲庫</h1><p class="lead">${all.length} 首指彈譜，合併成 ${groups} 首歌。難度、狀態都是小齊自己的評估；登入後可以標記你自己的進度。</p></div>
      ${S.admin ? `<button class="btn amber" type="button" data-add>${icon('plus')}新增歌曲</button>` : ''}
    </section>
    <section class="wrap filters" aria-label="篩選與排序">
      <label class="search-box">${icon('search')}<input type="search" data-q placeholder="找歌名、演出者、編曲、標籤" value="${esc(F.q)}" aria-label="搜尋曲庫"></label>
      <div class="filter-row">
        <div class="seg-group" role="group" aria-label="難度">
          <button class="chip" type="button" data-level="0" aria-pressed="${!F.level}">全部難度</button>
          ${[1, 2, 3, 4, 5].map(n => `<button class="chip level-chip" type="button" data-level="${n}" aria-pressed="${F.level === n}" title="${DIFFICULTY_LABELS[n]}">${dots(n)}<span class="visually-hidden">${DIFFICULTY_LABELS[n]}</span></button>`).join('')}
        </div>
      </div>
      <div class="filter-row">
        <select class="input sel" data-status aria-label="小齊的進度"><option value="">小齊的進度：全部</option>${STATUSES.map(s => `<option${F.status === s ? ' selected' : ''}>${s}</option>`).join('')}</select>
        <select class="input sel" data-tuning aria-label="調弦"><option value="">調弦：全部</option><option value="standard"${F.tuning === 'standard' ? ' selected' : ''}>標準調弦</option><option value="alt"${F.tuning === 'alt' ? ' selected' : ''}>特殊調弦</option></select>
        <select class="input sel" data-list aria-label="歌單"><option value="">歌單：全部</option>${playlists().map(p => `<option value="${esc(p.id)}"${F.list === p.id ? ' selected' : ''}>${esc(p.title)}</option>`).join('')}</select>
        <select class="input sel mine-sel" data-mine aria-label="我的進度" ${S.user ? '' : 'hidden'}><option value="">我的進度：全部</option><option value="fav">我收藏的</option>${STATUSES.map(s => `<option value="${s}">我${s}</option>`).join('')}<option value="none">我還沒標記的</option></select>
        <select class="input sel" data-sort aria-label="排序"><option value="new">最新加入</option><option value="title">依歌名</option><option value="easy">難度：由簡單到難</option><option value="hard">難度：由難到簡單</option></select>
        <div class="view-toggle" role="group" aria-label="顯示方式">
          <button class="icon-btn sm" type="button" data-view="grid" aria-pressed="${view === 'grid'}" aria-label="方塊">${icon('grid')}</button>
          <button class="icon-btn sm" type="button" data-view="list" aria-pressed="${view === 'list'}" aria-label="列表">${icon('list')}</button>
        </div>
        <button class="btn sm" type="button" data-random>${icon('dice')}隨機挑一首</button>
      </div>
    </section>
    <section class="wrap songs-results" aria-live="polite">
      <p class="result-count" data-count></p>
      <div data-results></div>
    </section>`;

  $('[data-sort]', root).value = F.sort;
  $('[data-mine]', root).value = F.mine;

  const draw = () => {
    const list = filtered();
    const grouped = groupSongs(list);
    $('[data-count]', root).textContent = list.length === all.length ? `共 ${grouped.length} 首歌` : `找到 ${grouped.length} 首歌（共 ${groups} 首）`;
    const box = $('[data-results]', root);
    if (!grouped.length) {
      box.innerHTML = emptyHTML('沒有符合條件的歌', '試試放寬難度或清除搜尋字。', '<button class="btn sm" type="button" data-clear>清除所有篩選</button>');
      $('[data-clear]', box).addEventListener('click', () => { Object.assign(F, { q: '', level: 0, status: '', tuning: '', list: '', mine: '' }); location.hash = '#/songs'; render(); });
      return;
    }
    box.innerHTML = view === 'grid'
      ? `<div class="song-grid">${grouped.map(songCard).join('')}</div>`
      : `<div class="song-list">${grouped.map(songRow).join('')}</div>`;
  };
  const render = () => { draw(); };
  draw();

  $('[data-q]', root).addEventListener('input', e => { F.q = e.target.value; draw(); });
  $$('[data-level]', root).forEach(b => b.addEventListener('click', () => {
    F.level = Number(b.dataset.level);
    $$('[data-level]', root).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    draw();
  }));
  $('[data-status]', root).addEventListener('change', e => { F.status = e.target.value; draw(); });
  $('[data-tuning]', root).addEventListener('change', e => { F.tuning = e.target.value; draw(); });
  $('[data-list]', root).addEventListener('change', e => { F.list = e.target.value; draw(); });
  $('[data-mine]', root).addEventListener('change', e => { F.mine = e.target.value; draw(); });
  $('[data-sort]', root).addEventListener('change', e => { F.sort = e.target.value; draw(); });
  $$('[data-view]', root).forEach(b => b.addEventListener('click', () => {
    view = b.dataset.view;
    store.set('dg-view', view);
    $$('[data-view]', root).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    draw();
  }));
  $('[data-random]', root).addEventListener('click', () => {
    const list = groupSongs(filtered());
    if (!list.length) return;
    const pick = list[Math.floor(Math.random() * list.length)].primary;
    location.hash = `#/songs/${pick.id}`;
  });
  const add = $('[data-add]', root);
  if (add) add.addEventListener('click', () => edit('song'));
  onCleanup(on('progress', draw));
}
