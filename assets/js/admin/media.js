// 管理模式的媒體工具：選檔、裁切圖片、讀 PDF 頁數與縮圖、擷取部分頁面、把檔案放進草稿
import { $, esc, icon, rand } from '../core/dom.js';
import { openPdf, getPdfLib } from '../core/cdn.js';
import { ensureDraft } from '../core/store.js';
import { modal, toast } from '../core/ui.js';

// 讓使用者選一個檔案（不用在畫面上放 <input type=file>）
export function pickFile(accept) {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => resolve(input.files[0] || null), { once: true });
    input.click();
  });
}

// 放進草稿，回傳 media/ 路徑。亂數後綴避免 GitHub Pages 快取到舊檔
export function putFile(dir, base, blob, ext) {
  const path = `media/${dir}/${base}-${rand(6)}.${ext}`;
  ensureDraft().files[path] = blob;
  return path;
}

// 裁切器：拖曳移動、滑桿／滾輪／雙指縮放，輸出 JPG
// ratio：寬／高；round：預覽成圓形（輸出仍是方形）
export function openCropper(src, { ratio = 1, round = false, outW = 720, title = '裁切圖片' } = {}) {
  return new Promise(resolve => {
    const m = modal({
      title,
      body: `<div class="crop-stage${round ? ' round' : ''}" style="--crop-ratio:${ratio}" data-stage><img alt="" data-img></div>
        <div class="crop-zoom">${icon('minus')}<input type="range" min="0" max="1000" value="0" data-zoom aria-label="縮放">${icon('plus')}</div>
        <p class="hint" style="text-align:center">拖曳移動，滑桿或滾輪縮放；手機可以雙指縮放。</p>`,
      foot: `<button class="btn" type="button" data-close>取消</button><button class="btn primary" type="button" data-ok>${icon('image')}使用這張</button>`,
      onClose: v => resolve(v instanceof Blob ? v : null),
    });
    const stage = $('[data-stage]', m.el), img = $('[data-img]', m.el), zr = $('[data-zoom]', m.el);
    let W = 0, H = 0, iw = 0, ih = 0, sc = 1, min = 1, x = 0, y = 0;
    const clamp = () => { x = Math.min(0, Math.max(W - iw * sc, x)); y = Math.min(0, Math.max(H - ih * sc, y)); };
    const apply = () => { clamp(); img.style.transform = `translate(${x}px, ${y}px) scale(${sc})`; zr.value = Math.round((Math.log(sc / min) / Math.log(4)) * 1000); };
    const zoomAt = (ns, cx, cy) => { ns = Math.min(min * 4, Math.max(min, ns)); x = cx - ((cx - x) * ns) / sc; y = cy - ((cy - y) * ns) / sc; sc = ns; apply(); };
    img.onload = () => {
      iw = img.naturalWidth; ih = img.naturalHeight; W = stage.clientWidth; H = stage.clientHeight;
      img.style.width = iw + 'px'; img.style.height = ih + 'px';
      min = Math.max(W / iw, H / ih); sc = min;
      x = (W - iw * sc) / 2; y = (H - ih * sc) / 2;
      apply();
    };
    img.onerror = () => { toast('圖片讀取失敗，請換一張試試', 'err'); m.close(); };
    img.src = src;
    zr.addEventListener('input', () => zoomAt(min * Math.pow(4, zr.value / 1000), W / 2, H / 2));
    stage.addEventListener('wheel', e => { e.preventDefault(); const r = stage.getBoundingClientRect(); zoomAt(sc * (e.deltaY < 0 ? 1.08 : 1 / 1.08), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    const pts = new Map();
    let pinch = null;
    stage.addEventListener('pointerdown', e => { stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); pinch = null; stage.classList.add('drag'); });
    stage.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      const prev = pts.get(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) { x += e.clientX - prev.x; y += e.clientY - prev.y; apply(); }
      else if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const r = stage.getBoundingClientRect();
        if (pinch) zoomAt((sc * dist) / pinch, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
        pinch = dist;
      }
    });
    const up = e => { pts.delete(e.pointerId); pinch = null; if (!pts.size) stage.classList.remove('drag'); };
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);
    $('[data-ok]', m.el).addEventListener('click', () => {
      if (!iw) return;
      const c = document.createElement('canvas');
      c.width = outW; c.height = Math.round(outW / ratio);
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, -x / sc, -y / sc, W / sc, H / sc, 0, 0, c.width, c.height);
      try { c.toBlob(b => (b ? m.close(b) : toast('裁切失敗，請再試一次', 'err')), 'image/jpeg', 0.86); }
      catch { toast('這張圖片因為跨網域限制不能裁切，請改用「上傳照片」', 'err', 5000); }
    });
  });
}

// 從本機檔案裁切
export async function cropFromFile(opts) {
  const file = await pickFile('image/*');
  if (!file) return null;
  if (!file.type.startsWith('image/')) { toast('請選擇圖片檔', 'err'); return null; }
  const url = URL.createObjectURL(file);
  try { return await openCropper(url, opts); } finally { URL.revokeObjectURL(url); }
}

// YouTube 縮圖（i.ytimg.com 有開放跨網域，可以直接裁）
export function youtubeThumb(id) {
  return new Promise(resolve => {
    const probe = new Image();
    probe.crossOrigin = 'anonymous';
    probe.onload = () => resolve(probe.naturalWidth > 200 ? probe.src : `https://i.ytimg.com/vi/${id}/hqdefault.jpg`);
    probe.onerror = () => resolve(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`);
    probe.src = `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
  });
}
export async function cropFromUrl(url, opts) {
  const blob = await fetch(url).then(r => r.blob()).catch(() => null);
  if (!blob) { toast('圖片下載失敗', 'err'); return null; }
  const obj = URL.createObjectURL(blob);
  try { return await openCropper(obj, opts); } finally { URL.revokeObjectURL(obj); }
}

// PDF：畫出某一頁（給縮圖或封面用）
export async function renderPdfPage(src, pageNo = 1, width = 160) {
  const doc = await openPdf(src);
  try {
    const page = await doc.getPage(pageNo);
    const vp1 = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: width / vp1.width });
    const c = document.createElement('canvas');
    c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    return { canvas: c, total: doc.numPages };
  } finally { doc.destroy(); }
}

// 「公開頁面」：1-2、2,3 → 0 開始的頁碼陣列；全部回傳 null
export function parseRange(str, total) {
  str = String(str || '').trim();
  if (!str || /^(全部|all)$/i.test(str)) return null;
  const out = new Set();
  for (const part of str.split(/[,，、\s]+/)) {
    if (!part) continue;
    const m = part.match(/^(\d+)(?:\s*[-~～–]\s*(\d+))?$/);
    if (!m) throw new Error(`公開頁面看不懂「${part}」，請用 1-2 或 1,3 這種寫法`);
    let a = Number(m[1]), b = m[2] ? Number(m[2]) : a;
    if (a > b) [a, b] = [b, a];
    if (a < 1 || b > total) throw new Error(`公開頁面要在 1–${total} 頁之間`);
    for (let i = a; i <= b; i++) out.add(i - 1);
  }
  if (!out.size || out.size === total) return null;
  return [...out].sort((p, q) => p - q);
}

export async function extractPages(blob, idxs) {
  const { PDFDocument } = await getPdfLib();
  const src = await PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true });
  const out = await PDFDocument.create();
  (await out.copyPages(src, idxs)).forEach(p => out.addPage(p));
  return new Blob([await out.save()], { type: 'application/pdf' });
}

// 文章插圖：不裁切，只把長邊縮到 1600px 以內再轉成 JPG
export async function resizeImage(file, maxSide = 1600) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise(r => c.toBlob(r, 'image/jpeg', 0.82));
  } finally { URL.revokeObjectURL(url); }
}

export const fileSizeText = n => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);
export const escAttr = esc;
