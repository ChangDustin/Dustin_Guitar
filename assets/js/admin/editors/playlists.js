// 精選歌單編輯器（content/playlists.json，CLAUDE.md 3.3）
import { $, $$, esc, icon } from '../../core/dom.js';
import { playlists, allSongs, ensureDraft, saveDraft } from '../../core/store.js';
import { SLUG_RE } from '../../core/schema.js';
import { modal, toast } from '../../core/ui.js';
import { rowsEditor } from './rows.js';

export async function open({ id = '' } = {}) {
  const list = structuredClone(playlists());
  const songs = [...allSongs()].sort((a, b) => String(a.title).localeCompare(String(b.title), 'zh-Hant'));
  const songName = sid => { const s = songs.find(x => x.id === sid); return s ? s.title + (s.version ? `（${s.version}）` : '') : sid; };

  const m = modal({
    title: '精選歌單', size: 'wide', dismissible: false,
    body: `<p class="hint">首頁會顯示勾了「放首頁」的歌單；歌曲順序就是歌單裡的顯示順序。</p><div data-lists></div><p class="form-error" data-err hidden></p>`,
    foot: `<button class="btn" type="button" data-close>取消</button><button class="btn primary" type="button" data-save>${icon('check')}存成草稿</button>`,
  });
  const el = m.el;
  const ed = rowsEditor($('[data-lists]', el), list, {
    addLabel: '新增歌單',
    blank: () => ({ id: '', title: '', description: '', cover: '', songIds: [], featured: false }),
    render: p => `<div class="form-grid" style="grid-column:span 2">
        <div class="field half"><label>歌單名稱</label><input class="input" data-k="title" value="${esc(p.title)}" maxlength="40"></div>
        <div class="field third"><label>代號 id</label><input class="input" data-k="id" value="${esc(p.id)}" maxlength="40" placeholder="例：anime-and-film"></div>
        <div class="field" style="grid-column:span 1;justify-content:flex-end"><label class="check"><input type="checkbox" data-k="featured" ${p.featured ? 'checked' : ''}>放首頁</label></div>
        <div class="field"><label>說明</label><input class="input" data-k="desc" value="${esc(p.description)}" maxlength="120"></div>
        <div class="field"><span class="label">收錄的歌（${p.songIds.length} 首，依勾選順序）</span>
          <p class="hint" data-order>${p.songIds.map(songName).map(esc).join('、') || '還沒有歌'}</p>
          <div class="checkgrid" style="max-height:160px">${songs.map(s => `<label class="check"><input type="checkbox" data-song value="${esc(s.id)}" ${p.songIds.includes(s.id) ? 'checked' : ''}>${esc(s.title)}${s.version ? `<span class="muted">（${esc(s.version)}）</span>` : ''}</label>`).join('')}</div></div>
      </div>`,
    read: (r, p) => {
      const checked = $$('[data-song]:checked', r).map(c => c.value);
      // 保留原本的順序，新勾的接在後面
      const songIds = [...p.songIds.filter(x => checked.includes(x)), ...checked.filter(x => !p.songIds.includes(x))];
      return { ...p, title: $('[data-k=title]', r).value.trim(), id: $('[data-k=id]', r).value.trim(), description: $('[data-k=desc]', r).value.trim(), featured: $('[data-k=featured]', r).checked, songIds };
    },
    after: box => {
      $$('[data-song]', box).forEach(c => c.addEventListener('change', () => {
        const row = c.closest('.row-item');
        const p = list[Number(row.dataset.i)];
        if (c.checked) { if (!p.songIds.includes(c.value)) p.songIds.push(c.value); } else p.songIds = p.songIds.filter(x => x !== c.value);
        $('[data-order]', row).textContent = p.songIds.map(songName).join('、') || '還沒有歌';
      }));
    },
  });
  if (id) setTimeout(() => { const i = list.findIndex(p => p.id === id); const row = $$('.row-item', el)[i]; if (row) row.scrollIntoView({ block: 'center' }); }, 80);

  $('[data-save]', el).addEventListener('click', async () => {
    ed.sync();
    const err = $('[data-err]', el);
    const fail = msg => { err.hidden = false; err.textContent = msg; };
    const ids = new Set();
    for (const p of list) {
      if (!p.title) return fail('有歌單沒有名稱');
      if (!SLUG_RE.test(p.id)) return fail(`歌單「${p.title}」的代號只能用小寫英文、數字與連字號`);
      if (ids.has(p.id)) return fail(`歌單代號「${p.id}」重複了`);
      ids.add(p.id);
      if (!p.songIds.length) return fail(`歌單「${p.title}」至少要有一首歌`);
    }
    ensureDraft().data.playlists.playlists = list;
    await saveDraft('修改精選歌單');
    m.close(true);
    toast('歌單已存成草稿');
  });
}
