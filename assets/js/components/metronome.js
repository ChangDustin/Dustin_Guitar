// 節拍器：歌曲頁的小節拍器與工具頁的大節拍器共用
import { $, $$, icon, clamp } from '../core/dom.js';
import { audio, click } from '../core/audio.js';

export const metronomeHTML = (bpm = 80, { big = false } = {}) => `
  <div class="metro${big ? ' big' : ''}" data-metro>
    <div class="metro-row">
      <button class="icon-btn sm num" type="button" data-step="-5" aria-label="慢 5 拍">−5</button>
      <button class="icon-btn sm" type="button" data-step="-1" aria-label="慢 1 拍">${icon('minus')}</button>
      <output class="metro-bpm" aria-live="polite"><b class="num" data-bpm>${bpm}</b><small>BPM</small></output>
      <button class="icon-btn sm" type="button" data-step="1" aria-label="快 1 拍">${icon('plus')}</button>
      <button class="icon-btn sm num" type="button" data-step="5" aria-label="快 5 拍">+5</button>
    </div>
    ${big ? `<input class="metro-range" type="range" min="30" max="240" value="${bpm}" data-range aria-label="速度">` : ''}
    <div class="metro-row">
      <div class="beats" data-beats aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      ${big ? `<select class="input metro-sig" data-sig aria-label="每小節幾拍"><option value="2">2 拍</option><option value="3">3 拍</option><option value="4" selected>4 拍</option><option value="6">6 拍</option></select>
        <button class="btn sm" type="button" data-tap>點這裡打拍子</button>` : ''}
      <button class="btn amber metro-play" type="button" data-play aria-label="開始節拍器">${icon('play')}<span>開始</span></button>
    </div>
  </div>`;

export function mountMetronome(root, bpm0, onCleanup) {
  const el = $('[data-metro]', root);
  if (!el) return;
  let bpm = clamp(Math.round(bpm0) || 80, 30, 240);
  let beatsPerBar = 4, timer = 0, nextT = 0, beat = 0;
  const timeouts = [];
  const out = $('[data-bpm]', el);
  const range = $('[data-range]', el);
  const btn = $('[data-play]', el);
  const drawBeats = () => {
    $('[data-beats]', el).innerHTML = Array.from({ length: beatsPerBar }, () => '<i></i>').join('');
  };
  const set = v => { bpm = clamp(Math.round(v), 30, 240); out.textContent = bpm; if (range) range.value = bpm; };
  const tick = () => {
    const c = audio();
    const lights = $$('[data-beats] i', el);
    while (nextT < c.currentTime + 0.12) {
      const b = beat % beatsPerBar;
      click(nextT, b === 0);
      timeouts.push(setTimeout(() => lights.forEach((l, i) => l.classList.toggle('on', i === b)), Math.max(0, (nextT - c.currentTime) * 1000)));
      if (timeouts.length > 40) timeouts.splice(0, 20);
      nextT += 60 / bpm;
      beat++;
    }
  };
  const stop = () => {
    clearInterval(timer); timer = 0;
    timeouts.forEach(clearTimeout); timeouts.length = 0;
    $$('[data-beats] i', el).forEach(l => l.classList.remove('on'));
    btn.innerHTML = `${icon('play')}<span>開始</span>`;
    btn.setAttribute('aria-label', '開始節拍器');
  };
  btn.addEventListener('click', () => {
    if (timer) { stop(); return; }
    const c = audio();
    if (!c) return;
    nextT = c.currentTime + 0.06; beat = 0;
    timer = setInterval(tick, 25);
    tick();
    btn.innerHTML = `${icon('stop')}<span>停止</span>`;
    btn.setAttribute('aria-label', '停止節拍器');
  });
  $$('[data-step]', el).forEach(b => b.addEventListener('click', () => set(bpm + Number(b.dataset.step))));
  if (range) range.addEventListener('input', () => set(Number(range.value)));
  const sig = $('[data-sig]', el);
  if (sig) sig.addEventListener('change', () => { beatsPerBar = Number(sig.value); beat = 0; drawBeats(); });
  const tap = $('[data-tap]', el);
  if (tap) {
    let taps = [];
    tap.addEventListener('click', () => {
      const now = performance.now();
      taps = taps.filter(t => now - t < 2500).concat(now);
      if (taps.length >= 3) {
        const gaps = taps.slice(1).map((t, i) => t - taps[i]);
        set(60000 / (gaps.reduce((a, b) => a + b, 0) / gaps.length));
      }
    });
  }
  drawBeats();
  onCleanup(stop);
}
