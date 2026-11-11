// 和弦字典：選根音＋種類，或直接輸入和弦名稱；每個和弦都能聽（模擬刷一下）
import { $, $$, esc, icon } from '../core/dom.js';
import { chordTable } from '../core/store.js';
import { ROOTS, QUALITIES, parseChordName, chordShapes, isKnownQuality } from '../core/chords.js';
import { chordSVG } from '../components/chord-diagram.js';
import { TUNINGS, noteToMidi, midiFreq } from '../core/music.js';
import { pluck } from '../core/audio.js';
import { emptyHTML } from '../core/ui.js';

const OPEN = TUNINGS.standard.notes.map(noteToMidi); // 6 弦到 1 弦
const FLAT = { 'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb' };
const state = { root: '', quality: null, q: '' };

function strum(frets) {
  frets.forEach((f, i) => { if (f >= 0) setTimeout(() => pluck(midiFreq(OPEN[i] + f), 0.3), i * 28); });
}

function card(name) {
  const shapes = chordShapes(name, chordTable());
  const p = parseChordName(name);
  const q = p ? QUALITIES.find(x => x.id === p.quality) : null;
  if (!shapes.length) return `<div class="chord-card"><div class="chord-missing">尚未收錄</div><b class="num">${esc(name)}</b></div>`;
  return `<div class="chord-card" data-chord="${esc(name)}">
    <div data-svg>${chordSVG(shapes[0], name + ' 和弦按法')}</div>
    <b class="num chord-name">${esc(name)}</b>${q ? `<span class="q-label">${esc(q.label)}</span>` : ''}
    ${shapes.length > 1 ? `<div class="shape-pick" role="group" aria-label="${esc(name)} 的不同按法">${shapes.map((_, i) => `<button type="button" data-shape="${i}" aria-pressed="${!i}" aria-label="第 ${i + 1} 種按法">${i + 1}</button>`).join('')}</div>` : ''}
    <button class="btn sm play" type="button" data-play="0">${icon('vol')}聽聽看</button>
  </div>`;
}

export default async function ({ root, setTitle, query }) {
  setTitle('和弦字典');
  // 網址帶 ?q= 就直接查那個和弦；沒帶就回到「常用和弦」，避免上次的搜尋殘留
  state.q = query.q || '';
  if (query.q) { state.root = ''; state.quality = null; }
  const common = Object.keys(chordTable());
  root.innerHTML = `
    <section class="wrap page-head"><h1>和弦字典</h1><p class="lead">選根音和種類，或直接輸入和弦名稱（例如 F#m7、Cadd9、D/F#）。開放和弦之外的指型是用封閉和弦的 E 型、A 型推算出來的。</p></section>
    <section class="wrap">
      <div class="chord-tools">
        <label class="search-box">${icon('search')}<input type="search" data-q placeholder="輸入和弦名稱，例如 Am7" value="${esc(state.q)}" aria-label="輸入和弦名稱"></label>
        <div class="root-pick" role="group" aria-label="根音">${ROOTS.map(r => `<button class="chip" type="button" data-root="${r}" aria-pressed="${state.root === r}">${r}${FLAT[r] ? `<span class="visually-hidden">／${FLAT[r]}</span>` : ''}</button>`).join('')}</div>
        <div class="quality-pick" role="group" aria-label="和弦種類">${QUALITIES.map(q => `<button class="chip" type="button" data-quality="${esc(q.id)}" aria-pressed="${state.quality === q.id}">${esc(q.label)}<span class="num">${esc(q.id || '')}</span></button>`).join('')}</div>
      </div>
      <h2 class="visually-hidden">結果</h2>
      <div data-result></div>
    </section>`;

  const draw = () => {
    const box = $('[data-result]', root);
    let names = [];
    let title = '';
    const q = state.q.trim();
    if (q) {
      const p = parseChordName(q);
      if (!p) { box.innerHTML = emptyHTML(`看不懂「${q}」`, '和弦名稱的寫法像這樣：C、Cm、C7、Cmaj7、Cm7、Csus4、Cadd9、Cdim、C/E。'); return; }
      names = [p.name];
      title = isKnownQuality(p.quality) || p.bass ? '' : '這種和弦的指型還沒收錄';
    } else if (state.root && state.quality != null) {
      names = [state.root + state.quality];
    } else if (state.root) {
      names = QUALITIES.map(x => state.root + x.id);
      title = `${state.root} 開頭的和弦`;
    } else if (state.quality != null) {
      names = ROOTS.map(r => r + state.quality);
      title = `所有的${QUALITIES.find(x => x.id === state.quality).label}`;
    } else {
      names = common;
      title = '常用的開放和弦';
    }
    box.innerHTML = `${title ? `<p class="result-count">${esc(title)}（${names.length} 個）</p>` : ''}<div class="chord-grid">${names.map(card).join('')}</div>`;
  };
  draw();

  $('[data-q]', root).addEventListener('input', e => { state.q = e.target.value; draw(); });
  $$('[data-root]', root).forEach(b => b.addEventListener('click', () => {
    state.root = state.root === b.dataset.root ? '' : b.dataset.root;
    state.q = ''; $('[data-q]', root).value = '';
    $$('[data-root]', root).forEach(x => x.setAttribute('aria-pressed', String(x.dataset.root === state.root)));
    draw();
  }));
  $$('[data-quality]', root).forEach(b => b.addEventListener('click', () => {
    state.quality = state.quality === b.dataset.quality ? null : b.dataset.quality;
    state.q = ''; $('[data-q]', root).value = '';
    $$('[data-quality]', root).forEach(x => x.setAttribute('aria-pressed', String(x.dataset.quality === state.quality)));
    draw();
  }));
  // 換按法、聽聽看：事件委派，結果區重畫也不用重綁
  $('[data-result]', root).addEventListener('click', e => {
    const cardEl = e.target.closest('[data-chord]');
    if (!cardEl) return;
    const shapes = chordShapes(cardEl.dataset.chord, chordTable());
    const pick = e.target.closest('[data-shape]');
    if (pick) {
      const i = Number(pick.dataset.shape);
      $('[data-svg]', cardEl).innerHTML = chordSVG(shapes[i], cardEl.dataset.chord);
      $$('[data-shape]', cardEl).forEach(x => x.setAttribute('aria-pressed', String(x === pick)));
      $('[data-play]', cardEl).dataset.play = String(i);
    }
    const play = e.target.closest('[data-play]');
    if (play) strum(shapes[Number(play.dataset.play)].frets);
  });
}
