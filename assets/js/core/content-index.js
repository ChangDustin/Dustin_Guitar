// 由技巧與文章的 Markdown 產生 content/index.json。
// scripts/build-index.mjs 與管理模式的「發布」共用這支，兩邊產生的結果會一模一樣。
import { parseFrontMatter } from './frontmatter.js';
import { TECHNIQUE_GROUPS } from './schema.js';

const arr = v => (Array.isArray(v) ? v : v ? [String(v)] : []);
const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
const byAscii = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// 中文約每分鐘 400 字；英文單字算 1 字
export function readingMinutes(body) {
  const text = String(body || '').replace(/```[\s\S]*?```/g, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  const cjk = (text.match(/\p{Script=Han}/gu) || []).length;
  const words = (text.replace(/\p{Script=Han}/gu, ' ').match(/[A-Za-z0-9]+/g) || []).length;
  return Math.max(1, Math.round((cjk + words) / 400));
}

// 一篇 Markdown → 目錄裡的一筆
export function entryFromDoc(d) {
  const { data, body } = parseFrontMatter(d.text);
  const base = {
    slug: String(data.slug || ''), title: String(data.title || ''), summary: String(data.summary || ''),
    tags: arr(data.tags), related: arr(data.related), cover: String(data.cover || ''), path: d.path,
    minutes: readingMinutes(body),
  };
  if (d.type === 'technique') {
    return { ...base, symbol: String(data.symbol || ''), group: String(data.group || ''), level: num(data.level), updated: String(data.updated || '') };
  }
  return { ...base, category: String(data.category || ''), date: String(data.date || '') };
}

// 排序規則只用 ASCII 比較，避免 Node 與瀏覽器的中文排序結果不同
export function sortIndex(index) {
  const gi = g => { const i = TECHNIQUE_GROUPS.indexOf(g); return i < 0 ? 99 : i; };
  return {
    note: '自動產生的目錄，請勿手改；改完 Markdown 後執行 npm run index',
    techniques: [...index.techniques].sort((a, b) => gi(a.group) - gi(b.group) || a.level - b.level || byAscii(a.slug, b.slug)),
    articles: [...index.articles].sort((a, b) => byAscii(b.date, a.date) || byAscii(a.slug, b.slug)),
  };
}

// docs: [{ type: 'technique' | 'article', path: 'content/…/x.md', text: '…' }]
export function buildIndex(docs) {
  const techniques = [];
  const articles = [];
  for (const d of docs) (d.type === 'technique' ? techniques : articles).push(entryFromDoc(d));
  return sortIndex({ techniques, articles });
}

export const indexText = index => JSON.stringify(index, null, 2) + '\n';
