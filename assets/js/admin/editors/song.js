// 歌曲編輯器：新增或修改 content/songs.json 的一筆（欄位見 CLAUDE.md 3.2）
import { $, $$, esc, icon } from '../../core/dom.js';
import { ensureDraft, saveDraft, songById, allSongs, techniques, fileUrl } from '../../core/store.js';
import { STATUSES, DIFFICULTY_LABELS, SLUG_RE } from '../../core/schema.js';
import { TUNINGS, TUNING_IDS, noteToMidi } from '../../core/music.js';
import { parseChordName } from '../../core/chords.js';
import { renderMarkdown } from '../../core/markdown.js';
import { modal, toast, confirmBox } from '../../core/ui.js';
import { coverHTML } from '../../components/song-card.js';
import { parseYouTube } from '../../components/video-player.js';
import { pickFile, putFile, cropFromFile, cropFromUrl, youtubeThumb, openCropper, renderPdfPage, parseRange, extractPages, fileSizeText } from '../media.js';

const slugify = t => String(t).normalize('NFKD').toLowerCase().replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);

export async function open({ id } = {}) {
  const orig = id ? songById(id) : null;
  const now = new Date().toISOString();
  const w = orig ? structuredClone(orig) : {
    id: '', title: '', titleZh: '', artist: '', arranger: '', difficulty: 3, status: '想學', tuning: 'standard',
    capo: 0, bpm: null, key: '', tags: [], techniques: [], chords: [], highlights: '', cover: '', pdf: null,
    videos: [{ label: '', url: '' }], source: { name: '', url: '' }, notes: '', createdAt: now, updatedAt: now,
  };
  const pend = { cover: undefined, pdf: undefined, videos: w.videos.map(v => ({ ...v })) };
  if (!pend.videos.length) pend.videos.push({ label: '', url: '' });
  const groups = [...new Set(allSongs().map(s => s.group).filter(Boolean))];

  const m = modal({
    title: orig ? `編輯《${orig.title}》` : '新增歌曲', size: 'wide', dismissible: false,
    body: `<form class="form-grid" data-form novalidate>
      <div class="field half"><label for="sg-title">歌名 *</label><input id="sg-title" name="title" maxlength="80" required></div>
      <div class="field half"><label for="sg-id">網址代號 id *</label><input id="sg-id" name="id" maxlength="48" ${orig ? 'readonly' : ''} placeholder="例：tonghua、like-a-star">
        <p class="hint">${orig ? '既有歌曲的 id 不能改（學員的進度靠它）。' : '小寫英文、數字、連字號；中文歌名用拼音。'}</p></div>
      <div class="field third"><label for="sg-zh">中文譯名</label><input id="sg-zh" name="titleZh" maxlength="60"></div>
      <div class="field third"><label for="sg-artist">原唱／作曲</label><input id="sg-artist" name="artist" maxlength="80"></div>
      <div class="field third"><label for="sg-arr">編曲／採譜</label><input id="sg-arr" name="arranger" maxlength="80"></div>
      <div class="field third"><label for="sg-diff">難度</label><select id="sg-diff" name="difficulty">${[1, 2, 3, 4, 5].map(n => `<option value="${n}">${'●'.repeat(n)}${'○'.repeat(5 - n)}　${DIFFICULTY_LABELS[n]}</option>`).join('')}</select></div>
      <div class="field third"><label for="sg-status">小齊的進度</label><select id="sg-status" name="status">${STATUSES.map(s => `<option>${s}</option>`).join('')}</select></div>
      <div class="field third"><label for="sg-tags">標籤（逗號分隔）</label><input id="sg-tags" name="tags" placeholder="動漫, 華語"></div>
      <div class="field half"><label for="sg-group">版本群組（同一首歌的不同編曲填一樣的代號）</label><input id="sg-group" name="group" list="sg-groups" placeholder="沒有其他版本就留空"><datalist id="sg-groups">${groups.map(g => `<option value="${esc(g)}">`).join('')}</datalist></div>
      <div class="field half"><label for="sg-ver">版本名稱</label><input id="sg-ver" name="version" placeholder="例：簡單版、Sungha Jung 版"></div>

      <h3 class="field editor-sec">演奏資訊</h3>
      <div class="field third"><label for="sg-tuning">調弦</label><select id="sg-tuning" name="tuning">${TUNING_IDS.map(t => `<option value="${t}">${t === 'custom' ? '其他特殊調弦（自己填）' : esc(TUNINGS[t].name)}</option>`).join('')}</select></div>
      <div class="field third"><label for="sg-capo">Capo（格）</label><input id="sg-capo" name="capo" type="number" min="0" max="12" inputmode="numeric"></div>
      <div class="field third"><label for="sg-bpm">速度 BPM</label><input id="sg-bpm" name="bpm" type="number" min="20" max="300" inputmode="numeric" placeholder="譜上沒標就留空"></div>
      <div class="field" data-custom-tuning><label for="sg-tnotes">特殊調弦的音（由 6 弦到 1 弦，空白分隔）</label><input id="sg-tnotes" name="tuningNotes" placeholder="例：C2 G2 D3 G3 A3 D4"></div>
      <div class="field third"><label for="sg-key">調性</label><input id="sg-key" name="key" maxlength="8" placeholder="例：E、C#m"></div>
      <div class="field" style="grid-column:span 4"><label for="sg-chords">這首歌的和弦（逗號分隔，依出現順序）</label><input id="sg-chords" name="chords" placeholder="例：C, G/B, Am7, F"><p class="hint" data-chord-msg></p></div>

      <h3 class="field editor-sec">技巧</h3>
      <div class="field"><span class="label">用到的技巧（技巧頁會自動列出這首歌）</span>
        <div class="checkgrid">${techniques().map(t => `<label class="check"><input type="checkbox" name="techniques" value="${esc(t.slug)}">${esc(t.title)}<span class="muted num">${esc(t.symbol || '')}</span></label>`).join('')}</div></div>
      <div class="field"><label for="sg-hl">技巧重點 *（2–4 條，Markdown 條列）</label>
        <textarea id="sg-hl" name="highlights" rows="5" placeholder="- 前奏：……，見 [[technique:hammer-on]]。"></textarea>
        <p class="hint">用 <code>[[technique:slug]]</code>、<code>[[song:id]]</code>、<code>[[chord:Am7]]</code> 連到其他頁面。<button class="link" type="button" data-preview>預覽</button></p>
        <div class="prose md-preview" data-hl-preview hidden></div></div>

      <h3 class="field editor-sec">封面與樂譜</h3>
      <div class="field"><div class="file-box">
        <div class="thumb-sq" data-cover></div>
        <div class="btn-row">
          <button class="btn sm" type="button" data-cover-file>${icon('image')}上傳照片</button>
          <button class="btn sm" type="button" data-cover-yt>${icon('film')}從影片縮圖</button>
          <button class="btn sm" type="button" data-cover-pdf>${icon('file')}從樂譜第一頁</button>
          <button class="btn sm ghost danger" type="button" data-cover-rm>移除</button>
          <p class="hint" style="flex-basis:100%">選好後可以拖曳、縮放，裁成 720×720 的方形封面。</p>
        </div></div></div>
      <div class="field"><div class="file-box">
        <div class="thumb-pdf" data-pdf-thumb>${icon('file')}</div>
        <div style="flex:1;min-width:220px;display:flex;flex-direction:column;gap:8px">
          <b data-pdf-info>還沒有樂譜</b>
          <div class="btn-row"><button class="btn sm" type="button" data-pdf-file>${icon('upload')}選擇 PDF</button><button class="btn sm ghost danger" type="button" data-pdf-rm>移除</button></div>
          <div class="btn-row"><label class="label" for="sg-range">公開頁面</label><input class="input" id="sg-range" style="width:150px" placeholder="全部，或 1-2"><span class="hint">留空＝整份公開</span></div>
        </div></div></div>

      <h3 class="field editor-sec">影片</h3>
      <div class="field"><div class="rows" data-videos></div>
        <div class="btn-row"><button class="btn sm" type="button" data-v-add>${icon('plus')}再加一支影片</button></div>
        <p class="hint">貼 YouTube 連結會自動變成可以 A-B 循環、慢速播放的播放器；也可以上傳自己錄的影片檔（50MB 以內）。</p></div>

      <h3 class="field editor-sec">其他</h3>
      <div class="field half"><label for="sg-sname">樂譜來源名稱</label><input id="sg-sname" name="sourceName" placeholder="例：探吉日、Musicnotes"></div>
      <div class="field half"><label for="sg-surl">樂譜來源網址</label><input id="sg-surl" name="sourceUrl" type="url" placeholder="https://"></div>
      <div class="field"><label for="sg-notes">小齊的練習筆記</label><textarea id="sg-notes" name="notes" rows="3" placeholder="哪一段卡住、怎麼練、下次要注意什麼"></textarea></div>
    </form>`,
    foot: `${orig ? `<button class="btn danger" type="button" data-del>${icon('trash')}刪除這首歌</button><span class="grow"></span>` : ''}<button class="btn" type="button" data-close>取消</button><button class="btn primary" type="button" data-save>${icon('check')}存成草稿</button>`,
  });
  const el = m.el;
  const f = $('[data-form]', el).elements;
  f.title.value = w.title; f.id.value = w.id; f.titleZh.value = w.titleZh || ''; f.artist.value = w.artist || ''; f.arranger.value = w.arranger || '';
  f.difficulty.value = String(w.difficulty || 3); f.status.value = w.status || '想學'; f.tags.value = (w.tags || []).join(', ');
  f.group.value = w.group || ''; f.version.value = w.version || '';
  f.tuning.value = w.tuning || 'standard'; f.tuningNotes.value = (w.tuningNotes || []).join(' ');
  f.capo.value = w.capo || 0; f.bpm.value = w.bpm || ''; f.key.value = w.key || ''; f.chords.value = (w.chords || []).join(', ');
  $$('input[name=techniques]', el).forEach(c => { c.checked = (w.techniques || []).includes(c.value); });
  f.highlights.value = w.highlights || ''; f.sourceName.value = (w.source && w.source.name) || ''; f.sourceUrl.value = (w.source && w.source.url) || '';
  f.notes.value = w.notes || '';

  if (!orig) f.title.addEventListener('input', () => { if (!f.id.dataset.touched) f.id.value = slugify(f.title.value); });
  f.id.addEventListener('input', () => { f.id.dataset.touched = '1'; });
  const syncTuning = () => { $('[data-custom-tuning]', el).hidden = f.tuning.value !== 'custom'; };
  f.tuning.addEventListener('change', syncTuning);
  syncTuning();
  const chordMsg = $('[data-chord-msg]', el);
  const checkChords = () => {
    const bad = f.chords.value.split(/[,，、]/).map(s => s.trim()).filter(Boolean).filter(c => !parseChordName(c));
    chordMsg.textContent = bad.length ? `看不懂的和弦：${bad.join('、')}` : '';
  };
  f.chords.addEventListener('input', checkChords);
  $('[data-preview]', el).addEventListener('click', async () => {
    const box = $('[data-hl-preview]', el);
    box.hidden = false;
    box.innerHTML = (await renderMarkdown(f.highlights.value)).html;
  });

  // 封面
  const drawCover = () => {
    const box = $('[data-cover]', el);
    if (pend.cover instanceof Blob) box.innerHTML = `<img src="${URL.createObjectURL(pend.cover)}" alt="封面預覽">`;
    else box.innerHTML = coverHTML({ title: f.title.value || '♪', cover: pend.cover === null ? '' : w.cover });
  };
  drawCover();
  const setCover = b => { if (b) { pend.cover = b; drawCover(); } };
  $('[data-cover-file]', el).addEventListener('click', async () => setCover(await cropFromFile({ title: '裁切封面' })));
  $('[data-cover-yt]', el).addEventListener('click', async () => {
    syncVideos();
    const yt = pend.videos.map(v => !v.file && parseYouTube(v.url || '')).find(Boolean);
    if (!yt) { toast('請先在「影片」貼上一個 YouTube 連結', 'warn'); return; }
    setCover(await openCropper(await youtubeThumb(yt.id), { title: '裁切封面' }));
  });
  $('[data-cover-pdf]', el).addEventListener('click', async () => {
    const src = pend.pdf ? await pend.pdf.blob.arrayBuffer() : pend.pdf !== null && w.pdf ? fileUrl(w.pdf.path) : null;
    if (!src) { toast('請先選擇樂譜 PDF', 'warn'); return; }
    const { canvas } = await renderPdfPage(src, 1, 1400);
    const url = await new Promise(r => canvas.toBlob(b => r(URL.createObjectURL(b)), 'image/jpeg', 0.92));
    setCover(await cropFromUrl(url, { title: '裁切封面' }));
  });
  $('[data-cover-rm]', el).addEventListener('click', () => { pend.cover = null; drawCover(); });

  // 樂譜
  const drawPdf = async () => {
    const info = $('[data-pdf-info]', el), th = $('[data-pdf-thumb]', el);
    if (pend.pdf === null || (!pend.pdf && !w.pdf)) { info.textContent = pend.pdf === null ? '已移除（存檔後生效）' : '還沒有樂譜'; th.innerHTML = icon('file'); return; }
    let src;
    if (pend.pdf) { info.textContent = `${pend.pdf.name}（${pend.pdf.total} 頁，${fileSizeText(pend.pdf.blob.size)}）`; src = await pend.pdf.blob.arrayBuffer(); }
    else { info.textContent = `目前的樂譜：${w.pdf.pages} 頁${w.pdf.preview ? `（原本 ${w.pdf.totalPages} 頁，只公開部分）` : ''}`; src = fileUrl(w.pdf.path); }
    try { th.replaceChildren((await renderPdfPage(src, 1, 160)).canvas); } catch { th.innerHTML = icon('file'); }
  };
  drawPdf();
  $('[data-pdf-file]', el).addEventListener('click', async () => {
    const file = await pickFile('application/pdf,.pdf');
    if (!file) return;
    if (file.size > 45 * 1024 * 1024) { toast('PDF 太大了（上限 45MB）', 'err'); return; }
    try {
      const { total } = await renderPdfPage(await file.arrayBuffer(), 1, 40);
      pend.pdf = { blob: file, name: file.name, total };
      drawPdf();
    } catch (err) { toast('讀不到這個 PDF：' + esc(err.message), 'err'); }
  });
  $('[data-pdf-rm]', el).addEventListener('click', () => { pend.pdf = null; drawPdf(); });

  // 影片
  const vbox = $('[data-videos]', el);
  const drawVideos = () => {
    vbox.innerHTML = pend.videos.map((v, i) => `<div class="row-item" data-i="${i}">
      <input class="input v-label" placeholder="標籤，例：參考演奏：Sungha Jung" value="${esc(v.label || '')}" aria-label="影片標籤">
      <input class="input v-url" placeholder="https://www.youtube.com/watch?v=…" value="${esc(v.file ? '已選擇檔案：' + v.file.name : v.url || '')}" ${v.file ? 'readonly' : ''} aria-label="影片網址">
      <div class="row-tools"><button class="icon-btn sm" type="button" data-v-file title="上傳影片檔" aria-label="上傳影片檔">${icon('upload')}</button><button class="icon-btn sm" type="button" data-v-rm title="移除這支影片" aria-label="移除這支影片">${icon('x')}</button></div>
    </div>`).join('') || '<p class="hint">還沒有影片。</p>';
  };
  const syncVideos = () => {
    $$('.row-item', vbox).forEach(r => {
      const v = pend.videos[Number(r.dataset.i)];
      v.label = $('.v-label', r).value;
      if (!v.file) v.url = $('.v-url', r).value.trim();
    });
  };
  drawVideos();
  vbox.addEventListener('click', async e => {
    const row = e.target.closest('.row-item');
    if (!row) return;
    syncVideos();
    const v = pend.videos[Number(row.dataset.i)];
    if (e.target.closest('[data-v-rm]')) { pend.videos.splice(Number(row.dataset.i), 1); drawVideos(); }
    if (e.target.closest('[data-v-file]')) {
      const file = await pickFile('video/*');
      if (!file) return;
      if (file.size > 50 * 1024 * 1024) { toast('影片超過 50MB，請改用 YouTube 連結', 'err'); return; }
      v.file = file; v.url = '';
      if (!v.label) v.label = '我的練習影片';
      drawVideos();
    }
  });
  $('[data-v-add]', el).addEventListener('click', () => { syncVideos(); pend.videos.push({ label: '', url: '' }); drawVideos(); });

  if (orig) $('[data-del]', el).addEventListener('click', async () => { if (await deleteSong(orig.id)) m.close(); });

  $('[data-save]', el).addEventListener('click', async e => {
    syncVideos();
    const btn = e.currentTarget;
    const fail = (msg, field) => { toast(esc(msg), 'err', 5000); if (field) field.focus(); };
    const title = f.title.value.trim();
    const sid = orig ? orig.id : f.id.value.trim();
    if (!title) return fail('請填歌名', f.title);
    if (!SLUG_RE.test(sid)) return fail('網址代號只能用小寫英文、數字和連字號', f.id);
    if (!orig && songById(sid)) return fail(`已經有一首歌的代號是「${sid}」`, f.id);
    if (!f.highlights.value.trim()) return fail('請寫技巧重點（2–4 條）', f.highlights);
    const group = f.group.value.trim();
    if (group && !SLUG_RE.test(group)) return fail('版本群組只能用小寫英文、數字和連字號', f.group);
    if (group && !f.version.value.trim()) return fail('有版本群組時要填版本名稱', f.version);
    let tuningNotes;
    if (f.tuning.value === 'custom') {
      tuningNotes = f.tuningNotes.value.trim().split(/\s+/);
      if (tuningNotes.length !== 6 || tuningNotes.some(n => Number.isNaN(noteToMidi(n)))) return fail('特殊調弦要填 6 個音名，例如 C2 G2 D3 G3 A3 D4', f.tuningNotes);
    }
    const chords = f.chords.value.split(/[,，、]/).map(s => s.trim()).filter(Boolean);
    if (chords.some(c => !parseChordName(c))) return fail('有看不懂的和弦名稱', f.chords);
    for (const v of pend.videos) if (!v.file && v.url && !parseYouTube(v.url) && !/^https?:\/\//i.test(v.url) && !/^media\//.test(v.url)) return fail(`影片網址看不懂：${v.url}`);
    const surl = f.sourceUrl.value.trim();
    if (surl && !/^https?:\/\//i.test(surl)) return fail('樂譜來源網址要用 http:// 或 https:// 開頭', f.sourceUrl);
    let idxs = null;
    try { if (pend.pdf) idxs = parseRange($('#sg-range', el).value, pend.pdf.total); } catch (err) { return fail(err.message, $('#sg-range', el)); }

    btn.disabled = true;
    try {
      const s = {
        ...w, id: sid, title, titleZh: f.titleZh.value.trim(), artist: f.artist.value.trim(), arranger: f.arranger.value.trim(),
        difficulty: Number(f.difficulty.value), status: f.status.value,
        tuning: f.tuning.value, capo: Math.max(0, Math.min(12, parseInt(f.capo.value, 10) || 0)),
        bpm: parseInt(f.bpm.value, 10) || null, key: f.key.value.trim(),
        tags: [...new Set(f.tags.value.split(/[,，、]/).map(t => t.trim().replace(/^#/, '')).filter(Boolean))],
        techniques: $$('input[name=techniques]:checked', el).map(c => c.value), chords,
        highlights: f.highlights.value.trim(), source: { name: f.sourceName.value.trim(), url: surl }, notes: f.notes.value.trim(),
        createdAt: (orig && orig.createdAt) || new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      if (group) { s.group = group; s.version = f.version.value.trim(); } else { delete s.group; delete s.version; }
      if (tuningNotes) s.tuningNotes = tuningNotes; else delete s.tuningNotes;
      if (pend.cover === null) s.cover = '';
      else if (pend.cover instanceof Blob) s.cover = putFile('covers', sid, pend.cover, 'jpg');
      if (pend.pdf === null) s.pdf = null;
      else if (pend.pdf) {
        const blob = idxs ? await extractPages(pend.pdf.blob, idxs) : pend.pdf.blob;
        s.pdf = { path: putFile('tabs', sid, blob, 'pdf'), pages: idxs ? idxs.length : pend.pdf.total, totalPages: pend.pdf.total, preview: !!idxs };
      }
      s.videos = pend.videos.filter(v => v.file || v.url).map(v => (v.file
        ? { label: v.label.trim(), url: putFile('videos', sid, v.file, (v.file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4') }
        : { label: v.label.trim(), url: v.url }));
      const d = ensureDraft();
      const list = d.data.songs.songs;
      const i = list.findIndex(x => x.id === sid);
      if (i >= 0) list[i] = s; else list.unshift(s);
      await saveDraft(`${orig ? '修改' : '新增'}歌曲《${title}》`);
      m.close(true);
      toast(`已存成草稿：《${esc(title)}》。按下方「發布到網站」大家才看得到。`, 'ok', 5000);
      if (!orig) location.hash = `#/songs/${sid}`;
    } catch (err) {
      toast('存檔失敗：' + esc(err.message), 'err', 6000);
    } finally { btn.disabled = false; }
  });
}

export async function deleteSong(id) {
  const s = songById(id);
  if (!s) return false;
  const ok = await confirmBox(`確定要刪除《${esc(s.title)}》嗎？<br><span class="hint">也會從歌單和學習路徑移除。發布後網站上就看不到了（GitHub 的歷史紀錄裡還找得回來）。</span>`, { ok: '刪除', danger: true });
  if (!ok) return false;
  const d = ensureDraft();
  d.data.songs.songs = d.data.songs.songs.filter(x => x.id !== id);
  d.data.playlists.playlists.forEach(p => { p.songIds = p.songIds.filter(x => x !== id); });
  d.data.playlists.playlists = d.data.playlists.playlists.filter(p => p.songIds.length);
  d.data.path.stages.forEach(st => { st.songs = st.songs.filter(x => x !== id); });
  await saveDraft(`刪除歌曲《${s.title}》`);
  if (location.hash.startsWith(`#/songs/${id}`)) location.hash = '#/songs';
  toast(`已刪除《${esc(s.title)}》（草稿）`);
  return true;
}

