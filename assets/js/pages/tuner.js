// 調音器：用麥克風偵測音高（自相關法），指針顯示偏高偏低；可切換成歌曲的特殊調弦
import { $, $$, esc, icon } from '../core/dom.js';
import { songById, allSongs } from '../core/store.js';
import { TUNINGS, noteToMidi, midiFreq, freqMidi, midiToName, songTuning, tuningLetters } from '../core/music.js';
import { audio, pluck } from '../core/audio.js';

// 自相關找基頻（ACF2+），回傳 Hz；聲音太小回傳 -1
export function detectPitch(buf, sampleRate) {
  let size = buf.length;
  let rms = 0;
  for (let i = 0; i < size; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / size);
  if (rms < 0.01) return -1;
  let r1 = 0, r2 = size - 1;
  const thres = 0.2;
  for (let i = 0; i < size / 2; i++) if (Math.abs(buf[i]) < thres) { r1 = i; break; }
  for (let i = 1; i < size / 2; i++) if (Math.abs(buf[size - i]) < thres) { r2 = size - i; break; }
  const b = buf.slice(r1, r2);
  size = b.length;
  const c = new Float32Array(size);
  for (let i = 0; i < size; i++) { let s = 0; for (let j = 0; j < size - i; j++) s += b[j] * b[j + i]; c[i] = s; }
  let d = 0;
  while (d < size - 1 && c[d] > c[d + 1]) d++;
  let maxv = -1, maxp = -1;
  for (let i = d; i < size; i++) if (c[i] > maxv) { maxv = c[i]; maxp = i; }
  let t0 = maxp;
  const x1 = c[t0 - 1], x2 = c[t0], x3 = c[t0 + 1];
  const a = (x1 + x3 - 2 * x2) / 2, bb = (x3 - x1) / 2;
  if (a) t0 -= bb / (2 * a);
  return t0 > 0 ? sampleRate / t0 : -1;
}

const gaugeSVG = () => {
  let ticks = '';
  for (let c = -50; c <= 50; c += 10) {
    const ang = (c / 50) * 60 * Math.PI / 180;
    const x1 = 200 + Math.sin(ang) * 150, y1 = 200 - Math.cos(ang) * 150;
    const x2 = 200 + Math.sin(ang) * (c % 50 === 0 || c === 0 ? 128 : 138), y2 = 200 - Math.cos(ang) * (c % 50 === 0 || c === 0 ? 128 : 138);
    ticks += `<line class="scale${c === 0 || Math.abs(c) === 50 ? ' major' : ''}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
  }
  const a = 5 / 50 * 60 * Math.PI / 180;
  return `<svg class="gauge" viewBox="0 0 400 230" role="img" aria-label="音準指針">
    <path class="ok-zone" d="M ${200 - Math.sin(a) * 162} ${200 - Math.cos(a) * 162} A 162 162 0 0 1 ${200 + Math.sin(a) * 162} ${200 - Math.cos(a) * 162}"/>
    ${ticks}<text x="58" y="218">偏低</text><text x="312" y="218">偏高</text>
    <line class="needle" data-needle x1="200" y1="200" x2="200" y2="62"/><circle class="hub" cx="200" cy="200" r="10"/></svg>`;
};

export default async function ({ root, setTitle, query, onCleanup }) {
  setTitle('調音器');
  const song = query.song ? songById(query.song) : null;
  const options = Object.entries(TUNINGS).map(([id, t]) => ({ id, name: t.name, notes: t.notes }));
  let current = song ? { id: 'song', ...songTuning(song), name: `${song.title} 的調弦（${songTuning(song).name}）` } : options.find(o => o.id === (query.tuning || 'standard')) || options[0];
  if (song) options.unshift(current);
  let target = -1; // -1 自動判斷最接近的弦；0–5 指定弦（0 是 6 弦）
  let stream = null, ctx = null, analyser = null, raf = 0, smooth = null;
  const done = new Set();

  root.innerHTML = `
    <section class="wrap page-head"><h1>調音器</h1><p class="lead">允許使用麥克風後，撥一條空弦，指針停在中間的綠色區域就調準了。也可以點下面的弦聽標準音，用耳朵對。</p></section>
    <section class="wrap tuner">
      <div class="gauge-card">
        ${gaugeSVG()}
        <div class="tuner-note num" data-note>—</div>
        <div class="tuner-read num"><span data-freq>— Hz</span><span data-cents>— cents</span></div>
        <p class="tuner-status" data-status>按「開始調音」並允許使用麥克風</p>
        <button class="btn amber" type="button" data-mic>${icon('mic')}開始調音</button>
      </div>
      <div class="tuner-side">
        <div class="field"><label for="tn-sel">調弦</label>
          <select id="tn-sel" data-sel>${options.map(o => `<option value="${esc(o.id)}"${o.id === current.id ? ' selected' : ''}>${esc(o.name)}　${esc(tuningLetters(o.notes))}</option>`).join('')}</select>
          ${song ? `<p class="hint">從〈<a href="#/songs/${esc(song.id)}">${esc(song.title)}</a>〉打開；這首要夾 Capo ${song.capo || 0}。</p>` : `<p class="hint">要彈特殊調弦的歌，可以從歌曲頁的「用這個調弦開調音器」直接帶進來。</p>`}
        </div>
        <div><span class="label">要調哪一條弦（點一下會播放標準音）</span><div class="string-pick" data-strings></div></div>
        <p class="hint">${icon('mic')} 小技巧：往下調比較安全，先把弦鬆到比目標低一點，再慢慢轉緊到剛好。手機請在安靜的地方使用。</p>
        <details class="panel"><summary>其他歌曲的調弦</summary><ul class="related-links" style="list-style:none;padding:0;margin:12px 0 0">${allSongs().filter(s => s.tuning !== 'standard').map(s => `<li><a class="tag" href="#/tuner?song=${esc(s.id)}">${esc(s.title)}</a></li>`).join('')}</ul></details>
      </div>
    </section>`;

  const drawStrings = () => {
    $('[data-strings]', root).innerHTML = current.notes.map((n, i) => `<button type="button" data-str="${i}" aria-pressed="${target === i}" class="${done.has(i) ? 'done' : ''}"><b>${esc(n.replace(/-?\d+$/, ''))}</b><small>${6 - i} 弦</small></button>`).join('');
  };
  drawStrings();
  $('[data-strings]', root).addEventListener('click', e => {
    const b = e.target.closest('[data-str]');
    if (!b) return;
    const i = Number(b.dataset.str);
    target = target === i ? -1 : i;
    audio();
    pluck(midiFreq(noteToMidi(current.notes[i])), 0.5);
    drawStrings();
  });
  $('[data-sel]', root).addEventListener('change', e => {
    current = options.find(o => o.id === e.target.value) || options[0];
    target = -1; done.clear(); drawStrings();
  });

  const needle = $('[data-needle]', root);
  const setNeedle = cents => { needle.style.transform = `rotate(${Math.max(-60, Math.min(60, (cents / 50) * 60))}deg)`; };
  setNeedle(0);
  const status = $('[data-status]', root);

  function loop() {
    const buf = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buf);
    const f = detectPitch(buf, ctx.sampleRate);
    if (f > 50 && f < 1200) {
      const m = freqMidi(f);
      const strMidis = current.notes.map(noteToMidi);
      const idx = target >= 0 ? target : strMidis.reduce((best, sm, i) => (Math.abs(sm - m) < Math.abs(strMidis[best] - m) ? i : best), 0);
      const goal = strMidis[idx];
      let cents = (m - goal) * 100;
      smooth = smooth == null ? cents : smooth * 0.7 + cents * 0.3;
      cents = smooth;
      $('[data-note]', root).innerHTML = `${esc(midiToName(Math.round(m)).replace(/-?\d+$/, ''))}<small>${Math.floor(Math.round(m) / 12) - 1}</small>`;
      $('[data-freq]', root).textContent = `${f.toFixed(1)} Hz`;
      const cEl = $('[data-cents]', root);
      cEl.textContent = `${cents > 0 ? '+' : ''}${cents.toFixed(0)} cents`;
      cEl.classList.toggle('in', Math.abs(cents) <= 5);
      setNeedle(cents);
      const name = `${6 - idx} 弦 ${current.notes[idx].replace(/-?\d+$/, '')}`;
      if (Math.abs(cents) <= 5) { status.textContent = `${name} 準了！`; status.className = 'tuner-status ok'; done.add(idx); }
      else if (Math.abs(cents) > 300) { status.textContent = `${name}：差太多了，${cents > 0 ? '先鬆一些' : '先轉緊一些'}`; status.className = 'tuner-status'; }
      else { status.textContent = `${name}：${cents > 0 ? '偏高，弦鬆一點' : '偏低，弦轉緊一點'}`; status.className = 'tuner-status'; }
    }
    raf = setTimeout(loop, 50); // 每秒約 20 次就夠，手機比較省電
  }

  async function start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { status.textContent = '這個瀏覽器不能使用麥克風（需要 https 網址）。可以點右邊的弦用耳朵對音。'; return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch {
      status.textContent = '沒有取得麥克風權限。請在網址列允許使用麥克風後再按一次，或點右邊的弦用耳朵對音。';
      return;
    }
    ctx = audio();
    const src = ctx.createMediaStreamSource(stream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048; // 最低的 B1 也有兩個以上週期
    src.connect(analyser);
    status.textContent = '撥一條空弦試試看';
    $('[data-mic]', root).innerHTML = `${icon('stop')}停止`;
    loop();
  }
  function stop() {
    clearTimeout(raf);
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null; smooth = null;
    $('[data-mic]', root).innerHTML = `${icon('mic')}開始調音`;
  }
  $('[data-mic]', root).addEventListener('click', () => (stream ? stop() : start()));
  onCleanup(stop);
}
