// 我的練習（學員中心）：統計、熱度圖、練習日誌、收藏、各首歌的進度
import { $, $$, esc, icon, fmtMinutes } from '../core/dom.js';
import { S, on, songById, groupSongs } from '../core/store.js';
import { STATUSES } from '../core/schema.js';
import { stats, logs, allStates, deleteLog } from '../account/progress.js';
import { openAuthDialog, openLogDialog } from '../account/auth.js';
import { heatmapSVG, heatLegend } from '../components/heatmap.js';
import { songCard } from '../components/song-card.js';
import { miniSongs } from './technique.js';
import { toast, confirmBox, loadingHTML } from '../core/ui.js';

export default async function ({ root, setTitle, onCleanup }) {
  setTitle('我的練習');
  const draw = () => {
    if (!S.authReady) { root.innerHTML = loadingHTML('確認登入狀態'); return; }
    if (!S.user) {
      root.innerHTML = `<section class="wrap page-head"><h1>我的練習</h1>
        <p class="lead">登入後，這裡會整理你的練習時數熱度圖、連續練習天數、收藏的歌，以及每首歌的進度。資料只有你自己看得到。</p>
        <p class="btn-row"><button class="btn abalone" type="button" data-signin>${icon('user')}登入</button><button class="btn" type="button" data-signup>建立帳號</button></p></section>`;
      $('[data-signin]', root).addEventListener('click', () => openAuthDialog('signin'));
      $('[data-signup]', root).addEventListener('click', () => openAuthDialog('signup'));
      return;
    }
    const s = stats();
    const states = allStates();
    const favSongs = s.favs.map(songById).filter(Boolean);
    const recent = logs().slice(0, 12);
    const byStatus = STATUSES.map(st => [st, Object.entries(states).filter(([, v]) => v.status === st).map(([id]) => songById(id)).filter(Boolean)]);
    root.innerHTML = `
      <section class="wrap page-head me-head">
        <div><h1>${esc(S.user.name)} 的練習</h1><p class="lead">${S.authKind === 'local' ? '示範模式：資料只存在這台電腦的瀏覽器。' : '資料存在你的帳號裡，換裝置登入也看得到。'}</p></div>
        <button class="btn abalone" type="button" data-log>${icon('plus')}記錄一次練習</button>
      </section>
      <section class="wrap">
        <dl class="me-stats">
          <div><dt>連續練習</dt><dd><b class="num">${s.streak}</b> 天</dd></div>
          <div><dt>這週練了</dt><dd><b class="num">${s.week}</b> 分鐘</dd></div>
          <div><dt>累計時數</dt><dd><b class="num">${Math.floor(s.total / 60)}</b> 小時 ${s.total % 60} 分</dd></div>
          <div><dt>已學會</dt><dd><b class="num">${s.learned}</b> 首</dd></div>
        </dl>
        <section class="panel" aria-labelledby="h-heat"><h2 id="h-heat" class="panel-title">過去一年的練習</h2>${heatmapSVG(s.days)}${heatLegend()}</section>
        <div class="me-grid">
          <section class="panel" aria-labelledby="h-logs"><h2 id="h-logs" class="panel-title">練習日誌</h2>
            ${recent.length ? `<ul class="log-list">${recent.map(l => `<li>
              <span class="ld">${esc(l.date)}</span>
              <div><span class="lm">${esc(fmtMinutes(l.minutes))}</span>${(l.songIds || []).length ? `　${l.songIds.map(songById).filter(Boolean).map(x => `<a href="#/songs/${esc(x.id)}">${esc(x.title)}</a>`).join('、')}` : ''}${l.note ? `<p>${esc(l.note)}</p>` : ''}</div>
              <button class="icon-btn sm" type="button" data-del="${esc(l.id)}" aria-label="刪除 ${esc(l.date)} 的紀錄">${icon('trash')}</button></li>`).join('')}</ul>`
              : '<p class="hint">還沒有紀錄。練完琴按右上角的「記錄一次練習」，熱度圖就會亮起來。</p>'}
          </section>
          <section class="panel progress-groups" aria-labelledby="h-prog"><h2 id="h-prog" class="panel-title">我的進度</h2>
            ${byStatus.some(([, l]) => l.length) ? byStatus.map(([st, list]) => (list.length ? `<h3>${esc(st)}（${list.length}）</h3>${miniSongs(list)}` : '')).join('')
              : '<p class="hint">到任何一首歌的頁面，在「我的練習」標記想學、練習中或已學會。</p>'}
          </section>
        </div>
        <section class="section" aria-labelledby="h-fav"><div class="section-head"><h2 id="h-fav">我收藏的歌</h2></div>
          ${favSongs.length ? `<div class="song-grid">${groupSongs(favSongs).map(songCard).join('')}</div>` : '<p class="hint">在歌曲頁按愛心就會出現在這裡。</p>'}
        </section>
      </section>`;
    $('[data-log]', root).addEventListener('click', () => openLogDialog());
    $$('[data-del]', root).forEach(b => b.addEventListener('click', async () => {
      if (!(await confirmBox('確定要刪除這筆練習紀錄嗎？', { ok: '刪除', danger: true }))) return;
      try { await deleteLog(b.dataset.del); toast('已刪除'); } catch (err) { toast(esc(err.message), 'err'); }
    }));
  };
  draw();
  onCleanup(on('progress', draw));
  onCleanup(on('user', draw));
}
