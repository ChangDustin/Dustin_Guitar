// 歌曲頁：影片（A-B 循環、慢速）＋樂譜＋技巧重點＋和弦＋調弦／節拍器＋學員自己的練習區
import { $, $$, esc, icon, debounce, fmtDate } from '../core/dom.js';
import { S, on, songById, versionsOf, allSongs, techniqueBySlug, chordTable, fileUrl } from '../core/store.js';
import { difficultyLabel, STATUSES } from '../core/schema.js';
import { songTuning, tuningLetters, changedStrings } from '../core/music.js';
import { renderMarkdown } from '../core/markdown.js';
import { dots, ownerStatus, coverHTML } from '../components/song-card.js';
import { videoPlayerHTML, mountVideoPlayer } from '../components/video-player.js';
import { pdfViewerHTML, mountPdfViewer } from '../components/pdf-viewer.js';
import { metronomeHTML, mountMetronome } from '../components/metronome.js';
import { chordFigure } from '../components/chord-diagram.js';
import { songState, setSongState, logs } from '../account/progress.js';
import { openAuthDialog, openLogDialog } from '../account/auth.js';
import { toast } from '../core/ui.js';
import { edit } from '../admin/admin.js';

const DIAGRAM_TUNINGS = ['standard', 'half-step-down', 'whole-step-down'];

export default async function ({ root, params, setTitle, onCleanup }) {
  const s = songById(params.id);
  if (!s) {
    setTitle('找不到這首歌');
    root.innerHTML = `<section class="wrap page-head"><h1>找不到這首歌</h1><p class="lead">可能已經被移除，或網址打錯了。</p><p><a class="btn" href="#/songs">${icon('chevL')}回曲庫</a></p></section>`;
    return;
  }
  setTitle(s.title);
  const versions = versionsOf(s);
  const tuning = songTuning(s);
  const changed = changedStrings(tuning.notes);
  const hl = await renderMarkdown(s.highlights || '');
  const techs = s.techniques.map(techniqueBySlug).filter(Boolean);
  const order = [...allSongs()].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const idx = order.findIndex(x => x.id === s.id);
  const prev = order[idx - 1], next = order[idx + 1];
  const showDiagrams = DIAGRAM_TUNINGS.includes(s.tuning);

  root.innerHTML = `
    <nav class="wrap crumbs" aria-label="麵包屑"><a href="#/songs">曲庫</a><span aria-hidden="true">／</span><span aria-current="page">${esc(s.title)}</span></nav>
    <header class="wrap song-head">
      <div class="sh-cover">${coverHTML(s)}</div>
      <div class="sh-text">
        <h1>${esc(s.title)}</h1>
        ${s.titleZh ? `<p class="sh-sub">${esc(s.titleZh)}</p>` : ''}
        <dl class="sh-credits">
          ${s.artist ? `<div><dt>原唱／作曲</dt><dd>${esc(s.artist)}</dd></div>` : ''}
          ${s.arranger ? `<div><dt>編曲／採譜</dt><dd>${esc(s.arranger)}</dd></div>` : ''}
        </dl>
        <div class="sh-badges">${dots(s.difficulty)}<span class="level-text">${esc(difficultyLabel(s.difficulty))}</span>${ownerStatus(s.status)}${s.tags.map(t => `<a class="tag" href="#/songs?q=${encodeURIComponent(t)}">${esc(t)}</a>`).join('')}</div>
        ${versions.length > 1 ? `<nav class="versions" aria-label="這首歌的其他版本">${versions.map(v => `<a href="#/songs/${esc(v.id)}"${v.id === s.id ? ' aria-current="page"' : ''}>${esc(v.version)}${dots(v.difficulty, 'tiny')}</a>`).join('')}</nav>` : ''}
        ${S.admin ? `<button class="btn sm amber" type="button" data-edit>${icon('edit')}編輯這首歌</button>` : ''}
      </div>
    </header>

    <div class="wrap song-layout">
      <div class="song-video">${videoPlayerHTML(s.videos)}</div>
      <div class="song-sheet">${pdfViewerHTML()}</div>
      <div class="song-rest">
        <section class="panel" aria-labelledby="h-hl">
          <h2 id="h-hl" class="panel-title">技巧重點</h2>
          <div class="prose highlights">${hl.html}</div>
          ${techs.length ? `<div class="tech-chips">${techs.map(t => `<a class="tech-chip" href="#/techniques/${esc(t.slug)}"><span class="tc-sym">${esc(t.symbol || '')}</span>${esc(t.title)}</a>`).join('')}</div>` : ''}
        </section>

        ${s.chords.length ? `<section class="panel" aria-labelledby="h-chords">
          <h2 id="h-chords" class="panel-title">這首歌的和弦</h2>
          ${showDiagrams
            ? `<div class="chord-row">${s.chords.map(c => chordFigure(c, chordTable())).join('')}</div>${s.capo ? `<p class="hint">指型以 Capo 為準：夾在第 ${s.capo} 格後照這些形狀按。</p>` : ''}`
            : `<div class="chord-names">${s.chords.map(c => `<a class="tag" href="#/chords?q=${encodeURIComponent(c)}">${esc(c)}</a>`).join('')}</div><p class="hint">這首是特殊調弦，標準調弦的和弦圖不適用，指型請以譜上的 TAB 為準。</p>`}
        </section>` : ''}

        <section class="panel facts-panel" aria-labelledby="h-facts">
          <h2 id="h-facts" class="panel-title">演奏資訊</h2>
          <dl class="facts">
            <div class="wide"><dt>調弦</dt><dd><b>${esc(tuning.name)}</b>${tuning.name.replace(/\s/g, '') === tuningLetters(tuning.notes).replace(/\s/g, '') ? '' : `<span class="num tuning-letters">${esc(tuningLetters(tuning.notes))}</span>`}
              ${changed.length && s.tuning !== 'standard' ? `<small>${changed.map(c => `${c.string} 弦 ${esc(c.from)} → ${esc(c.to)}`).join('、')}</small>` : ''}
              <a class="btn sm" href="#/tuner?song=${esc(s.id)}">${icon('tune')}用這個調弦開調音器</a></dd></div>
            <div><dt>Capo</dt><dd>${s.capo ? `第 <b class="num">${s.capo}</b> 格` : '不用'}</dd></div>
            <div><dt>速度</dt><dd>${s.bpm ? `♩ = <b class="num">${s.bpm}</b>` : '譜上沒標'}</dd></div>
            ${s.key ? `<div><dt>調性</dt><dd><b class="num">${esc(s.key)}</b></dd></div>` : ''}
            <div><dt>樂譜</dt><dd>${s.pdf ? `<b class="num">${s.pdf.pages}</b> 頁` : '尚未上傳'}</dd></div>
            <div><dt>加入日期</dt><dd>${esc(fmtDate(s.createdAt))}</dd></div>
          </dl>
        </section>

        <section class="panel" aria-labelledby="h-metro">
          <h2 id="h-metro" class="panel-title">節拍器</h2>
          ${metronomeHTML(s.bpm || 80)}
          <p class="hint">${s.bpm ? `已帶入譜上的速度。先用慢一點的速度練熟，再慢慢加回 ${s.bpm}。` : '譜上沒有標速度，先從 80 開始試。'}</p>
        </section>

        <section class="panel mine-panel" aria-labelledby="h-mine" data-mine></section>

        ${s.notes ? `<section class="panel"><h2 class="panel-title">小齊的練習筆記</h2><p class="notes">${esc(s.notes)}</p></section>` : ''}
        ${s.source && (s.source.name || s.source.url) ? `<p class="source">${icon('file')}樂譜來源：${s.source.url ? `<a href="${esc(s.source.url)}" target="_blank" rel="noopener">${esc(s.source.name || s.source.url)}</a>` : esc(s.source.name)}</p>` : ''}
      </div>
    </div>

    <nav class="wrap prevnext" aria-label="上一首與下一首">
      ${prev ? `<a class="pn" href="#/songs/${esc(prev.id)}"><small>上一首</small><b>${esc(prev.title)}</b></a>` : '<span></span>'}
      ${next ? `<a class="pn next" href="#/songs/${esc(next.id)}"><small>下一首</small><b>${esc(next.title)}</b></a>` : '<span></span>'}
    </nav>`;

  mountVideoPlayer($('.song-video', root), s.videos, fn => onCleanup(fn));
  mountPdfViewer($('.sheet', root), s.pdf ? fileUrl(s.pdf.path) : '', fn => onCleanup(fn));
  mountMetronome(root, s.bpm || 80, fn => onCleanup(fn));
  const eb = $('[data-edit]', root);
  if (eb) eb.addEventListener('click', () => edit('song', { id: s.id }));

  // 鍵盤 ← → 換歌（不在輸入框裡時）
  const onKey = e => {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.querySelector('.modal-back')) return;
    if (e.key === 'ArrowLeft' && prev) location.hash = `#/songs/${prev.id}`;
    if (e.key === 'ArrowRight' && next) location.hash = `#/songs/${next.id}`;
  };
  document.addEventListener('keydown', onKey);
  onCleanup(() => document.removeEventListener('keydown', onKey));

  const mine = $('[data-mine]', root);
  const drawMine = () => {
    if (!S.user) {
      mine.innerHTML = `<h2 id="h-mine" class="panel-title">我的練習</h2>
        <p class="hint">登入後可以標記你自己的進度、收藏這首歌、寫練習筆記，練習時數也會畫成熱度圖。</p>
        <button class="btn abalone" type="button" data-login>${icon('user')}學員登入</button>`;
      $('[data-login]', mine).addEventListener('click', () => openAuthDialog('signin'));
      return;
    }
    const st = songState(s.id) || {};
    const mineLogs = logs().filter(l => (l.songIds || []).includes(s.id));
    const total = mineLogs.reduce((a, l) => a + l.minutes, 0);
    mine.innerHTML = `<h2 id="h-mine" class="panel-title">我的練習</h2>
      <div class="my-status" role="group" aria-label="我的進度">${STATUSES.map(x => `<button class="chip mine-chip" type="button" data-st="${x}" aria-pressed="${st.status === x}">${x}</button>`).join('')}
        <button class="icon-btn sm fav${st.fav ? ' on' : ''}" type="button" data-fav aria-pressed="${!!st.fav}" aria-label="${st.fav ? '取消收藏' : '收藏這首歌'}">${icon(st.fav ? 'heartFill' : 'heart')}</button></div>
      <div class="field"><label for="my-note">我的筆記（只有你看得到）</label><textarea id="my-note" maxlength="2000" placeholder="哪一段卡住、用什麼速度練、下次要注意什麼">${esc(st.note || '')}</textarea><p class="hint" data-saved></p></div>
      <div class="mine-foot"><span class="hint">${mineLogs.length ? `你練過這首 <b class="num">${mineLogs.length}</b> 次，共 <b class="num">${total}</b> 分鐘` : '還沒有這首歌的練習紀錄'}</span>
        <button class="btn sm abalone" type="button" data-log>${icon('plus')}記錄練習</button></div>`;
    $$('[data-st]', mine).forEach(b => b.addEventListener('click', async () => {
      const val = b.getAttribute('aria-pressed') === 'true' ? '' : b.dataset.st;
      try { await setSongState(s.id, { status: val }); toast(val ? `已標記為「${esc(val)}」` : '已清除進度'); } catch (err) { toast(esc(err.message), 'err'); }
    }));
    $('[data-fav]', mine).addEventListener('click', async () => {
      try { await setSongState(s.id, { fav: !st.fav }); } catch (err) { toast(esc(err.message), 'err'); }
    });
    const note = $('#my-note', mine);
    const saved = $('[data-saved]', mine);
    const save = debounce(async () => {
      try { await setSongState(s.id, { note: note.value }); saved.textContent = '已儲存'; } catch (err) { saved.textContent = '儲存失敗：' + err.message; }
    }, 800);
    note.addEventListener('input', () => { saved.textContent = '儲存中…'; save(); });
    $('[data-log]', mine).addEventListener('click', () => openLogDialog({ songId: s.id }));
  };
  drawMine();
  // 進度變了只重畫自己的區塊；正在打字時不要把筆記蓋掉
  onCleanup(on('progress', () => { if (document.activeElement && document.activeElement.id === 'my-note') return; drawMine(); }));
}
