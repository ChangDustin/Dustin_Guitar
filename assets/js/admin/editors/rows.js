// 通用的「一列一筆」清單編輯器：新增、刪除、上下移動。品牌資料、歌單、學習路徑共用。
import { $$, icon } from '../../core/dom.js';

// box：容器；items：資料陣列（會被直接修改）
// render(item, i) → 這一列的 HTML（不含外框）；read(rowEl, item) → 從畫面讀回資料
export function rowsEditor(box, items, { render, read, blank, addLabel = '新增一筆', after } = {}) {
  const sync = () => $$(':scope > .rows > .row-item', box).forEach((r, i) => { items[i] = read(r, items[i]); });
  const draw = () => {
    box.innerHTML = `<div class="rows">${items.map((it, i) => `<div class="row-item" data-i="${i}">${render(it, i)}
      <div class="row-tools">
        <button class="icon-btn sm" type="button" data-up aria-label="往上移" ${i === 0 ? 'disabled' : ''}>${icon('chevL', 'rot90')}</button>
        <button class="icon-btn sm" type="button" data-down aria-label="往下移" ${i === items.length - 1 ? 'disabled' : ''}>${icon('chevR', 'rot90')}</button>
        <button class="icon-btn sm" type="button" data-rm aria-label="刪除這一筆">${icon('trash')}</button>
      </div></div>`).join('') || '<p class="hint">還沒有任何一筆。</p>'}</div>
      <div class="btn-row" style="margin-top:8px"><button class="btn sm" type="button" data-add>${icon('plus')}${addLabel}</button></div>`;
    if (after) after(box);
  };
  box.addEventListener('click', e => {
    const row = e.target.closest('.row-item');
    if (e.target.closest('[data-add]')) { sync(); items.push(blank()); draw(); return; }
    if (!row) return;
    const i = Number(row.dataset.i);
    if (e.target.closest('[data-rm]')) { sync(); items.splice(i, 1); draw(); }
    else if (e.target.closest('[data-up]') && i > 0) { sync(); [items[i - 1], items[i]] = [items[i], items[i - 1]]; draw(); }
    else if (e.target.closest('[data-down]') && i < items.length - 1) { sync(); [items[i + 1], items[i]] = [items[i], items[i + 1]]; draw(); }
  });
  draw();
  return { sync, draw };
}
