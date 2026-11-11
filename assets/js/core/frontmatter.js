// Markdown 開頭 front matter（--- 區塊）的讀寫。只支援本專案用到的子集：
// 字串、數字、布林、行內陣列 [a, b]。值可以含 # 與 :（和弦名稱、標題會用到），所以不支援註解。

const QUOTE_NEEDED = /^[\s"'[\]{}>|*&!%@`]|\s$|^(true|false|null)$|^-?\d+(\.\d+)?$|[,[\]]/;

function parseValue(raw) {
  const v = raw.trim();
  if (v === '' || v === '""' || v === "''") return '';
  if (v.startsWith('[') && v.endsWith(']')) {
    const inner = v.slice(1, -1).trim();
    if (!inner) return [];
    const out = [];
    let cur = '', q = null;
    for (const ch of inner) {
      if (q) { if (ch === q) q = null; else cur += ch; continue; }
      if (ch === '"' || ch === "'") { q = ch; continue; }
      if (ch === ',') { out.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    out.push(cur.trim());
    return out.filter(s => s !== '');
  }
  if (v.startsWith('"') && v.endsWith('"')) {
    try { return JSON.parse(v); } catch { return v.slice(1, -1); }
  }
  if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1);
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

export function parseFrontMatter(text) {
  const src = String(text || '').replace(/^\uFEFF/, '');
  const m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(src);
  if (!m) return { data: {}, body: src };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const i = line.indexOf(':');
    if (i < 1) continue;
    data[line.slice(0, i).trim()] = parseValue(line.slice(i + 1));
  }
  return { data, body: src.slice(m[0].length).replace(/^\r?\n/, '') };
}

function fmt(v) {
  if (Array.isArray(v)) return '[' + v.map(x => (QUOTE_NEEDED.test(String(x)) ? JSON.stringify(String(x)) : String(x))).join(', ') + ']';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  const s = String(v ?? '');
  if (s === '') return '""';
  return QUOTE_NEEDED.test(s) ? JSON.stringify(s) : s;
}

// 依照指定順序輸出欄位，未列出的欄位接在後面，讓 AI 與管理模式寫出來的檔案長得一樣
export function stringifyFrontMatter(data, body, order = []) {
  const keys = [...order.filter(k => k in data), ...Object.keys(data).filter(k => !order.includes(k))];
  const head = keys.map(k => `${k}: ${fmt(data[k])}`).join('\n');
  return `---\n${head}\n---\n\n${String(body || '').trim()}\n`;
}

export const TECHNIQUE_ORDER = ['title', 'slug', 'symbol', 'group', 'level', 'summary', 'tags', 'related', 'cover', 'updated'];
export const ARTICLE_ORDER = ['title', 'slug', 'category', 'summary', 'tags', 'related', 'cover', 'date'];
