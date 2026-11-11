// 找不到頁面
import { icon } from '../core/dom.js';

export default async function ({ root, setTitle }) {
  setTitle('找不到這一頁');
  root.innerHTML = `<section class="wrap page-head notfound">
    <h1>這一頁不存在</h1>
    <p class="lead" style="margin:0 auto">網址可能打錯了，或這一頁已經搬家。</p>
    <p class="btn-row" style="justify-content:center;margin-top:24px"><a class="btn primary" href="#/">${icon('chevL')}回首頁</a><a class="btn" href="#/songs">逛曲庫</a></p>
  </section>`;
}
