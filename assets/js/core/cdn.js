// 外部函式庫統一在這裡管理（CLAUDE.md 4.4）：只用固定版本，要新增先問站長。
export const CDN = {
  pdfjs: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/',
  pdflib: 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',
  marked: 'https://cdn.jsdelivr.net/npm/marked@12.0.2/lib/marked.esm.js',
  purify: 'https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.es.mjs',
  firebase: 'https://www.gstatic.com/firebasejs/10.14.1/',
  youtube: 'https://www.youtube.com/iframe_api',
};

const loaded = {};
// 網路偶爾會斷一下：失敗時自動重試一次
export function loadScript(src, retry = true) {
  return loaded[src] ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = res;
    s.onerror = () => {
      s.remove();
      delete loaded[src];
      if (retry) loadScript(src, false).then(res, rej);
      else rej(new Error('外部函式庫載入失敗，請檢查網路連線'));
    };
    document.head.appendChild(s);
  });
}

// 給單檔、自己不再 import 別的檔案的 ES module（marked、DOMPurify）。
// 失敗時自動重試一次；有些瀏覽器會記住同一個網址 import 失敗的結果（新版 Chrome 不會），所以重試換個網址最保險。
// Firebase 不能用：它的模組彼此 import，換網址會載入兩份 firebase-app。
export const importCdn = url => import(url).catch(() => import(`${url}?retry=${Date.now()}`));

export async function getPdfjs() {
  if (!window.pdfjsLib) await loadScript(CDN.pdfjs + 'build/pdf.min.js');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = CDN.pdfjs + 'build/pdf.worker.min.js';
  return window.pdfjsLib;
}

export async function openPdf(src) {
  const lib = await getPdfjs();
  const opts = { cMapUrl: CDN.pdfjs + 'cmaps/', cMapPacked: true, standardFontDataUrl: CDN.pdfjs + 'standard_fonts/' };
  if (typeof src === 'string') opts.url = src; else opts.data = src;
  return lib.getDocument(opts).promise;
}

export async function getPdfLib() {
  if (!window.PDFLib) await loadScript(CDN.pdflib);
  return window.PDFLib;
}

// YouTube IFrame API 只載一次；回傳 YT 物件
let ytPromise = null;
export function getYouTube() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  return ytPromise ||= new Promise((res, rej) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (prev) prev(); res(window.YT); };
    loadScript(CDN.youtube).catch(err => { ytPromise = null; rej(err); });
  });
}
