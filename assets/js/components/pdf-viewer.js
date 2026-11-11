// 樂譜 PDF 檢視器：逐頁用 PDF.js 畫出來，只畫捲到附近的頁面；可縮放、全螢幕
import { $, esc, icon } from '../core/dom.js';
import { openPdf } from '../core/cdn.js';

export const pdfViewerHTML = () => `
  <section class="sheet" aria-label="樂譜預覽">
    <div class="sheet-head">
      <h2>樂譜</h2>
      <div class="sheet-tools">
        <span class="pgi num" data-pgi></span>
        <button class="icon-btn sm" type="button" data-zo aria-label="縮小">${icon('minus')}</button>
        <button class="zlabel num" type="button" data-zl title="符合寬度">100%</button>
        <button class="icon-btn sm" type="button" data-zi aria-label="放大">${icon('plus')}</button>
        <button class="icon-btn sm" type="button" data-fs aria-label="全螢幕">${icon('expand')}</button>
      </div>
    </div>
    <div class="sheet-scroll" data-scroller><div class="pages" data-pages></div></div>
  </section>`;

export async function mountPdfViewer(sheet, url, onCleanup) {
  const pagesEl = $('[data-pages]', sheet);
  const scroller = $('[data-scroller]', sheet);
  const msg = html => { pagesEl.style.width = ''; pagesEl.innerHTML = `<div class="sheet-msg">${html}</div>`; };
  if (!url) { msg(`${icon('file')}<span>這首歌還沒有樂譜</span>`); $('.sheet-tools', sheet).hidden = true; return; }
  msg('<span class="spinner" aria-hidden="true"></span><span>樂譜載入中…</span>');

  let alive = true, doc = null, zoom = 1, rt = 0;
  const pages = [];
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const io = new IntersectionObserver(ents => {
    for (const en of ents) {
      const p = pages[Number(en.target.dataset.i)];
      p.visible = en.isIntersecting;
      if (en.isIntersecting) draw(p);
    }
  }, { root: scroller, rootMargin: '900px 0px' });
  const ro = new ResizeObserver(() => layout());
  onCleanup(() => {
    alive = false; io.disconnect(); ro.disconnect();
    pages.forEach(p => p.task && p.task.cancel());
    if (doc) doc.destroy();
    if (document.fullscreenElement === sheet) document.exitFullscreen().catch(() => {});
    document.body.classList.remove('no-scroll');
  });

  async function draw(p) {
    const w = Math.round(p.el.clientWidth * dpr);
    if (!w || Math.abs(w - p.drawnW) < 2) return;
    if (p.task) { p.task.cancel(); p.task = null; }
    let scale = w / p.vp.width;
    const maxPx = 14e6;
    if (p.vp.width * p.vp.height * scale * scale > maxPx) scale = Math.sqrt(maxPx / (p.vp.width * p.vp.height));
    const viewport = p.page.getViewport({ scale });
    const c = document.createElement('canvas');
    c.width = Math.floor(viewport.width);
    c.height = Math.floor(viewport.height);
    const task = p.page.render({ canvasContext: c.getContext('2d'), viewport });
    p.task = task;
    try { await task.promise; } catch { return; }
    if (p.task === task) p.task = null;
    if (!alive) return;
    p.canvas.replaceWith(c);
    p.canvas = c;
    p.drawnW = w;
    p.el.classList.remove('loading');
  }
  function layout() {
    if (!pages.length) return;
    const cs = getComputedStyle(scroller);
    const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const base = Math.min(scroller.clientWidth - pad, 900);
    pagesEl.style.width = Math.round(base * zoom) + 'px';
    $('[data-zl]', sheet).textContent = Math.round(zoom * 100) + '%';
    clearTimeout(rt);
    rt = setTimeout(() => pages.filter(p => p.visible).forEach(draw), 140);
  }
  function setZoom(z) {
    const ratio = (scroller.scrollTop + scroller.clientHeight / 2) / Math.max(1, scroller.scrollHeight);
    zoom = Math.min(3, Math.max(0.5, Math.round(z * 100) / 100));
    layout();
    scroller.scrollTop = ratio * scroller.scrollHeight - scroller.clientHeight / 2;
  }
  const updPage = () => {
    const mid = scroller.scrollTop + scroller.clientHeight * 0.35;
    let n = 1;
    for (const p of pages) if (p.el.offsetTop <= mid) n = Number(p.el.dataset.i) + 1;
    $('[data-pgi]', sheet).textContent = `${n} / ${pages.length} 頁`;
  };

  try {
    doc = await openPdf(url);
    if (!alive) { doc.destroy(); return; }
    pagesEl.innerHTML = '';
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      if (!alive) return;
      const vp = page.getViewport({ scale: 1 });
      const el = document.createElement('div');
      el.className = 'page loading';
      el.dataset.i = i - 1;
      el.style.aspectRatio = `${vp.width} / ${vp.height}`;
      el.innerHTML = `<canvas></canvas><span class="pno num">${i}</span>`;
      pagesEl.appendChild(el);
      pages.push({ page, vp, el, canvas: el.firstChild, drawnW: 0, task: null, visible: false });
      if (i === 1) layout();
      io.observe(el);
    }
    layout();
    updPage();
    ro.observe(scroller);
  } catch (err) {
    if (alive) msg(`${icon('file')}<b>樂譜載入失敗</b><span class="hint">${esc(err.message)}</span>`);
    return;
  }
  scroller.addEventListener('scroll', updPage, { passive: true });
  scroller.addEventListener('wheel', e => { if (e.ctrlKey) { e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)); } }, { passive: false });
  $('[data-zi]', sheet).onclick = () => setZoom(zoom + 0.25);
  $('[data-zo]', sheet).onclick = () => setZoom(zoom - 0.25);
  $('[data-zl]', sheet).onclick = () => setZoom(1);
  $('[data-fs]', sheet).onclick = async () => {
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    if (sheet.classList.contains('pseudo-full')) { sheet.classList.remove('pseudo-full'); document.body.classList.remove('no-scroll'); layout(); return; }
    if (sheet.requestFullscreen) { try { await sheet.requestFullscreen(); return; } catch { /* iPhone 不支援元素全螢幕，改用假全螢幕 */ } }
    sheet.classList.add('pseudo-full');
    document.body.classList.add('no-scroll');
    layout();
  };
}
