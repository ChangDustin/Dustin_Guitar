// 首頁可以彈的吉他指板（琴頸平放，琴枕在左、音孔在右），以及音孔花紋相框。
import { $, esc } from '../core/dom.js';
import { pluck } from '../core/audio.js';
import { TUNINGS, noteToMidi, midiFreq, midiToName } from '../core/music.js';

const FRETS = 12;
const NUT = 5;           // 琴枕左邊留給「空弦」的寬度（%）
const END = 96;          // 第 12 格的位置（%）
export const fretPos = n => NUT + ((1 - Math.pow(2, -n / 12)) / (1 - Math.pow(2, -FRETS / 12))) * (END - NUT);
const strY = i => 14 + i * 14.4;                 // i=0 是 1 弦（最上面）
const OPEN = [...TUNINGS.standard.notes].reverse().map(noteToMidi); // 1 弦到 6 弦
const NAMES = ['e', 'B', 'G', 'D', 'A', 'E'];

export function fretboardHTML() {
  let h = `<div class="neck" data-neck role="group" aria-label="可以彈的吉他指板：點一下弦試聽，開啟聲音後滑過就能刷弦">
    <div class="neck-head" style="width:${NUT}%"></div><div class="neck-nut" style="left:${NUT}%"></div>`;
  for (let n = 1; n <= FRETS; n++) h += `<div class="neck-fret" style="left:${fretPos(n).toFixed(2)}%"></div>`;
  for (const n of [3, 5, 7, 9, 12]) {
    const x = ((fretPos(n - 1) + fretPos(n)) / 2).toFixed(2);
    h += n === 12
      ? `<div class="neck-dot" style="left:${x}%;top:35.6%"></div><div class="neck-dot" style="left:${x}%;top:64.4%"></div>`
      : `<div class="neck-dot" style="left:${x}%;top:50%"></div>`;
  }
  NAMES.forEach((s, i) => { h += `<div class="neck-str${i > 2 ? ' wound' : ''}" data-s="${i}" style="top:${strY(i)}%;--t:${(1 + i * 0.42).toFixed(2)}px"><i></i></div>`; });
  h += `<div class="neck-names" aria-hidden="true">${NAMES.map((s, i) => `<span style="top:${strY(i)}%">${s}</span>`).join('')}</div></div>`;
  return h;
}

export function mountFretboard(root, { onSound } = {}) {
  const neck = $('[data-neck]', root);
  if (!neck) return { setSound() {} };
  let soundOn = false;
  let lastY = null;
  const fretAt = xp => { if (xp < NUT) return 0; for (let n = 1; n <= FRETS; n++) if (xp < fretPos(n)) return n; return FRETS; };
  const near = yp => { let best = -1, dist = 7.2; NAMES.forEach((_, i) => { const d = Math.abs(strY(i) - yp); if (d < dist) { dist = d; best = i; } }); return best; };
  const play = (i, xp, rect, showName) => {
    const el = $(`.neck-str[data-s="${i}"]`, neck);
    el.classList.remove('vib'); void el.offsetWidth; el.classList.add('vib');
    if (!soundOn) return;
    const fret = fretAt(xp);
    const midi = OPEN[i] + fret;
    pluck(midiFreq(midi), 0.42);
    if (showName) {
      const pop = document.createElement('span');
      pop.className = 'neck-pop num';
      pop.textContent = midiToName(midi);
      const x = fret === 0 ? NUT / 2 : (fretPos(fret - 1) + fretPos(fret)) / 2;
      pop.style.left = x + '%';
      pop.style.top = strY(i) + '%';
      neck.appendChild(pop);
      setTimeout(() => pop.remove(), 1000);
    }
  };
  const setSound = on => { soundOn = on; if (onSound) onSound(on); };
  neck.addEventListener('pointerdown', e => {
    if (!soundOn) setSound(true);
    const r = neck.getBoundingClientRect();
    const i = near(((e.clientY - r.top) / r.height) * 100);
    if (i >= 0) play(i, ((e.clientX - r.left) / r.width) * 100, r, true);
    lastY = e.clientY;
  });
  neck.addEventListener('pointermove', e => {
    const r = neck.getBoundingClientRect();
    if (lastY == null) { lastY = e.clientY; return; }
    const y0 = Math.min(lastY, e.clientY), y1 = Math.max(lastY, e.clientY);
    const xp = ((e.clientX - r.left) / r.width) * 100;
    NAMES.forEach((_, i) => {
      const ys = r.top + (strY(i) / 100) * r.height;
      if (ys > y0 && ys <= y1) play(i, xp, r, e.pointerType !== 'mouse' || e.buttons > 0);
    });
    lastY = e.clientY;
  });
  neck.addEventListener('pointerleave', () => { lastY = null; });
  // 首頁唯一的開場動作：六條弦依序輕輕震一下，像刷了一個和弦
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    NAMES.forEach((_, i) => setTimeout(() => {
      const el = $(`.neck-str[data-s="${5 - i}"]`, neck);
      if (el) { el.classList.remove('vib'); void el.offsetWidth; el.classList.add('vib'); }
    }, 500 + i * 70));
  }
  return { setSound };
}

// 桌機版：六條弦從指板一路延伸、跨過音孔（只在沒有照片時畫，避免擋到臉）
export const overStringsHTML = () => `<div class="over-strings" aria-hidden="true">${NAMES.map((_, i) => `<i class="${i > 2 ? 'wound' : ''}" style="top:${strY(i)}%;--t:${(1 + i * 0.42).toFixed(2)}px"></i>`).join('')}</div>`;

// 音孔花紋相框：有照片就把照片放進音孔，沒有就畫六條弦經過音孔
export function rosetteHTML(photoUrl, alt = '') {
  const rings = `<svg class="rosette-rings" viewBox="0 0 200 200" aria-hidden="true">
      <circle class="rs-binding" cx="100" cy="100" r="97"/>
      <circle class="rs-purfl" cx="100" cy="100" r="90"/>
      <circle class="rs-mosaic" cx="100" cy="100" r="84"/>
      <circle class="rs-mosaic-2" cx="100" cy="100" r="84"/>
      <circle class="rs-purfl" cx="100" cy="100" r="78"/>
      <circle class="rs-inner" cx="100" cy="100" r="74"/>
    </svg>`;
  const hole = photoUrl
    ? `<img src="${esc(photoUrl)}" alt="${esc(alt)}" decoding="async">`
    : `<svg class="rosette-strings" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${[0, 1, 2, 3, 4, 5].map(i => `<line x1="${30 + i * 8}" x2="${30 + i * 8}" y1="0" y2="100" style="stroke-width:${0.5 + i * 0.18}"/>`).join('')}</svg>`;
  return `<div class="rosette${photoUrl ? ' has-photo' : ''}">${rings}<div class="rosette-hole">${hole}</div></div>`;
}
