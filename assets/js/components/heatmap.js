// 練習熱度圖：一格是一天，顏色越深練越久（像 GitHub 的貢獻圖）
import { esc, ymd } from '../core/dom.js';

const level = m => (!m ? 0 : m <= 15 ? 1 : m <= 30 ? 2 : m <= 60 ? 3 : 4);

// days: Map<'YYYY-MM-DD', 分鐘>；weeks 欄、每欄週一到週日
export function heatmapSVG(days, { weeks = 53 } = {}) {
  const cell = 12, gap = 3, top = 18, left = 26;
  const today = new Date();
  const end = new Date(today);
  end.setDate(today.getDate() + (6 - ((today.getDay() + 6) % 7))); // 這週的週日
  const start = new Date(end);
  start.setDate(end.getDate() - weeks * 7 + 1);
  const W = left + weeks * (cell + gap), H = top + 7 * (cell + gap);
  let s = `<svg class="heatmap" viewBox="0 0 ${W} ${H}" role="img" aria-label="過去一年的練習熱度圖">`;
  ['一', '三', '五'].forEach((d, k) => { s += `<text class="hm-label" x="0" y="${top + (k * 2) * (cell + gap) + cell - 2}">${d}</text>`; });
  let lastMonth = -1;
  const d = new Date(start);
  const todayKey = ymd(today);
  for (let w = 0; w < weeks; w++) {
    for (let r = 0; r < 7; r++) {
      const key = ymd(d);
      if (r === 0 && d.getMonth() !== lastMonth) {
        lastMonth = d.getMonth();
        if (w < weeks - 2) s += `<text class="hm-label" x="${left + w * (cell + gap)}" y="11">${d.getMonth() + 1}月</text>`;
      }
      if (key <= todayKey) {
        const m = days.get(key) || 0;
        s += `<rect class="hm h${level(m)}" x="${left + w * (cell + gap)}" y="${top + r * (cell + gap)}" width="${cell}" height="${cell}" rx="3"><title>${esc(key)}：${m ? `練了 ${m} 分鐘` : '沒有練習'}</title></rect>`;
      }
      d.setDate(d.getDate() + 1);
    }
  }
  return s + '</svg>';
}

export const heatLegend = () => `<div class="hm-legend"><span>少</span>${[0, 1, 2, 3, 4].map(i => `<i class="h${i}"></i>`).join('')}<span>多</span></div>`;
