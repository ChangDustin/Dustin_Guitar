// 影片播放器＋練習控制列：慢速（0.5×／0.75×）與 A-B 段落循環。
// YouTube 用 IFrame API；站內上傳的影片檔用 <video>，兩邊包成同一套介面。
import { $, $$, esc, icon } from '../core/dom.js';
import { getYouTube } from '../core/cdn.js';
import { fileUrl } from '../core/store.js';
import { fmtTime } from '../core/music.js';

export function parseYouTube(u) {
  try {
    const url = new URL(u);
    const h = url.hostname.replace(/^(www|m|music)\./, '');
    let id = '';
    if (h === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
    else if (/(^|\.)youtube(-nocookie)?\.com$/.test(h)) {
      if (url.pathname === '/watch') id = url.searchParams.get('v') || '';
      else { const m = url.pathname.match(/^\/(embed|shorts|live|v)\/([\w-]{11})/); if (m) id = m[2]; }
    }
    if (!/^[\w-]{11}$/.test(id)) return null;
    const t = url.searchParams.get('t') || url.searchParams.get('start') || '';
    const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
    const start = m ? (Number(m[1]) || 0) * 3600 + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0) : 0;
    return { id, start };
  } catch { return null; }
}

export const videoPlayerHTML = videos => `
  <section class="player" aria-label="吉他影片">
    <div class="player-frame" data-frame>${videos.length ? '' : `<div class="player-empty">${icon('film')}<span>這首歌還沒有影片</span></div>`}</div>
    ${videos.length > 1 ? `<div class="vtabs" role="tablist">${videos.map((v, i) => `<button class="chip${i ? '' : ' on'}" type="button" role="tab" aria-selected="${!i}" data-v="${i}">${esc(v.label || '影片 ' + (i + 1))}</button>`).join('')}</div>`
      : videos[0] && videos[0].label ? `<p class="vcap">${esc(videos[0].label)}</p>` : ''}
    ${videos.length ? `<div class="practice-bar" data-bar>
      <div class="speed" role="group" aria-label="播放速度">${[0.5, 0.75, 1].map(r => `<button class="chip${r === 1 ? ' on' : ''}" type="button" data-rate="${r}">${r}×</button>`).join('')}</div>
      <div class="ab" role="group" aria-label="A-B 段落循環">
        <button class="chip" type="button" data-a>設 A 點</button>
        <button class="chip" type="button" data-b>設 B 點</button>
        <button class="chip" type="button" data-clear hidden>${icon('x')}清除</button>
        <span class="ab-state" data-state>挑一段重複練：播到開頭按 A，播到結尾按 B</span>
      </div>
    </div>` : ''}
  </section>`;

export function mountVideoPlayer(root, videos, onCleanup) {
  if (!videos.length) return;
  const frame = $('[data-frame]', root);
  const bar = $('[data-bar]', root);
  let api = null;     // { time(), seek(t), setRate(r), destroy() }
  let A = null, B = null, rate = 1;
  let loopTimer = 0;

  const state = $('[data-state]', bar);
  const renderAB = () => {
    $('[data-clear]', bar).hidden = A == null && B == null;
    $('[data-a]', bar).classList.toggle('on', A != null);
    $('[data-b]', bar).classList.toggle('on', B != null);
    if (A != null && B != null) state.innerHTML = `${icon('repeat')}循環 <b class="num">${fmtTime(A)}</b> 到 <b class="num">${fmtTime(B)}</b>`;
    else if (A != null) state.innerHTML = `A 點 <b class="num">${fmtTime(A)}</b>，播到結尾再按「設 B 點」`;
    else state.textContent = '挑一段重複練：播到開頭按 A，播到結尾按 B';
  };
  const startLoop = () => {
    clearInterval(loopTimer);
    loopTimer = setInterval(() => {
      if (!api || A == null || B == null) return;
      const t = api.time();
      if (t >= B || t < A - 0.5) api.seek(A);
    }, 120);
  };

  async function load(i) {
    if (api) { api.destroy(); api = null; }
    A = B = null; renderAB();
    const v = videos[i];
    const yt = parseYouTube(v.url);
    if (yt) {
      frame.innerHTML = '<div data-yt></div>';
      try {
        const YT = await getYouTube();
        await new Promise(resolve => {
          const p = new YT.Player($('[data-yt]', frame), {
            host: 'https://www.youtube-nocookie.com', videoId: yt.id,
            playerVars: { rel: 0, playsinline: 1, start: yt.start || 0, origin: location.origin },
            events: { onReady: resolve },
          });
          api = {
            time: () => (p.getCurrentTime ? p.getCurrentTime() : 0),
            seek: t => p.seekTo(t, true),
            setRate: r => p.setPlaybackRate && p.setPlaybackRate(r),
            destroy: () => { try { p.destroy(); } catch { /* 已經被移除 */ } },
          };
        });
        if (api) api.setRate(rate);
      } catch {
        frame.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${esc(yt.id)}?rel=0&playsinline=1${yt.start ? '&start=' + yt.start : ''}" title="${esc(v.label || 'YouTube 影片')}" allow="encrypted-media; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
        bar.hidden = true;
      }
    } else {
      frame.innerHTML = `<video src="${esc(fileUrl(v.url))}" controls preload="metadata" playsinline></video>`;
      const el = $('video', frame);
      api = { time: () => el.currentTime, seek: t => { el.currentTime = t; }, setRate: r => { el.playbackRate = r; }, destroy: () => el.pause() };
      api.setRate(rate);
    }
  }

  $$('[data-v]', root).forEach(b => b.addEventListener('click', () => {
    $$('[data-v]', root).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); });
    load(Number(b.dataset.v));
  }));
  $$('[data-rate]', bar).forEach(b => b.addEventListener('click', () => {
    rate = Number(b.dataset.rate);
    $$('[data-rate]', bar).forEach(x => x.classList.toggle('on', x === b));
    if (api) api.setRate(rate);
  }));
  $('[data-a]', bar).addEventListener('click', () => {
    if (!api) return;
    A = api.time();
    if (B != null && B <= A + 0.5) B = null;
    renderAB();
  });
  $('[data-b]', bar).addEventListener('click', () => {
    if (!api) return;
    const t = api.time();
    if (A == null) { A = Math.max(0, t - 5); }
    if (t <= A + 0.5) { state.textContent = 'B 點要比 A 點晚一點喔'; return; }
    B = t;
    renderAB();
    api.seek(A);
    startLoop();
  });
  $('[data-clear]', bar).addEventListener('click', () => { A = B = null; clearInterval(loopTimer); renderAB(); });
  onCleanup(() => { clearInterval(loopTimer); if (api) api.destroy(); });
  load(0);
}
