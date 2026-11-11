// 內容檢查：npm run check 與管理模式「發布前檢查」共用。
// 回傳 { errors, warnings }；有任何 error 就不該發布。
import { SLUG_RE, DATE_RE, LINK_RE, STATUSES, TECHNIQUE_GROUPS, ARTICLE_CATEGORIES, SOCIAL_TYPES, GEAR_TYPES } from './schema.js';
import { TUNINGS, TUNING_IDS, noteToMidi } from './music.js';
import { parseFrontMatter } from './frontmatter.js';
import { parseChordName, chordShapes } from './chords.js';

const isISO = s => typeof s === 'string' && !Number.isNaN(Date.parse(s)) && /^\d{4}-\d{2}-\d{2}T/.test(s);
const isUrl = s => /^https?:\/\/\S+$/i.test(String(s || ''));
const isMedia = s => /^media\/[\w\-./]+$/.test(String(s || ''));

// ctx: { site, songs, playlists, path, chords, docs: [{ type, path, text }], fileExists?(path) => bool }
export function validateContent(ctx) {
  const errors = [];
  const warnings = [];
  const err = (where, msg) => errors.push(`${where}：${msg}`);
  const warn = (where, msg) => warnings.push(`${where}：${msg}`);
  const fileExists = ctx.fileExists || (() => true);
  const checkMedia = (where, p, field) => {
    if (!p) return;
    if (!isMedia(p) && !isUrl(p)) err(where, `${field} 必須是 media/ 底下的路徑或完整網址（現在是「${p}」）`);
    else if (isMedia(p) && !fileExists(p)) err(where, `${field} 指到的檔案不存在：${p}`);
  };

  const songs = (ctx.songs && ctx.songs.songs) || [];
  const playlists = (ctx.playlists && ctx.playlists.playlists) || [];
  const stages = (ctx.path && ctx.path.stages) || [];
  const site = ctx.site || {};
  const docs = (ctx.docs || []).map(d => ({ ...d, ...parseFrontMatter(d.text) }));

  const techSlugs = new Set(docs.filter(d => d.type === 'technique').map(d => d.data.slug));
  const articleSlugs = new Set(docs.filter(d => d.type === 'article').map(d => d.data.slug));
  const songIds = new Set(songs.map(s => s.id));

  const checkLinks = (where, text) => {
    for (const m of String(text || '').matchAll(LINK_RE)) {
      const [, type, target] = m;
      const ok = type === 'song' ? songIds.has(target)
        : type === 'technique' ? techSlugs.has(target)
          : type === 'article' ? articleSlugs.has(target)
            : !!parseChordName(target);
      if (!ok) err(where, `連結 [[${type}:${target}]] 找不到對象`);
    }
  };

  // ---- 歌曲 ----
  const seen = new Set();
  const groups = {};
  songs.forEach((s, i) => {
    const w = `songs.json #${i + 1}（${s.id || s.title || '未命名'}）`;
    if (!s.id || !SLUG_RE.test(s.id)) err(w, 'id 必須是小寫英文、數字與連字號');
    if (seen.has(s.id)) err(w, `id「${s.id}」重複`);
    seen.add(s.id);
    if (!s.title) err(w, '缺少 title');
    if (typeof s.artist !== 'string') err(w, 'artist 必須是字串（不知道就寫 ""）');
    if (!Number.isInteger(s.difficulty) || s.difficulty < 1 || s.difficulty > 5) err(w, 'difficulty 必須是 1–5 的整數');
    if (!STATUSES.includes(s.status)) err(w, `status 只能是 ${STATUSES.join('、')}`);
    if (!TUNING_IDS.includes(s.tuning)) err(w, `tuning 只能是 ${TUNING_IDS.join('、')}`);
    if (s.tuning === 'custom') {
      if (!Array.isArray(s.tuningNotes) || s.tuningNotes.length !== 6 || s.tuningNotes.some(n => Number.isNaN(noteToMidi(n)))) {
        err(w, 'tuning 為 custom 時，tuningNotes 要有 6 個音名（由 6 弦到 1 弦，例如 "D2"）');
      }
    } else if (s.tuningNotes) warn(w, `tuning 不是 custom，tuningNotes 會被忽略（目前是 ${TUNINGS[s.tuning] ? TUNINGS[s.tuning].name : s.tuning}）`);
    if (!Number.isInteger(s.capo) || s.capo < 0 || s.capo > 12) err(w, 'capo 必須是 0–12 的整數');
    if (s.bpm != null && (!Number.isInteger(s.bpm) || s.bpm < 20 || s.bpm > 300)) err(w, 'bpm 必須是 20–300 的整數或 null');
    if (!Array.isArray(s.techniques)) err(w, 'techniques 必須是陣列');
    else s.techniques.forEach(t => { if (!techSlugs.has(t)) err(w, `techniques 裡的「${t}」沒有對應的技巧頁`); });
    if (!s.highlights || !String(s.highlights).trim()) err(w, '缺少 highlights（技巧重點）');
    checkLinks(w, s.highlights);
    (s.chords || []).forEach(c => {
      const p = parseChordName(c);
      if (!p) err(w, `chords 裡的「${c}」不是看得懂的和弦名稱`);
      else if (!chordShapes(c, (ctx.chords && ctx.chords.chords) || {}).length) warn(w, `和弦「${c}」目前沒有指型，歌曲頁會顯示「尚未收錄」`);
    });
    (s.tags || []).forEach(t => { if (typeof t !== 'string' || !t.trim()) err(w, 'tags 必須是非空字串'); });
    checkMedia(w, s.cover, 'cover');
    if (s.pdf) {
      checkMedia(w, s.pdf.path, 'pdf.path');
      if (!Number.isInteger(s.pdf.pages) || s.pdf.pages < 1) err(w, 'pdf.pages 必須是正整數');
      if (s.pdf.totalPages != null && s.pdf.totalPages < s.pdf.pages) err(w, 'pdf.totalPages 不能小於 pages');
    }
    (s.videos || []).forEach((v, k) => {
      if (!v || !v.url) err(w, `videos 第 ${k + 1} 支缺少 url`);
      else if (!isUrl(v.url) && !isMedia(v.url)) err(w, `videos 第 ${k + 1} 支的 url 格式不對`);
      else if (isMedia(v.url)) checkMedia(w, v.url, `videos 第 ${k + 1} 支`);
    });
    if (s.source && s.source.url && !isUrl(s.source.url)) err(w, 'source.url 必須是 http(s) 網址');
    if (!isISO(s.createdAt)) err(w, 'createdAt 必須是 ISO 時間');
    if (!isISO(s.updatedAt)) err(w, 'updatedAt 必須是 ISO 時間');
    if (s.group) {
      if (!SLUG_RE.test(s.group)) err(w, 'group 必須是 slug 格式');
      (groups[s.group] = groups[s.group] || []).push(s);
    }
  });
  for (const [g, list] of Object.entries(groups)) {
    if (list.length < 2) warn(`group「${g}」`, '只有一首歌，不需要 group');
    list.forEach(s => { if (!s.version) err(`songs.json（${s.id}）`, `有 group「${g}」時必須寫 version（例如「簡單版」）`); });
  }

  // ---- 歌單 ----
  const pids = new Set();
  playlists.forEach((p, i) => {
    const w = `playlists.json #${i + 1}（${p.id || '未命名'}）`;
    if (!p.id || !SLUG_RE.test(p.id)) err(w, 'id 必須是 slug 格式');
    if (pids.has(p.id)) err(w, 'id 重複');
    pids.add(p.id);
    if (!p.title) err(w, '缺少 title');
    if (!Array.isArray(p.songIds) || !p.songIds.length) err(w, 'songIds 至少要有一首歌');
    else p.songIds.forEach(id => { if (!songIds.has(id)) err(w, `songIds 裡的「${id}」不存在`); });
    checkMedia(w, p.cover, 'cover');
  });

  // ---- 學習路徑 ----
  const sids = new Set();
  stages.forEach((st, i) => {
    const w = `path.json 第 ${i + 1} 關（${st.id || '未命名'}）`;
    if (!st.id || !SLUG_RE.test(st.id)) err(w, 'id 必須是 slug 格式');
    if (sids.has(st.id)) err(w, 'id 重複');
    sids.add(st.id);
    if (!st.title) err(w, '缺少 title');
    (st.techniques || []).forEach(t => { if (!techSlugs.has(t)) err(w, `技巧「${t}」不存在`); });
    (st.songs || []).forEach(t => { if (!songIds.has(t)) err(w, `歌曲「${t}」不存在`); });
    (st.articles || []).forEach(t => { if (!articleSlugs.has(t)) err(w, `文章「${t}」不存在`); });
  });

  // ---- 技巧與文章 ----
  const slugSeen = new Set();
  docs.forEach(d => {
    const w = d.path;
    const { data, body } = d;
    const fileSlug = d.path.split('/').pop().replace(/\.md$/, '');
    if (!data.slug || !SLUG_RE.test(data.slug)) err(w, 'front matter 的 slug 必須是 slug 格式');
    if (data.slug !== fileSlug) err(w, `slug「${data.slug}」要和檔名「${fileSlug}」一樣`);
    if (slugSeen.has(d.type + ':' + data.slug)) err(w, 'slug 重複');
    slugSeen.add(d.type + ':' + data.slug);
    if (!data.title) err(w, '缺少 title');
    if (!data.summary) err(w, '缺少 summary');
    else if (String(data.summary).length > 80) warn(w, 'summary 超過 80 字，卡片上會被截斷');
    checkMedia(w, data.cover, 'cover');
    const related = Array.isArray(data.related) ? data.related : [];
    related.forEach(r => { if (!techSlugs.has(r) && !articleSlugs.has(r)) err(w, `related 裡的「${r}」不是存在的技巧或文章`); });
    checkLinks(w, body);
    for (const m of String(body).matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)) checkMedia(w, m[1], '圖片');
    if (d.type === 'technique') {
      if (!TECHNIQUE_GROUPS.includes(data.group)) err(w, `group 只能是 ${TECHNIQUE_GROUPS.join('、')}`);
      if (!Number.isInteger(data.level) || data.level < 1 || data.level > 5) err(w, 'level 必須是 1–5 的整數');
      const heads = [...String(body).matchAll(/^## (.+)$/gm)].map(m => m[1].trim());
      const need = ['是什麼', '怎麼練', '常見錯誤', '在譜上長這樣'];
      if (need.some((h, k) => heads[k] !== h)) err(w, `內文的 ## 段落必須依序是：${need.join('、')}（現在是：${heads.join('、') || '沒有'}）`);
      if (!related.length) warn(w, 'related 至少放一個相關技巧');
    } else {
      if (!ARTICLE_CATEGORIES.includes(data.category)) err(w, `category 只能是 ${ARTICLE_CATEGORIES.join('、')}`);
      if (!DATE_RE.test(String(data.date || ''))) err(w, 'date 必須是 YYYY-MM-DD');
      if ([...String(body).matchAll(/^## /gm)].length < 2) err(w, '內文至少要有兩個 ## 段落');
    }
  });

  // ---- 網站設定 ----
  if (!site.title) err('site.json', '缺少 title');
  if (!site.admin || !site.admin.hash || !site.admin.salt) err('site.json', '缺少 admin 密碼雜湊（不要刪掉這一欄）');
  const prof = site.profile || {};
  checkMedia('site.json profile', prof.photo, 'photo');
  (site.timeline || []).forEach((t, i) => {
    const w = `site.json timeline #${i + 1}`;
    if (!t.title) err(w, '缺少 title');
    if (!/^\d{4}(-\d{2})?$/.test(String(t.date || ''))) err(w, 'date 用 YYYY 或 YYYY-MM');
    checkMedia(w, t.photo, 'photo');
  });
  (site.gear || []).forEach((g, i) => {
    const w = `site.json gear #${i + 1}`;
    if (!g.name) err(w, '缺少 name');
    if (g.type && !GEAR_TYPES.includes(g.type)) warn(w, `type 建議用 ${GEAR_TYPES.join('、')}`);
    checkMedia(w, g.photo, 'photo');
  });
  (site.socials || []).forEach((s, i) => {
    const w = `site.json socials #${i + 1}`;
    if (!SOCIAL_TYPES[s.type]) err(w, `type 只能是 ${Object.keys(SOCIAL_TYPES).join('、')}`);
    if (s.type === 'email' ? !/^[^@\s]+@[^@\s]+$/.test(s.url || '') : !isUrl(s.url)) err(w, 'url 格式不對');
  });

  // ---- 和弦表 ----
  const table = (ctx.chords && ctx.chords.chords) || {};
  for (const [name, shapes] of Object.entries(table)) {
    if (!parseChordName(name)) err('chords.json', `「${name}」不是看得懂的和弦名稱`);
    (shapes || []).forEach((sh, k) => {
      if (!Array.isArray(sh.frets) || sh.frets.length !== 6) err('chords.json', `${name} 第 ${k + 1} 個指型的 frets 要有 6 個數字`);
      if (sh.fingers && (!Array.isArray(sh.fingers) || sh.fingers.length !== 6)) err('chords.json', `${name} 第 ${k + 1} 個指型的 fingers 要有 6 個數字`);
    });
  }

  return { errors, warnings };
}
