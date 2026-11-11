// 節拍器工具頁：大字 BPM、拍號、點擊算速度
import { metronomeHTML, mountMetronome } from '../components/metronome.js';

export default async function ({ root, setTitle, query, onCleanup }) {
  setTitle('節拍器');
  const bpm = Number(query.bpm) || 80;
  root.innerHTML = `
    <section class="wrap page-head"><h1>節拍器</h1><p class="lead">慢慢練、慢慢加速：先用能彈乾淨的速度，每次加 5，最後回到譜上的速度。不知道歌有多快時，跟著歌按幾下「點這裡打拍子」。</p></section>
    <section class="wrap"><div class="panel metro-page">${metronomeHTML(bpm, { big: true })}</div></section>`;
  mountMetronome(root, bpm, onCleanup);
}
