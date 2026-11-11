// 技巧小百科：依「左手／右手／和弦／調弦與移調」分組
import { esc, icon } from '../core/dom.js';
import { S, techniques, songsUsing } from '../core/store.js';
import { TECHNIQUE_GROUPS } from '../core/schema.js';
import { dots } from '../components/song-card.js';
import { edit } from '../admin/admin.js';

export function techTile(t) {
  const n = songsUsing(t.slug).length;
  return `<a class="tech-tile" href="#/techniques/${esc(t.slug)}">
    <span class="tt-symbol">${esc(t.symbol || '♪')}</span>
    <span class="tt-name">${esc(t.title)}</span>
    <span class="tt-sum">${esc(t.summary)}</span>
    <span class="tt-foot"><span class="tt-count">${n ? `${n} 首歌用到` : '還沒有歌用到'}</span>${dots(t.level, 'tiny')}</span>
  </a>`;
}

export default async function ({ root, setTitle }) {
  setTitle('技巧小百科');
  const all = techniques();
  root.innerHTML = `
    <section class="wrap page-head songs-head">
      <div><h1>技巧小百科</h1><p class="lead">${all.length} 個指彈常用技巧，每一頁都有「是什麼、怎麼練、常見錯誤、在譜上長這樣」，最後列出曲庫裡用到它的歌。</p></div>
      ${S.admin ? `<button class="btn amber" type="button" data-add>${icon('plus')}新增技巧頁</button>` : ''}
    </section>
    <div class="wrap">
      ${TECHNIQUE_GROUPS.map(g => {
        const list = all.filter(t => t.group === g);
        return list.length ? `<section class="tech-group" aria-labelledby="g-${esc(g)}"><h2 id="g-${esc(g)}">${esc(g)}</h2><div class="tech-grid full">${list.map(techTile).join('')}</div></section>` : '';
      }).join('')}
    </div>`;
  const add = root.querySelector('[data-add]');
  if (add) add.addEventListener('click', () => edit('doc', { type: 'technique' }));
}
