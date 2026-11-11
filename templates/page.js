// 頁面模組樣板：{{title}}
// 1. 在 assets/js/core/router.js 的 ROUTES 加上 ['/{{name}}', '{{name}}']
// 2. 樣式寫在 assets/css/pages.css 的 /* == {{name}} == */ 段落，只能用 tokens.css 的變數
// 3. 在 tests/ 加一個打開這頁的測試
import { esc } from '../core/dom.js';

export default async function ({ root, content, setTitle, onCleanup }) {
  setTitle('{{title}}');
  root.innerHTML = `
    <section class="page-head wrap">
      <h1>${esc('{{title}}')}</h1>
      <p class="lead">（一句話說明這一頁）</p>
    </section>
    <section class="wrap">
      <!-- 內容 -->
    </section>`;
  // 需要計時器、監聽器時：onCleanup(() => clearInterval(timer));
}
