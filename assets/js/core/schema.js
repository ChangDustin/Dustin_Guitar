// 內容格式的「可用值」清單。網站、管理模式與 scripts/check-content.mjs 共用，
// 改這裡就等於改規則，記得同步更新 CLAUDE.md 第 3 節。

export const DIFFICULTY_LABELS = ['', '入門', '初階', '中階', '中進階', '高階']; // 索引 1–5
export const STATUSES = ['想學', '練習中', '已學會'];
export const TECHNIQUE_GROUPS = ['左手', '右手', '和弦', '調弦與移調'];
export const ARTICLE_CATEGORIES = ['新手上路', '技巧教學', '樂理筆記', '練習心得', '器材'];
export const GEAR_TYPES = ['吉他', '弦', 'Capo', '調音器', '配件', '錄音', '其他'];
export const SOCIAL_TYPES = {
  youtube: 'YouTube', instagram: 'Instagram', facebook: 'Facebook', threads: 'Threads',
  tiktok: 'TikTok', website: '個人網站', email: 'Email',
};
export const DOC_TYPES = {
  technique: { dir: 'content/techniques', label: '技巧', route: 'techniques' },
  article: { dir: 'content/articles', label: '文章', route: 'articles' },
};
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const LINK_RE = /\[\[(song|technique|article|chord):([^\]|]+)(?:\|([^\]]+))?\]\]/g;

export const difficultyLabel = n => DIFFICULTY_LABELS[n] || '';
