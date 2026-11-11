// 歌單頁：一個精選歌單裡的所有歌
import { esc, icon } from '../core/dom.js';
import { S, playlistById, songById, groupSongs, fileUrl } from '../core/store.js';
import { songCard, coverHTML } from '../components/song-card.js';
import { edit } from '../admin/admin.js';

export default async function ({ root, params, setTitle }) {
  const p = playlistById(params.id);
  if (!p) {
    setTitle('找不到這個歌單');
    root.innerHTML = `<section class="wrap page-head"><h1>找不到這個歌單</h1><p><a class="btn" href="#/songs">${icon('chevL')}回曲庫</a></p></section>`;
    return;
  }
  setTitle(p.title);
  const songs = p.songIds.map(songById).filter(Boolean);
  root.innerHTML = `
    <nav class="wrap crumbs" aria-label="麵包屑"><a href="#/songs">曲庫</a><span aria-hidden="true">／</span><span aria-current="page">${esc(p.title)}</span></nav>
    <section class="wrap page-head playlist-head">
      <span class="pl-mosaic">${p.cover ? `<img src="${esc(fileUrl(p.cover))}" alt="">` : songs.slice(0, 4).map(s => coverHTML(s)).join('')}</span>
      <div><h1>${esc(p.title)}</h1><p class="lead">${esc(p.description)}</p><p class="muted">${songs.length} 首歌</p>
        ${S.admin ? `<button class="btn sm amber" type="button" data-edit>${icon('edit')}編輯歌單</button>` : ''}</div>
    </section>
    <section class="wrap"><div class="song-grid">${groupSongs(songs).map(songCard).join('')}</div></section>`;
  const b = root.querySelector('[data-edit]');
  if (b) b.addEventListener('click', () => edit('playlists', { id: p.id }));
}
