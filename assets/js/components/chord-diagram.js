// 和弦圖（SVG）：直的是弦（左邊是 6 弦），橫的是琴格
import { esc } from '../core/dom.js';
import { chordShapes } from '../core/chords.js';

export function chordSVG(sh, title = '') {
  const W = 132, H = 168;
  const left = 26, right = 12, top = 34, bottom = 14;
  const gw = W - left - right, gh = H - top - bottom;
  const played = sh.frets.filter(f => f > 0);
  const maxF = played.length ? Math.max(...played) : 0;
  const minF = played.length ? Math.min(...played) : 1;
  const base = maxF <= 5 ? 1 : minF;
  const sx = i => left + i * (gw / 5);
  const fy = f => top + (f - base + 0.5) * (gh / 5);
  let s = `<svg class="chord-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">`;
  for (let r = 0; r <= 5; r++) s += `<line class="cd-fret${r === 0 && base === 1 ? ' nut' : ''}" x1="${left}" x2="${left + gw}" y1="${top + (r * gh) / 5}" y2="${top + (r * gh) / 5}"/>`;
  for (let i = 0; i < 6; i++) s += `<line class="cd-string" x1="${sx(i)}" x2="${sx(i)}" y1="${top}" y2="${top + gh}"/>`;
  if (base > 1) s += `<text class="cd-base" x="${left - 8}" y="${fy(base) + 4}" text-anchor="end">${base}</text>`;
  sh.frets.forEach((f, i) => {
    if (f === -1) s += `<text class="cd-x" x="${sx(i)}" y="${top - 10}" text-anchor="middle">×</text>`;
    else if (f === 0) s += `<circle class="cd-open" cx="${sx(i)}" cy="${top - 14}" r="5"/>`;
  });
  if (sh.barre) {
    const a = 6 - sh.barre.from, b = 6 - sh.barre.to;
    s += `<rect class="cd-barre" x="${sx(a) - 9}" y="${fy(sh.barre.fret) - 9}" width="${sx(b) - sx(a) + 18}" height="18" rx="9"/>`;
  }
  sh.frets.forEach((f, i) => {
    if (f <= 0) return;
    const onBarre = sh.barre && f === sh.barre.fret && i >= 6 - sh.barre.from && i <= 6 - sh.barre.to;
    if (!onBarre) s += `<circle class="cd-dot" cx="${sx(i)}" cy="${fy(f)}" r="9"/>`;
    const fg = sh.fingers && sh.fingers[i];
    if (fg && !onBarre) s += `<text class="cd-finger" x="${sx(i)}" y="${fy(f) + 4}" text-anchor="middle">${fg}</text>`;
  });
  return s + '</svg>';
}

export function chordFigure(name, table, { index = 0 } = {}) {
  const shapes = chordShapes(name, table);
  if (!shapes.length) {
    return `<figure class="chord missing"><div class="chord-missing">尚未收錄</div><figcaption>${esc(name)}</figcaption></figure>`;
  }
  const sh = shapes[Math.min(index, shapes.length - 1)];
  return `<figure class="chord">${chordSVG(sh, name + ' 和弦按法')}<figcaption>${esc(name)}${sh.bassNote ? `<small>低音改彈 ${esc(sh.bassNote)}</small>` : ''}${shapes.length > 1 ? `<small>${shapes.length} 種按法</small>` : ''}</figcaption></figure>`;
}
