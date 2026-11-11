// scripts/ 共用的讀檔工具
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOC_TYPES } from '../assets/js/core/schema.js';

export const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const abs = p => join(ROOT, p);
export const exists = p => existsSync(abs(p));

export async function readJSON(p) {
  return JSON.parse(await readFile(abs(p), 'utf8'));
}

// 讀出所有技巧與文章的 Markdown：[{ type, path, text }]
export async function loadDocs() {
  const docs = [];
  for (const [type, { dir }] of Object.entries(DOC_TYPES)) {
    const files = (await readdir(abs(dir)).catch(() => [])).filter(f => f.endsWith('.md')).sort();
    for (const f of files) docs.push({ type, path: `${dir}/${f}`, text: await readFile(abs(`${dir}/${f}`), 'utf8') });
  }
  return docs;
}

export async function loadAll() {
  const [site, songs, playlists, path, chords, docs] = await Promise.all([
    readJSON('content/site.json'), readJSON('content/songs.json'), readJSON('content/playlists.json'),
    readJSON('content/path.json'), readJSON('content/chords.json'), loadDocs(),
  ]);
  return { site, songs, playlists, path, chords, docs };
}
