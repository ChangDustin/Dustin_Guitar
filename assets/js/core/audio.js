// 聲音：撥弦合成（Karplus-Strong）、節拍器的嗒聲。瀏覽器規定要使用者先點過才能出聲。
let ctx = null;
export function audio() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

const cache = new Map();
function ksBuffer(freq) {
  const c = audio();
  const key = Math.round(freq * 10);
  if (cache.has(key)) return cache.get(key);
  const sr = c.sampleRate;
  const len = Math.floor(sr * 2.4);
  const N = Math.max(2, Math.round(sr / freq));
  const buf = c.createBuffer(1, len, sr);
  const out = buf.getChannelData(0);
  const ring = new Float32Array(N);
  for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
  for (let i = 1; i < N; i++) ring[i] = (ring[i] + ring[i - 1]) * 0.5; // 起音不要太刺
  const decay = freq < 140 ? 0.998 : freq < 220 ? 0.997 : 0.995;
  let p = 0;
  for (let i = 0; i < len; i++) {
    const q = (p + 1) % N;
    const v = ring[p];
    out[i] = v;
    ring[p] = decay * 0.5 * (v + ring[q]);
    p = q;
  }
  const fade = Math.floor(sr * 0.25);
  for (let i = 0; i < fade; i++) out[len - 1 - i] *= i / fade;
  cache.set(key, buf);
  return buf;
}

export function pluck(freq, vol = 0.45) {
  const c = audio();
  if (!c) return;
  const src = c.createBufferSource();
  src.buffer = ksBuffer(freq);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 4200;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(lp).connect(g).connect(c.destination);
  src.start();
}

// 節拍器的嗒聲，accent 是每小節第一拍
export function click(time, accent) {
  const c = audio();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.frequency.value = accent ? 1560 : 1040;
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(accent ? 0.55 : 0.3, time + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
  o.connect(g).connect(c.destination);
  o.start(time);
  o.stop(time + 0.08);
}
