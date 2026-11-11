// 技巧頁／文章編輯器：front matter 表單＋ Markdown 編輯＋即時預覽。
// 存出來的檔案和 AI 依 CLAUDE.md 3.4／3.5 寫的一模一樣（同一個 stringifyFrontMatter）。
import { $, $$, esc, icon, ymd, debounce } from '../../core/dom.js';
import { ensureDraft, saveDraft, techniques, articles, techniqueBySlug, articleBySlug, docText, putDocInDraft, removeDocFromDraft } from '../../core/store.js';
import { TECHNIQUE_GROUPS, ARTICLE_CATEGORIES, DIFFICULTY_LABELS, SLUG_RE, DOC_TYPES } from '../../core/schema.js';
import { parseFrontMatter, stringifyFrontMatter, TECHNIQUE_ORDER, ARTICLE_ORDER } from '../../core/frontmatter.js';
import { renderMarkdown } from '../../core/markdown.js';
import { modal, toast, confirmBox } from '../../core/ui.js';
import { pickFile, putFile, resizeImage } from '../media.js';

const TECH_BODY = `## 是什麼
（2–4 句：聲音聽起來怎樣、原理是什麼）

## 怎麼練
1. （第一步：最慢、最簡單的動作）
2. （第二步）
3. （第三步：搭配節拍器加速）

## 常見錯誤
- （錯在哪：怎麼改）

## 在譜上長這樣
（TAB 上的記號是什麼）`;
const ARTICLE_BODY = `（開場：為什麼寫這篇、讀完會學到什麼）

## 第一段標題

（內容。提到技巧、歌曲、和弦時用 [[technique:hammer-on]]、[[song:summer]]、[[chord:Am7]] 連過去）

## 第二段標題

（內容）`;
const NEED = ['是什麼', '怎麼練', '常見錯誤', '在譜上長這樣'];

export async function open({ type = 'technique', slug = '' } = {}) {
  const isTech = type === 'technique';
  const entry = slug ? (isTech ? techniqueBySlug(slug) : articleBySlug(slug)) : null;
  let data, body;
  if (entry) ({ data, body } = parseFrontMatter(await docText(entry)));
  else {
    data = isTech
      ? { title: '', slug: '', symbol: '', group: TECHNIQUE_GROUPS[0], level: 2, summary: '', tags: [], related: [], cover: '', updated: ymd() }
      : { title: '', slug: '', category: ARTICLE_CATEGORIES[0], summary: '', tags: [], related: [], cover: '', date: ymd() };
    body = isTech ? TECH_BODY : ARTICLE_BODY;
  }
  const others = [...techniques().map(t => ({ ...t, kind: '技巧' })), ...articles().map(a => ({ ...a, kind: '文章' }))].filter(x => x.slug !== slug);
  const label = isTech ? '技巧頁' : '文章';

  const m = modal({
    title: entry ? `編輯${label}《${data.title}》` : `新增${label}`, size: 'full', dismissible: false,
    body: `<form class="form-grid" data-form novalidate>
      <div class="field half"><label for="dc-title">${isTech ? '技巧名稱' : '標題'} *</label><input id="dc-title" name="title" maxlength="60" required></div>
      <div class="field half"><label for="dc-slug">網址代號 slug *</label><input id="dc-slug" name="slug" maxlength="48" ${entry ? 'readonly' : ''} placeholder="例：hammer-on"><p class="hint">${entry ? '既有頁面的 slug 不能改。' : '小寫英文、數字、連字號，也是檔名。'}</p></div>
      ${isTech
        ? `<div class="field third"><label for="dc-symbol">譜上記號</label><input id="dc-symbol" name="symbol" maxlength="12" placeholder="例：H、P.M.、<12>"></div>
           <div class="field third"><label for="dc-group">分類</label><select id="dc-group" name="group">${TECHNIQUE_GROUPS.map(g => `<option>${g}</option>`).join('')}</select></div>
           <div class="field third"><label for="dc-level">建議開始學的難度</label><select id="dc-level" name="level">${[1, 2, 3, 4, 5].map(n => `<option value="${n}">${'●'.repeat(n)}${'○'.repeat(5 - n)}　${DIFFICULTY_LABELS[n]}</option>`).join('')}</select></div>`
        : `<div class="field half"><label for="dc-cat">分類</label><select id="dc-cat" name="category">${ARTICLE_CATEGORIES.map(g => `<option>${g}</option>`).join('')}</select></div>
           <div class="field half"><label for="dc-date">日期</label><input id="dc-date" name="date" type="date"></div>`}
      <div class="field"><label for="dc-sum">一句話摘要 *（60 字內，會顯示在卡片上）</label><input id="dc-sum" name="summary" maxlength="80"></div>
      <div class="field half"><label for="dc-tags">標籤（逗號分隔）</label><input id="dc-tags" name="tags"></div>
      <div class="field half"><span class="label">相關內容（顯示成延伸閱讀）</span><div class="checkgrid" style="max-height:120px">${others.map(o => `<label class="check"><input type="checkbox" name="related" value="${esc(o.slug)}">${esc(o.title)}<span class="muted">${o.kind}</span></label>`).join('')}</div></div>
      <div class="field"><div class="btn-row" style="justify-content:space-between"><span class="label">內文（Markdown）${isTech ? `：## 段落固定是「${NEED.join('、')}」` : '：用 ## 分段，網站會自動做目錄'}</span>
        <button class="btn sm" type="button" data-img>${icon('image')}插入圖片</button></div>
        <div class="md-split"><textarea class="input" name="body" aria-label="內文"></textarea><div class="prose md-preview" data-preview aria-live="polite"></div></div>
        <p class="form-error" data-err hidden></p></div>
    </form>`,
    foot: `${entry ? `<button class="btn danger" type="button" data-del>${icon('trash')}刪除</button><span class="grow"></span>` : ''}<button class="btn" type="button" data-close>取消</button><button class="btn primary" type="button" data-save>${icon('check')}存成草稿</button>`,
  });
  const el = m.el;
  const f = $('[data-form]', el).elements;
  f.title.value = data.title || ''; f.slug.value = data.slug || ''; f.summary.value = data.summary || '';
  f.tags.value = (data.tags || []).join(', ');
  if (isTech) { f.symbol.value = data.symbol || ''; f.group.value = data.group || TECHNIQUE_GROUPS[0]; f.level.value = String(data.level || 2); }
  else { f.category.value = data.category || ARTICLE_CATEGORIES[0]; f.date.value = data.date || ymd(); }
  $$('input[name=related]', el).forEach(c => { c.checked = (data.related || []).includes(c.value); });
  f.body.value = body;

  const preview = $('[data-preview]', el);
  const draw = debounce(async () => { preview.innerHTML = (await renderMarkdown(f.body.value)).html; }, 350);
  f.body.addEventListener('input', draw);
  draw();
  if (!entry) f.title.addEventListener('input', () => {
    if (f.slug.dataset.touched) return;
    f.slug.value = f.title.value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  });
  f.slug.addEventListener('input', () => { f.slug.dataset.touched = '1'; });

  $('[data-img]', el).addEventListener('click', async () => {
    const s = f.slug.value.trim();
    if (!SLUG_RE.test(s)) { toast('請先填好 slug，圖片會用它命名', 'warn'); f.slug.focus(); return; }
    const file = await pickFile('image/*');
    if (!file) return;
    const path = putFile('notes', s, await resizeImage(file), 'jpg');
    const ta = f.body;
    const ins = `\n\n![圖片說明](${path})\n\n`;
    ta.setRangeText(ins, ta.selectionStart, ta.selectionEnd, 'end');
    ta.focus();
    draw();
    toast('已插入圖片，記得把「圖片說明」改成這張圖在講什麼');
  });

  const errBox = $('[data-err]', el);
  if (entry) $('[data-del]', el).addEventListener('click', async () => {
    const ok = await confirmBox(`確定要刪除《${esc(data.title)}》嗎？<br><span class="hint">歌曲與學習路徑裡對它的引用也會一起移除。</span>`, { ok: '刪除', danger: true });
    if (!ok) return;
    const d = ensureDraft();
    removeDocFromDraft(type, entry.path);
    if (isTech) d.data.songs.songs.forEach(s => { s.techniques = s.techniques.filter(t => t !== slug); });
    d.data.path.stages.forEach(st => { st.techniques = (st.techniques || []).filter(t => t !== slug); st.articles = (st.articles || []).filter(t => t !== slug); });
    await saveDraft(`刪除${label}《${data.title}》`);
    m.close();
    location.hash = isTech ? '#/techniques' : '#/articles';
  });

  $('[data-save]', el).addEventListener('click', async () => {
    errBox.hidden = true;
    const fail = msg => { errBox.hidden = false; errBox.textContent = msg; };
    const s = entry ? slug : f.slug.value.trim();
    if (!f.title.value.trim()) return fail('請填標題');
    if (!SLUG_RE.test(s)) return fail('slug 只能用小寫英文、數字與連字號');
    if (!entry && (isTech ? techniqueBySlug(s) : articleBySlug(s))) return fail(`已經有 slug 是「${s}」的${label}`);
    if (!f.summary.value.trim()) return fail('請填一句話摘要');
    const text = f.body.value.trim();
    if (isTech) {
      const heads = [...text.matchAll(/^## (.+)$/gm)].map(x => x[1].trim());
      if (NEED.some((h, k) => heads[k] !== h)) return fail(`內文的 ## 段落要依序是：${NEED.join('、')}（現在是：${heads.join('、') || '沒有'}）`);
    } else if ([...text.matchAll(/^## /gm)].length < 2) return fail('文章至少要有兩個 ## 段落');
    const fm = isTech
      ? { title: f.title.value.trim(), slug: s, symbol: f.symbol.value.trim(), group: f.group.value, level: Number(f.level.value), summary: f.summary.value.trim(), tags: splitTags(f.tags.value), related: checkedRelated(el), cover: data.cover || '', updated: ymd() }
      : { title: f.title.value.trim(), slug: s, category: f.category.value, summary: f.summary.value.trim(), tags: splitTags(f.tags.value), related: checkedRelated(el), cover: data.cover || '', date: f.date.value || ymd() };
    const path = `${DOC_TYPES[type].dir}/${s}.md`;
    putDocInDraft(type, path, stringifyFrontMatter(fm, text, isTech ? TECHNIQUE_ORDER : ARTICLE_ORDER));
    await saveDraft(`${entry ? '修改' : '新增'}${label}《${fm.title}》`);
    m.close(true);
    toast(`已存成草稿：《${esc(fm.title)}》`);
    location.hash = `#/${isTech ? 'techniques' : 'articles'}/${s}`;
  });
}

const splitTags = v => [...new Set(v.split(/[,，、]/).map(t => t.trim()).filter(Boolean))];
const checkedRelated = el => $$('input[name=related]:checked', el).map(c => c.value);
