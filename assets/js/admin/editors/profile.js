// 品牌資料編輯器：自我介紹與照片、學琴歷程、器材、社群連結（content/site.json，CLAUDE.md 3.7）
import { $, $$, esc, icon, debounce } from '../../core/dom.js';
import { site, ensureDraft, saveDraft, fileUrl } from '../../core/store.js';
import { SOCIAL_TYPES, GEAR_TYPES } from '../../core/schema.js';
import { renderMarkdown } from '../../core/markdown.js';
import { modal, toast } from '../../core/ui.js';
import { cropFromFile, putFile } from '../media.js';
import { rowsEditor } from './rows.js';

const thumb = (blob, path, round) => (blob ? `<img src="${URL.createObjectURL(blob)}" alt="">` : path ? `<img src="${esc(fileUrl(path))}" alt="">` : `<span class="cover-gen" style="--h:30${round ? ';border-radius:50%' : ''}">${icon('image')}</span>`);

export async function open({ focus = '' } = {}) {
  const st = structuredClone(site());
  const prof = { name: '', photo: '', bio: '', location: '', startedYear: null, ...st.profile };
  const timeline = (st.timeline || []).map(t => ({ date: '', title: '', text: '', photo: '', ...t }));
  const gear = (st.gear || []).map(g => ({ name: '', type: '吉他', note: '', photo: '', ...g }));
  const socials = (st.socials || []).map(s => ({ type: 'youtube', url: '', ...s }));
  let photoBlob = null;

  const m = modal({
    title: '品牌資料', size: 'wide', dismissible: false,
    body: `<section class="editor-sec" id="pf-profile"><h3>自我介紹</h3>
        <div class="form-grid">
          <div class="field" style="grid-column:span 2"><span class="label">照片（會放進首頁的音孔框）</span>
            <div class="thumb-sq" style="border-radius:50%" data-photo>${thumb(null, prof.photo, true)}</div>
            <div class="btn-row" style="margin-top:8px"><button class="btn sm" type="button" data-photo-pick>${icon('image')}選照片</button><button class="btn sm ghost danger" type="button" data-photo-rm>移除</button></div></div>
          <div class="field" style="grid-column:span 4"><div class="form-grid">
            <div class="field half"><label for="pf-name">名字</label><input id="pf-name" name="name" maxlength="20"></div>
            <div class="field half"><label for="pf-loc">所在地</label><input id="pf-loc" name="location" maxlength="20" placeholder="例：桃園中壢"></div>
            <div class="field half"><label for="pf-year">哪一年開始彈吉他</label><input id="pf-year" name="startedYear" type="number" min="1950" max="2100" inputmode="numeric"></div>
          </div></div>
          <div class="field"><label for="pf-bio">自我介紹（Markdown，2–4 句就很好）</label>
            <div class="md-split" style="min-height:180px"><textarea class="input" id="pf-bio" name="bio" style="min-height:180px" placeholder="我是誰、為什麼開始彈指彈、這個網站想記錄什麼。"></textarea><div class="prose md-preview" data-bio-preview></div></div></div>
        </div></section>
      <section class="editor-sec" id="pf-timeline"><h3>學琴歷程</h3><p class="hint">一個節點一句話，例如「2024-09　開始上 Yamaha 吉他課」。網站會依日期排序。</p><div data-timeline></div></section>
      <section class="editor-sec" id="pf-gear"><h3>我的器材</h3><div data-gear></div></section>
      <section class="editor-sec" id="pf-socials"><h3>社群連結</h3><div data-socials></div></section>
      <p class="form-error" data-err hidden></p>`,
    foot: `<button class="btn" type="button" data-close>取消</button><button class="btn primary" type="button" data-save>${icon('check')}存成草稿</button>`,
  });
  const el = m.el;
  const q = n => $(`[name=${n}]`, el);
  q('name').value = prof.name || ''; q('location').value = prof.location || ''; q('startedYear').value = prof.startedYear || ''; q('bio').value = prof.bio || '';
  const bioPrev = $('[data-bio-preview]', el);
  const drawBio = debounce(async () => { bioPrev.innerHTML = (await renderMarkdown(q('bio').value || '（預覽）')).html; }, 300);
  q('bio').addEventListener('input', drawBio);
  drawBio();
  $('[data-photo-pick]', el).addEventListener('click', async () => {
    const b = await cropFromFile({ round: true, outW: 900, title: '裁切大頭照' });
    if (b) { photoBlob = b; $('[data-photo]', el).innerHTML = thumb(b); }
  });
  $('[data-photo-rm]', el).addEventListener('click', () => { photoBlob = null; prof.photo = ''; $('[data-photo]', el).innerHTML = thumb(null, '', true); });

  const photoCell = (it, ratio) => `<div class="thumb-sq" style="width:64px;height:64px" data-pic>${thumb(it._blob, it.photo)}</div><button class="btn sm" type="button" data-pic-pick data-ratio="${ratio}">${icon('image')}照片</button>`;
  const bindPics = (box, items) => {
    $$('[data-pic-pick]', box).forEach(b => b.onclick = async () => {
      const row = b.closest('.row-item');
      const it = items[Number(row.dataset.i)];
      const ratio = Number(b.dataset.ratio);
      const blob = await cropFromFile({ ratio, outW: ratio === 1 ? 600 : 960, title: '裁切照片' });
      if (blob) { it._blob = blob; $('[data-pic]', row).innerHTML = thumb(blob); }
    });
  };

  const tl = rowsEditor($('[data-timeline]', el), timeline, {
    blank: () => ({ date: '', title: '', text: '', photo: '' }), addLabel: '新增一個節點',
    render: it => `<div class="form-grid" style="grid-column:span 2">
        <div class="field third"><label>日期（YYYY 或 YYYY-MM）</label><input class="input" data-k="date" value="${esc(it.date)}" placeholder="2024-09"></div>
        <div class="field" style="grid-column:span 4"><label>標題</label><input class="input" data-k="title" value="${esc(it.title)}" maxlength="40"></div>
        <div class="field"><label>補充（選填）</label><input class="input" data-k="text" value="${esc(it.text)}" maxlength="120"></div>
        <div class="field btn-row">${photoCell(it, 1)}</div></div>`,
    read: (r, it) => ({ ...it, date: $('[data-k=date]', r).value.trim(), title: $('[data-k=title]', r).value.trim(), text: $('[data-k=text]', r).value.trim() }),
    after: box => bindPics(box, timeline),
  });
  const gr = rowsEditor($('[data-gear]', el), gear, {
    blank: () => ({ name: '', type: '吉他', note: '', photo: '' }), addLabel: '新增一件器材',
    render: it => `<div class="form-grid" style="grid-column:span 2">
        <div class="field third"><label>種類</label><select class="input" data-k="type">${GEAR_TYPES.map(t => `<option${t === it.type ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="field" style="grid-column:span 4"><label>名稱</label><input class="input" data-k="name" value="${esc(it.name)}" maxlength="60" placeholder="例：Yamaha FG800"></div>
        <div class="field"><label>一句話（選填）</label><input class="input" data-k="note" value="${esc(it.note)}" maxlength="120" placeholder="例：第一把吉他，音色溫暖"></div>
        <div class="field btn-row">${photoCell(it, 4 / 3)}</div></div>`,
    read: (r, it) => ({ ...it, type: $('[data-k=type]', r).value, name: $('[data-k=name]', r).value.trim(), note: $('[data-k=note]', r).value.trim() }),
    after: box => bindPics(box, gear),
  });
  const so = rowsEditor($('[data-socials]', el), socials, {
    blank: () => ({ type: 'youtube', url: '' }), addLabel: '新增社群連結',
    render: it => `<select class="input" data-k="type" aria-label="平台">${Object.entries(SOCIAL_TYPES).map(([k, v]) => `<option value="${k}"${k === it.type ? ' selected' : ''}>${v}</option>`).join('')}</select>
      <input class="input" data-k="url" value="${esc(it.url)}" placeholder="https://… 或 Email" aria-label="網址">`,
    read: (r, it) => ({ ...it, type: $('[data-k=type]', r).value, url: $('[data-k=url]', r).value.trim() }),
  });

  if (focus && focus !== 'all') setTimeout(() => { const sec = $(`#pf-${focus}`, el); if (sec) sec.scrollIntoView({ block: 'start' }); }, 80);

  $('[data-save]', el).addEventListener('click', async () => {
    tl.sync(); gr.sync(); so.sync();
    const err = $('[data-err]', el);
    const fail = msg => { err.hidden = false; err.textContent = msg; err.scrollIntoView({ block: 'nearest' }); };
    for (const t of timeline) {
      if (!t.title) return fail('學琴歷程有一筆沒有標題');
      if (!/^\d{4}(-\d{2})?$/.test(t.date)) return fail(`歷程「${t.title}」的日期要寫成 YYYY 或 YYYY-MM`);
    }
    for (const g of gear) if (!g.name) return fail('器材有一筆沒有名稱');
    for (const s of socials) {
      if (s.type === 'email' ? !/^[^@\s]+@[^@\s]+$/.test(s.url) : !/^https?:\/\/\S+$/.test(s.url)) return fail(`${SOCIAL_TYPES[s.type]} 的網址格式不對`);
    }
    const year = parseInt(q('startedYear').value, 10);
    const d = ensureDraft();
    const ds = d.data.site;
    ds.profile = { name: q('name').value.trim(), photo: photoBlob ? putFile('photos', 'profile', photoBlob, 'jpg') : prof.photo || '', bio: q('bio').value.trim(), location: q('location').value.trim(), startedYear: Number.isFinite(year) ? year : null };
    const clean = (list, dir) => list.map(({ _blob, ...rest }) => ({ ...rest, photo: _blob ? putFile('photos', dir, _blob, 'jpg') : rest.photo || '' }));
    ds.timeline = clean(timeline, 'timeline').sort((a, b) => String(a.date).localeCompare(String(b.date)));
    ds.gear = clean(gear, 'gear');
    ds.socials = socials;
    await saveDraft('修改品牌資料（自我介紹、歷程、器材、社群）');
    m.close(true);
    toast('品牌資料已存成草稿，按「發布到網站」就會公開');
  });
}
