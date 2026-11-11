// 學習路徑編輯器（content/path.json，CLAUDE.md 3.6）：關卡的順序就是學習順序
import { $, $$, esc, icon } from '../../core/dom.js';
import { stages, allSongs, techniques, articles, ensureDraft, saveDraft } from '../../core/store.js';
import { SLUG_RE } from '../../core/schema.js';
import { modal, toast } from '../../core/ui.js';
import { rowsEditor } from './rows.js';

const pick = (name, list, chosen, label) => `<div class="field"><span class="label">${label}</span><div class="checkgrid" style="max-height:130px">${list.map(x => `<label class="check"><input type="checkbox" data-${name} value="${esc(x.value)}" ${chosen.includes(x.value) ? 'checked' : ''}>${esc(x.text)}</label>`).join('')}</div></div>`;

export async function open() {
  const list = structuredClone(stages());
  const songs = [...allSongs()].sort((a, b) => a.difficulty - b.difficulty).map(s => ({ value: s.id, text: `${'●'.repeat(s.difficulty)} ${s.title}${s.version ? `（${s.version}）` : ''}` }));
  const techs = techniques().map(t => ({ value: t.slug, text: t.title }));
  const arts = articles().map(a => ({ value: a.slug, text: a.title }));
  const m = modal({
    title: '學習路徑', size: 'wide', dismissible: false,
    body: `<p class="hint">每關 2–4 個技巧、3–6 首歌；用上下箭頭調整順序。學員的完成度＝這關的歌裡，他標成「已學會」的比例。</p><div data-stages></div><p class="form-error" data-err hidden></p>`,
    foot: `<button class="btn" type="button" data-close>取消</button><button class="btn primary" type="button" data-save>${icon('check')}存成草稿</button>`,
  });
  const el = m.el;
  const ed = rowsEditor($('[data-stages]', el), list, {
    addLabel: '新增一關',
    blank: () => ({ id: '', title: '', goal: '', techniques: [], songs: [], articles: [] }),
    render: (st, i) => `<div class="form-grid" style="grid-column:span 2">
        <div class="field half"><label>第 ${i + 1} 關名稱</label><input class="input" data-k="title" value="${esc(st.title)}" maxlength="30"></div>
        <div class="field half"><label>代號 id</label><input class="input" data-k="id" value="${esc(st.id)}" maxlength="40"></div>
        <div class="field"><label>這關的目標</label><input class="input" data-k="goal" value="${esc(st.goal)}" maxlength="80"></div>
        ${pick('tech', techs, st.techniques || [], '技巧')}
        ${pick('song', songs, st.songs || [], '練習曲')}
        ${pick('art', arts, st.articles || [], '延伸閱讀')}
      </div>`,
    read: (r, st) => ({
      ...st, title: $('[data-k=title]', r).value.trim(), id: $('[data-k=id]', r).value.trim(), goal: $('[data-k=goal]', r).value.trim(),
      techniques: $$('[data-tech]:checked', r).map(c => c.value), songs: $$('[data-song]:checked', r).map(c => c.value), articles: $$('[data-art]:checked', r).map(c => c.value),
    }),
  });
  $('[data-save]', el).addEventListener('click', async () => {
    ed.sync();
    const err = $('[data-err]', el);
    const fail = msg => { err.hidden = false; err.textContent = msg; };
    const ids = new Set();
    for (const st of list) {
      if (!st.title) return fail('有一關沒有名稱');
      if (!SLUG_RE.test(st.id)) return fail(`「${st.title}」的代號只能用小寫英文、數字與連字號`);
      if (ids.has(st.id)) return fail(`代號「${st.id}」重複了`);
      ids.add(st.id);
    }
    ensureDraft().data.path.stages = list;
    await saveDraft('修改學習路徑');
    m.close(true);
    toast('學習路徑已存成草稿');
  });
}
