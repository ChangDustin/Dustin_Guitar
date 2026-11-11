// npm run index：掃描 content/techniques 與 content/articles，產生 content/index.json
import { writeFile, readFile } from 'node:fs/promises';
import { buildIndex, indexText } from '../assets/js/core/content-index.js';
import { abs, loadDocs } from './lib.mjs';

const docs = await loadDocs();
const text = indexText(buildIndex(docs));
const before = await readFile(abs('content/index.json'), 'utf8').catch(() => '');
if (before === text) {
  console.log(`content/index.json 已是最新（技巧 ${docs.filter(d => d.type === 'technique').length} 篇、文章 ${docs.filter(d => d.type === 'article').length} 篇）`);
} else {
  await writeFile(abs('content/index.json'), text, 'utf8');
  console.log(`已更新 content/index.json（技巧 ${docs.filter(d => d.type === 'technique').length} 篇、文章 ${docs.filter(d => d.type === 'article').length} 篇）`);
}
