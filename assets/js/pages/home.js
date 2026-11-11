// 首頁：品牌主視覺（音孔相框＋可彈指板）→ 最近在練 → 精選歌單 → 學習路徑 → 技巧 → 文章 → 關於我
import { $, esc, icon } from '../core/dom.js';
import { S, on, site, allSongs, playlists, songById, stages, techniques, articles, songsUsing, fileUrl, groupSongs } from '../core/store.js';
import { renderMarkdown } from '../core/markdown.js';
import { fretboardHTML, mountFretboard, rosetteHTML, overStringsHTML } from '../components/fretboard.js';
import { songCard, coverHTML } from '../components/song-card.js';
import { stats, songState } from '../account/progress.js';
import { openLogDialog } from '../account/auth.js';
import { edit } from '../admin/admin.js';
import { brandSectionsHTML, bindBrandEditors } from './about.js';

export default async function ({ root, setTitle, onCleanup }) {
  setTitle('');
  const st = site();
  const prof = st.profile;
  const songs = allSongs();
  const learned = songs.filter(s => s.status === '已學會').length;
  const practicing = groupSongs(songs.filter(s => s.status === '練習中').sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))).slice(0, 4);
  const featured = playlists().filter(p => p.featured);
  const bio = prof.bio ? (await renderMarkdown(prof.bio)).html : '';

  root.innerHTML = `
  <section class="hero" aria-labelledby="hero-title">
    <div class="wrap">
      <div class="hero-text">
        <h1 id="hero-title" class="hero-title">${esc(st.title)}<span class="hero-en">${esc(st.titleEn)}</span></h1>
        <p class="hero-tagline">${esc(st.tagline)}</p>
        ${bio ? `<div class="hero-bio prose">${bio}</div>` : ''}
        ${S.admin && (!prof.bio || !prof.photo) ? `<button class="btn sm amber" type="button" data-edit-profile>${icon('edit')}填寫自我介紹和照片</button>` : ''}
        <div class="hero-cta"><a class="btn primary" href="#/songs">逛曲庫</a><a class="btn" href="#/path">從學習路徑開始</a></div>
        <dl class="hero-facts">
          <div><dt>收錄的指彈曲</dt><dd><b class="num">${songs.length}</b> 首</dd></div>
          <div><dt>小齊已學會</dt><dd><b class="num">${learned}</b> 首</dd></div>
          <div><dt>技巧小百科</dt><dd><b class="num">${techniques().length}</b> 篇</dd></div>
        </dl>
      </div>
      <div class="instrument">
        ${fretboardHTML()}
        ${prof.photo ? '' : overStringsHTML()}
        ${rosetteHTML(prof.photo ? fileUrl(prof.photo) : '', prof.name ? `${prof.name}彈吉他的照片` : '')}
      </div>
      <div class="neck-bar">
        <span class="hint">點一下弦聽音高，開啟聲音後用滑鼠或手指滑過就能刷弦。</span>
        <button class="btn sm" type="button" data-sound aria-pressed="false">${icon('mute')}聲音關</button>
      </div>
    </div>
  </section>

  <div data-me></div>

  ${practicing.length ? `<section class="section" aria-labelledby="h-practice">
    <div class="wrap">
      <div class="section-head"><h2 id="h-practice">小齊最近在練</h2><a class="more" href="#/songs">看全部 ${songs.length} 首</a></div>
      <div class="song-grid">${practicing.map(songCard).join('')}</div>
    </div>
  </section>` : ''}

  ${featured.length ? `<section class="section band" aria-labelledby="h-lists">
    <div class="wrap">
      <div class="section-head"><h2 id="h-lists">精選歌單</h2>${S.admin ? `<button class="btn sm" type="button" data-edit-lists>${icon('edit')}編輯歌單</button>` : ''}</div>
      <div class="playlist-grid">${featured.map(playlistTile).join('')}</div>
    </div>
  </section>` : ''}

  <section class="section" aria-labelledby="h-path">
    <div class="wrap">
      <div class="section-head"><h2 id="h-path">學習路徑</h2><a class="more" href="#/path">看完整路徑</a></div>
      <ol class="path-strip">${stages().map((s, i) => `<li><a href="#/path?stage=${esc(s.id)}"><span class="ps-no num">${i + 1}</span><b>${esc(s.title)}</b><small>${s.techniques.map(t => esc(techTitle(t))).join('、')}</small></a></li>`).join('')}</ol>
    </div>
  </section>

  <section class="section band" aria-labelledby="h-tech">
    <div class="wrap">
      <div class="section-head"><h2 id="h-tech">技巧小百科</h2><a class="more" href="#/techniques">全部 ${techniques().length} 個技巧</a></div>
      <div class="tech-grid compact">${techniques().map(t => `<a class="tech-tile" href="#/techniques/${esc(t.slug)}"><span class="tt-symbol">${esc(t.symbol || '♪')}</span><span class="tt-name">${esc(t.title)}</span><span class="tt-count">${songsUsing(t.slug).length} 首歌用到</span></a>`).join('')}</div>
    </div>
  </section>

  <section class="section" aria-labelledby="h-articles">
    <div class="wrap">
      <div class="section-head"><h2 id="h-articles">文章</h2><a class="more" href="#/articles">全部文章</a></div>
      <ul class="article-list">${articles().slice(0, 3).map(a => `<li><a href="#/articles/${esc(a.slug)}"><span class="al-cat">${esc(a.category)}</span><b>${esc(a.title)}</b><span class="al-sum">${esc(a.summary)}</span></a></li>`).join('')}</ul>
    </div>
  </section>

  <div data-brand>${brandSectionsHTML({ compact: true })}</div>`;

  const fb = mountFretboard(root, {
    onSound: onState => {
      const b = $('[data-sound]', root);
      b.innerHTML = onState ? `${icon('vol')}聲音開` : `${icon('mute')}聲音關`;
      b.setAttribute('aria-pressed', String(onState));
    },
  });
  $('[data-sound]', root).addEventListener('click', e => fb.setSound(e.currentTarget.getAttribute('aria-pressed') !== 'true'));
  const ep = $('[data-edit-profile]', root);
  if (ep) ep.addEventListener('click', () => edit('profile'));
  const el = $('[data-edit-lists]', root);
  if (el) el.addEventListener('click', () => edit('playlists'));
  bindBrandEditors(root);

  const drawMe = () => {
    const box = $('[data-me]', root);
    if (!box) return;
    if (!S.user) { box.innerHTML = ''; return; }
    const s = stats();
    const doing = Object.entries(allStatesSafe()).filter(([, v]) => v.status === '練習中').map(([id]) => songById(id)).filter(Boolean).slice(0, 3);
    box.innerHTML = `<section class="me-strip" aria-label="我的練習">
      <div class="wrap me-strip-in">
        <p><b>${esc(S.user.name)}</b>，這週練了 <b class="num">${s.week}</b> 分鐘，連續 <b class="num">${s.streak}</b> 天。${doing.length ? `正在練：${doing.map(x => `<a href="#/songs/${esc(x.id)}">${esc(x.title)}</a>`).join('、')}` : ''}</p>
        <div class="me-strip-actions"><button class="btn sm abalone" type="button" data-log>${icon('plus')}記錄練習</button><a class="btn sm" href="#/me">我的練習</a></div>
      </div>
    </section>`;
    $('[data-log]', box).addEventListener('click', () => openLogDialog());
  };
  drawMe();
  onCleanup(on('progress', drawMe));
}

function allStatesSafe() {
  return Object.fromEntries(allSongs().map(s => [s.id, songState(s.id)]).filter(([, v]) => v));
}

function techTitle(slug) {
  const t = techniques().find(x => x.slug === slug);
  return t ? t.title : slug;
}

export function playlistTile(p) {
  const covers = p.songIds.map(songById).filter(Boolean).slice(0, 4);
  return `<a class="playlist-tile" href="#/playlists/${esc(p.id)}">
    <span class="pl-mosaic${covers.length < 4 ? ' few' : ''}">${p.cover ? `<img src="${esc(fileUrl(p.cover))}" alt="" loading="lazy">` : covers.map(s => coverHTML(s)).join('')}</span>
    <span class="pl-text"><b>${esc(p.title)}</b><small>${p.songIds.length} 首</small><span class="pl-desc">${esc(p.description)}</span></span>
  </a>`;
}
