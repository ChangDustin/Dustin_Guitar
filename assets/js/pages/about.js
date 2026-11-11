// 關於我：自我介紹、學琴歷程、器材、社群連結。
// 內容由站長在管理模式填寫（CLAUDE.md 3.7）；空著的區塊對訪客隱藏，對站長顯示「待填寫」。
import { $$, esc, icon } from '../core/dom.js';
import { S, site, fileUrl } from '../core/store.js';
import { SOCIAL_TYPES } from '../core/schema.js';
import { renderMarkdown } from '../core/markdown.js';
import { rosetteHTML } from '../components/fretboard.js';
import { edit } from '../admin/admin.js';

const placeholder = (title, hint, part) => `<div class="todo-card"><p><b>${esc(title)}</b>${esc(hint)}</p><button class="btn sm amber" type="button" data-edit-brand="${part}">${icon('edit')}填寫</button></div>`;

export function timelineHTML(list) {
  return `<ol class="timeline">${list.map(t => `<li>
    <span class="tl-date num">${esc(String(t.date).replace('-', '.'))}</span>
    <div class="tl-body"><b>${esc(t.title)}</b>${t.text ? `<p>${esc(t.text)}</p>` : ''}</div>
    ${t.photo ? `<img class="tl-photo" src="${esc(fileUrl(t.photo))}" alt="" loading="lazy">` : ''}
  </li>`).join('')}</ol>`;
}
export function gearHTML(list) {
  return `<ul class="gear-grid">${list.map(g => `<li class="gear-card">
    ${g.photo ? `<img src="${esc(fileUrl(g.photo))}" alt="" loading="lazy">` : `<span class="gear-ph" aria-hidden="true">${icon('note')}</span>`}
    <span class="gear-type">${esc(g.type || '')}</span><b>${esc(g.name)}</b>${g.note ? `<p>${esc(g.note)}</p>` : ''}
  </li>`).join('')}</ul>`;
}
export function socialsHTML(list) {
  return `<ul class="social-buttons">${list.map(s => `<li><a class="btn" href="${esc(s.type === 'email' ? 'mailto:' + s.url : s.url)}" target="_blank" rel="noopener">${icon(s.type === 'email' ? 'mail' : s.type === 'website' ? 'globe' : s.type)}${esc(SOCIAL_TYPES[s.type] || s.type)}</a></li>`).join('')}</ul>`;
}

// 首頁底部與關於我共用；compact 用在首頁（不重複顯示自我介紹）
export function brandSectionsHTML({ compact = false } = {}) {
  const st = site();
  const tl = (st.timeline || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const gear = st.gear || [];
  const socials = (st.socials || []).filter(s => s.url);
  const admin = S.admin;
  if (!admin && !tl.length && !gear.length && !socials.length) return '';
  const part = (show, html) => (show ? html : '');
  return `<section class="section band brand" aria-labelledby="h-brand">
    <div class="wrap">
      <div class="section-head"><h2 id="h-brand">${compact ? '關於小齊' : '學琴這條路'}</h2>${compact ? '<a class="more" href="#/about">完整介紹</a>' : ''}${admin ? `<button class="btn sm" type="button" data-edit-brand="all">${icon('edit')}編輯品牌資料</button>` : ''}</div>
      <div class="brand-grid">
        ${part(tl.length || admin, `<div class="brand-col"><h3>學琴歷程</h3>${tl.length ? timelineHTML(compact ? tl.slice(-4) : tl) : placeholder('還沒有歷程。', '例如：哪年開始學、第一首學會的指彈、參加的檢定或表演。', 'timeline')}</div>`)}
        ${part(gear.length || admin, `<div class="brand-col"><h3>我的器材</h3>${gear.length ? gearHTML(compact ? gear.slice(0, 4) : gear) : placeholder('還沒有器材。', '例如：吉他型號、常用的弦、Capo、調音器。', 'gear')}</div>`)}
      </div>
      ${part(socials.length || admin, `<div class="brand-social"><h3>找到我</h3>${socials.length ? socialsHTML(socials) : placeholder('還沒有社群連結。', '填上 YouTube、Instagram 或 Email，訪客就能追蹤你。', 'socials')}</div>`)}
    </div>
  </section>`;
}

export function bindBrandEditors(root) {
  $$('[data-edit-brand]', root).forEach(b => b.addEventListener('click', () => edit('profile', { focus: b.dataset.editBrand })));
}

export default async function ({ root, setTitle }) {
  const st = site();
  const prof = st.profile;
  setTitle('關於我');
  const bio = prof.bio ? (await renderMarkdown(prof.bio)).html : '';
  const facts = [
    prof.location && `<div><dt>所在地</dt><dd>${esc(prof.location)}</dd></div>`,
    prof.startedYear && `<div><dt>開始彈吉他</dt><dd><b class="num">${esc(prof.startedYear)}</b> 年</dd></div>`,
  ].filter(Boolean).join('');
  root.innerHTML = `
    <section class="wrap about-head">
      <div class="about-photo">${rosetteHTML(prof.photo ? fileUrl(prof.photo) : '', prof.name ? `${prof.name}的照片` : '')}</div>
      <div class="about-text">
        <h1>${esc(prof.name ? `我是${prof.name}` : '關於我')}</h1>
        ${bio ? `<div class="prose">${bio}</div>` : S.admin
          ? `<div class="todo-card"><p><b>還沒有自我介紹。</b>寫幾句你是誰、為什麼開始彈指彈、這個網站想記錄什麼。</p><button class="btn sm amber" type="button" data-edit-brand="profile">${icon('edit')}填寫自我介紹</button></div>`
          : `<p class="lead">${esc(st.tagline)}</p>`}
        ${facts ? `<dl class="about-facts">${facts}</dl>` : ''}
      </div>
    </section>
    ${brandSectionsHTML({ compact: false })}`;
  bindBrandEditors(root);
}
