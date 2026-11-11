// 歌曲卡片與相關小元件：難度五格、狀態、封面
import { esc, icon } from '../core/dom.js';
import { difficultyLabel, STATUSES } from '../core/schema.js';
import { S, fileUrl } from '../core/store.js';
import { songState } from '../account/progress.js';

export const dots = (n, cls = '') =>
  `<span class="dots ${cls}" role="img" aria-label="難度 ${n} 級（共 5 級）：${esc(difficultyLabel(n))}">${[1, 2, 3, 4, 5].map(i => `<i${i <= n ? ' class="on"' : ''}></i>`).join('')}</span>`;

// 站長自己的進度（琥珀色）
export const ownerStatus = st => (STATUSES.includes(st) ? `<span class="status st-${STATUSES.indexOf(st)}">${esc(st)}</span>` : '');
// 學員自己的進度（鮑魚貝色）
export const myStatus = st => (STATUSES.includes(st) ? `<span class="mine">${icon('user')}我：${esc(st)}</span>` : '');

function hue(str) {
  let h = 17;
  for (const c of String(str)) h = (h * 31 + c.codePointAt(0)) % 360;
  return h;
}
export function coverHTML(song, cls = '') {
  if (song.cover) return `<img class="${cls}" src="${esc(fileUrl(song.cover))}" alt="" loading="lazy" decoding="async">`;
  const ch = [...String(song.title || '♪').trim()][0] || '♪';
  return `<span class="cover-gen ${cls}" style="--h:${hue(song.title)}" aria-hidden="true">${esc(ch.toUpperCase())}</span>`;
}

// group = { primary, versions }（見 store.groupSongs）
export function songCard(group, i = 0) {
  const s = group.primary;
  const mine = S.user ? songState(s.id) : null;
  const versions = group.versions.length > 1
    ? `<div class="sc-versions">${group.versions.map(v => `<a href="#/songs/${esc(v.id)}">${esc(v.version)}</a>`).join('')}</div>` : '';
  return `<article class="song-card" style="--i:${Math.min(i, 12)}">
    <div class="sc-cover">${coverHTML(s)}${mine && mine.fav ? `<span class="sc-fav" title="我收藏的歌">${icon('heartFill')}</span>` : ''}</div>
    <div class="sc-body">
      <h3 class="sc-title"><a class="stretched" href="#/songs/${esc(s.id)}">${esc(s.title)}</a></h3>
      ${s.titleZh ? `<p class="sc-sub">${esc(s.titleZh)}</p>` : ''}
      <p class="sc-artist">${esc(s.artist)}</p>
      <div class="sc-meta">${dots(s.difficulty)}${ownerStatus(s.status)}</div>
      ${mine && mine.status ? `<div class="sc-mine">${myStatus(mine.status)}</div>` : ''}
      ${versions}
    </div>
  </article>`;
}

// 列表檢視的一列（仿探吉日雙欄列表）
export function songRow(group) {
  const s = group.primary;
  const mine = S.user ? songState(s.id) : null;
  return `<article class="song-row">
    <div class="sr-thumb">${coverHTML(s)}</div>
    <div class="sr-main">
      <h3><a class="stretched" href="#/songs/${esc(s.id)}">${esc(s.title)}</a>${group.versions.length > 1 ? `<span class="sr-ver">${group.versions.length} 個版本</span>` : ''}</h3>
      <p>${esc(s.artist)}${s.titleZh ? `<span class="muted">　${esc(s.titleZh)}</span>` : ''}</p>
    </div>
    <div class="sr-side">${mine && mine.status ? myStatus(mine.status) : ownerStatus(s.status)}${dots(s.difficulty)}</div>
  </article>`;
}
