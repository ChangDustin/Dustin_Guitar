// 全站狀態：公開內容、站長草稿、目前的學員。頁面只透過這裡的函式讀資料。
import { parseFrontMatter } from './frontmatter.js';
import { entryFromDoc, sortIndex } from './content-index.js';

export const S = {
  pub: null,      // 網站上公開的內容 { site, songs, playlists, path, chords, index }
  draft: null,    // 站長還沒發布的草稿 { data, bodies, files, log, baseRev, publishedRev? }
  admin: false,   // 是否在管理模式
  user: null,     // 登入的學員 { uid, name, email }
  authKind: '',   // 'firebase' 或 'local'（示範模式）
};

// ---- 事件：content（內容變了）、user（登入狀態變了）、progress（學員資料變了）、admin ----
const bus = new EventTarget();
export const emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));
export function on(type, fn) {
  const h = e => fn(e.detail);
  bus.addEventListener(type, h);
  return () => bus.removeEventListener(type, h);
}

const FILES = {
  site: 'content/site.json', songs: 'content/songs.json', playlists: 'content/playlists.json',
  path: 'content/path.json', chords: 'content/chords.json', index: 'content/index.json',
};

export async function loadContent() {
  const bust = '?t=' + Date.now();
  const pairs = await Promise.all(Object.entries(FILES).map(async ([k, p]) => {
    const r = await fetch(p + bust, { cache: 'no-store' });
    if (!r.ok) throw new Error(`${p} 載入失敗（HTTP ${r.status}）`);
    return [k, await r.json()];
  }));
  S.pub = normalize(Object.fromEntries(pairs));
  return S.pub;
}

export function normalize(d) {
  d.site = { title: '小齊吉他', titleEn: '', tagline: '', profile: {}, timeline: [], gear: [], socials: [], ...d.site };
  d.site.profile = { name: '', photo: '', bio: '', location: '', startedYear: null, ...d.site.profile };
  d.songs = { songs: [], ...d.songs };
  d.songs.songs.forEach(s => {
    s.tags ||= []; s.techniques ||= []; s.chords ||= []; s.videos ||= [];
    s.source ||= { name: '', url: '' };
  });
  d.playlists = { playlists: [], ...d.playlists };
  d.path = { stages: [], ...d.path };
  d.chords = { chords: {}, ...d.chords };
  d.index = { techniques: [], articles: [], ...d.index };
  return d;
}

export const cur = () => (S.admin && S.draft ? S.draft.data : S.pub);

// ---- 查詢 ----
export const site = () => cur().site;
export const allSongs = () => cur().songs.songs;
export const songById = id => allSongs().find(s => s.id === id);
export const playlists = () => cur().playlists.playlists;
export const playlistById = id => playlists().find(p => p.id === id);
export const stages = () => cur().path.stages;
export const techniques = () => cur().index.techniques;
export const articles = () => cur().index.articles;
export const techniqueBySlug = slug => techniques().find(t => t.slug === slug);
export const articleBySlug = slug => articles().find(a => a.slug === slug);
export const chordTable = () => cur().chords.chords;
export const byDifficulty = (a, b) => a.difficulty - b.difficulty || String(a.title).localeCompare(String(b.title), 'zh-Hant');
export const songsUsing = slug => allSongs().filter(s => s.techniques.includes(slug)).sort(byDifficulty);
export const versionsOf = song => (song.group ? allSongs().filter(s => s.group === song.group).sort(byDifficulty) : [song]);

// 同一個 group 的版本合併成一張卡：primary 是最簡單的版本
export function groupSongs(list) {
  const out = [];
  const seen = new Map();
  for (const s of list) {
    if (!s.group) { out.push({ key: s.id, primary: s, versions: [s] }); continue; }
    if (seen.has(s.group)) { seen.get(s.group).versions.push(s); continue; }
    const g = { key: s.group, primary: s, versions: [s] };
    seen.set(s.group, g);
    out.push(g);
  }
  for (const g of seen.values()) {
    g.versions.sort(byDifficulty);
    if (!list.includes(g.primary) || g.versions[0] !== g.primary) g.primary = g.versions[0];
  }
  return out;
}

// ---- 檔案網址：草稿裡剛上傳的檔案用 blob URL ----
const blobUrls = new Map();
export function fileUrl(p) {
  if (!p) return '';
  if (/^(https?:|blob:|data:)/i.test(p)) return p;
  const b = S.draft && S.draft.files[p];
  if (b) {
    if (!blobUrls.has(p)) blobUrls.set(p, URL.createObjectURL(b));
    return blobUrls.get(p);
  }
  return p.split('/').map(encodeURIComponent).join('/');
}
function revoke(p) {
  if (blobUrls.has(p)) { URL.revokeObjectURL(blobUrls.get(p)); blobUrls.delete(p); }
}

// ---- 技巧與文章的 Markdown ----
const textCache = new Map();
export async function docText(entry) {
  if (S.admin && S.draft && S.draft.bodies[entry.path] != null) return S.draft.bodies[entry.path];
  if (textCache.has(entry.path)) return textCache.get(entry.path);
  const r = await fetch(fileUrl(entry.path) + '?t=' + Date.now(), { cache: 'no-store' });
  if (!r.ok) throw new Error(`${entry.path} 載入失敗（HTTP ${r.status}）`);
  const text = await r.text();
  textCache.set(entry.path, text);
  return text;
}
export async function docBody(entry) {
  return parseFrontMatter(await docText(entry)).body;
}

// ---- 站長草稿（存在 IndexedDB，重新整理不會不見） ----
const idb = (() => {
  let dbp = null;
  const open = () => dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open('dustin-guitar', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const run = async (mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction('kv', mode);
      const req = fn(t.objectStore('kv'));
      t.oncomplete = () => res(req && req.result);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  };
  return {
    get: k => run('readonly', s => s.get(k)).catch(() => undefined),
    set: (k, v) => run('readwrite', s => s.put(v, k)),
    del: k => run('readwrite', s => s.delete(k)).catch(() => {}),
  };
})();

export async function restoreDraft() {
  const d = await idb.get('draft');
  if (!d || !d.data) return;
  const pubRev = S.pub.site.rev || '';
  if (d.publishedRev && pubRev >= d.publishedRev) { await idb.del('draft'); return; }
  d.data = normalize(d.data);
  d.bodies ||= {}; d.files ||= {}; d.log ||= [];
  S.draft = d;
}

export function ensureDraft() {
  if (!S.draft) S.draft = { data: structuredClone(S.pub), bodies: {}, files: {}, log: [], baseRev: S.pub.site.rev || '' };
  if (S.draft.publishedRev) { S.draft.baseRev = S.draft.publishedRev; delete S.draft.publishedRev; }
  return S.draft;
}

export async function saveDraft(logLine) {
  if (logLine) S.draft.log.push(logLine);
  gcDraftFiles();
  try { await idb.set('draft', S.draft); } catch { emit('toast', { msg: '這個瀏覽器無法暫存草稿，重新整理前請先發布。', type: 'warn' }); }
  emit('content');
}

export async function discardDraft() {
  S.draft = null;
  await idb.del('draft');
  for (const p of [...blobUrls.keys()]) revoke(p);
  emit('content');
}

// 文件（技巧、文章）存成草稿：同步更新草稿裡的目錄
export function putDocInDraft(type, path, text) {
  const d = ensureDraft();
  d.bodies[path] = text;
  const entry = entryFromDoc({ type, path, text });
  const key = type === 'technique' ? 'techniques' : 'articles';
  d.data.index[key] = d.data.index[key].filter(e => e.path !== path).concat(entry);
  d.data.index = sortIndex(d.data.index);
}
export function removeDocFromDraft(type, path) {
  const d = ensureDraft();
  delete d.bodies[path];
  const key = type === 'technique' ? 'techniques' : 'articles';
  d.data.index[key] = d.data.index[key].filter(e => e.path !== path);
}

// 草稿用得到的媒體檔路徑（用來清掉沒在用的上傳檔、決定發布時要刪哪些舊檔）
export function collectPaths(data, bodies = {}) {
  const set = new Set();
  const add = p => { if (p && /^media\//.test(p)) set.add(p); };
  for (const s of data.songs.songs) {
    add(s.cover); add(s.pdf && s.pdf.path);
    for (const v of s.videos || []) add(v.url);
  }
  for (const p of data.playlists.playlists) add(p.cover);
  const st = data.site;
  add(st.profile && st.profile.photo);
  for (const t of st.timeline || []) add(t.photo);
  for (const g of st.gear || []) add(g.photo);
  for (const e of [...data.index.techniques, ...data.index.articles]) add(e.cover);
  for (const text of Object.values(bodies)) for (const m of String(text).matchAll(/\]\((media\/[^)\s]+)\)/g)) add(m[1]);
  return set;
}

export function gcDraftFiles() {
  if (!S.draft) return;
  const used = collectPaths(S.draft.data, S.draft.bodies);
  for (const p of Object.keys(S.draft.files)) {
    if (!used.has(p)) { delete S.draft.files[p]; revoke(p); }
  }
}
