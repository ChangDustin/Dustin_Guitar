// 和弦名稱解析與指型產生。
// 開放和弦來自 content/chords.json；封閉和弦用 E 型（根音在 6 弦）與 A 型（根音在 5 弦）自動推算。

export const ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const ENHARMONIC = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#', Cb: 'B', Fb: 'E', 'E#': 'F', 'B#': 'C' };
const FLAT_SPELL = { 'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb' };

export const QUALITIES = [
  { id: '', label: '大三和弦' }, { id: 'm', label: '小三和弦' }, { id: '7', label: '屬七' },
  { id: 'maj7', label: '大七' }, { id: 'm7', label: '小七' }, { id: 'sus2', label: '掛二' },
  { id: 'sus4', label: '掛四' }, { id: '7sus4', label: '七掛四' }, { id: 'add9', label: '加九' },
  { id: 'madd9', label: '小三加九' }, { id: '6', label: '大六' }, { id: 'm6', label: '小六' },
  { id: 'dim', label: '減三' }, { id: 'dim7', label: '減七' }, { id: 'm7b5', label: '半減七' }, { id: 'aug', label: '增三' },
];
const QUALITY_ALIASES = {
  '': '', M: '', maj: '', m: 'm', min: 'm', '-': 'm', 7: '7', maj7: 'maj7', M7: 'maj7', Maj7: 'maj7', '△7': 'maj7', '△': 'maj7',
  m7: 'm7', min7: 'm7', '-7': 'm7', sus2: 'sus2', sus4: 'sus4', sus: 'sus4', '7sus4': '7sus4', '7sus': '7sus4',
  add9: 'add9', '(add9)': 'add9', '(9)': 'add9', madd9: 'madd9', 'm(add9)': 'madd9', 'm(9)': 'madd9',
  6: '6', m6: 'm6', dim: 'dim', '°': 'dim', o: 'dim', dim7: 'dim7', '°7': 'dim7', m7b5: 'm7b5', 'm7-5': 'm7b5', 'm7(b5)': 'm7b5', ø: 'm7b5',
  aug: 'aug', '+': 'aug', 9: '9', m9: 'm9', maj9: 'maj9', 11: '11', m11: 'm11', 13: '13', '9sus4': '9sus4', add11: 'add11', 'm(add11)': 'madd11',
  mmaj7: 'mmaj7', mM7: 'mmaj7', 'm(b5)': 'dim', 'm(♭5)': 'dim', '7b9': '7b9', '7(b9)': '7b9',
};

const NAME_RE = /^([A-G])(#|b|♯|♭)?([^/]*)(?:\/([A-G])(#|b|♯|♭)?)?$/;
const normRoot = (l, acc) => {
  const r = l + (acc === '♯' ? '#' : acc === '♭' ? 'b' : acc || '');
  return ENHARMONIC[r] || r;
};

// 'C#m7' → { root:'C#', quality:'m7', bass:null, name:'C#m7' }；不認得回傳 null
export function parseChordName(raw) {
  const s = String(raw || '').trim().replace(/\s+/g, '');
  const m = NAME_RE.exec(s);
  if (!m) return null;
  const quality = QUALITY_ALIASES[m[3]];
  if (quality === undefined) return null;
  const root = normRoot(m[1], m[2]);
  const bass = m[4] ? normRoot(m[4], m[5]) : null;
  // 顯示時保留原本的升降記號習慣（Bb 不要顯示成 A#）
  const shownRoot = m[1] + (m[2] === '♯' ? '#' : m[2] === '♭' ? 'b' : m[2] || '');
  const shownBass = m[4] ? m[4] + (m[5] === '♯' ? '#' : m[5] === '♭' ? 'b' : m[5] || '') : '';
  return { root, quality, bass, name: shownRoot + quality + (shownBass ? '/' + shownBass : '') };
}
export const isKnownQuality = q => QUALITIES.some(x => x.id === q);
export const chordKey = (root, quality, bass) => root + quality + (bass ? '/' + bass : '');
export const spellRoot = (root, preferFlat) => (preferFlat && FLAT_SPELL[root]) || root;

// 封閉和弦樣板：frets 是相對根音格的位移（-1 不彈），fingers 是建議指法
const E_SHAPES = {
  '': { f: [0, 2, 2, 1, 0, 0], g: [1, 3, 4, 2, 1, 1], barre: true },
  m: { f: [0, 2, 2, 0, 0, 0], g: [1, 3, 4, 1, 1, 1], barre: true },
  7: { f: [0, 2, 0, 1, 0, 0], g: [1, 3, 1, 2, 1, 1], barre: true },
  m7: { f: [0, 2, 0, 0, 0, 0], g: [1, 3, 1, 1, 1, 1], barre: true },
  maj7: { f: [0, -1, 1, 1, 0, -1], g: [1, 0, 3, 4, 2, 0], barre: false },
  sus4: { f: [0, 2, 2, 2, 0, 0], g: [1, 2, 3, 4, 1, 1], barre: true },
  '7sus4': { f: [0, 2, 0, 2, 0, 0], g: [1, 3, 1, 4, 1, 1], barre: true },
};
const A_SHAPES = {
  '': { f: [-1, 0, 2, 2, 2, 0], g: [0, 1, 3, 3, 3, 1], barre: true },
  m: { f: [-1, 0, 2, 2, 1, 0], g: [0, 1, 3, 4, 2, 1], barre: true },
  7: { f: [-1, 0, 2, 0, 2, 0], g: [0, 1, 3, 1, 4, 1], barre: true },
  m7: { f: [-1, 0, 2, 0, 1, 0], g: [0, 1, 3, 1, 2, 1], barre: true },
  maj7: { f: [-1, 0, 2, 1, 2, 0], g: [0, 1, 3, 2, 4, 1], barre: true },
  sus2: { f: [-1, 0, 2, 2, 0, 0], g: [0, 1, 3, 4, 1, 1], barre: true },
  sus4: { f: [-1, 0, 2, 2, 3, 0], g: [0, 1, 2, 3, 4, 1], barre: true },
  '7sus4': { f: [-1, 0, 2, 0, 3, 0], g: [0, 1, 3, 1, 4, 1], barre: true },
  add9: { f: [-1, 0, 2, 4, 2, 0], g: [0, 1, 2, 4, 3, 1], barre: true },
  madd9: { f: [-1, 0, 2, 4, 1, 0], g: [0, 1, 3, 4, 2, 1], barre: true },
  6: { f: [-1, 0, 2, 2, 2, 2], g: [0, 1, 3, 3, 3, 3], barre: true },
  m6: { f: [-1, 0, 2, 2, 1, 2], g: [0, 1, 3, 4, 2, 4], barre: false },
  dim: { f: [-1, 0, 1, 2, 1, -1], g: [0, 1, 2, 4, 3, 0], barre: false },
  dim7: { f: [-1, 0, 1, 2, 1, 2], g: [0, 1, 2, 3, 2, 4], barre: false },
  m7b5: { f: [-1, 0, 1, 0, 1, -1], g: [0, 1, 3, 2, 4, 0], barre: false },
  aug: { f: [-1, 0, 3, 2, 2, 1], g: [0, 1, 4, 2, 3, 1], barre: false },
};

function movable(shape, rootFret) {
  const frets = shape.f.map(o => (o < 0 ? -1 : o + rootFret));
  const fingers = rootFret === 0 ? shape.g.map((g, i) => (shape.f[i] <= 0 ? 0 : g - 1 || 1)) : shape.g.slice();
  const played = frets.map((f, i) => (f >= 0 ? 6 - i : 0)).filter(Boolean);
  const barre = shape.barre && rootFret > 0 ? { fret: rootFret, from: Math.max(...played), to: Math.min(...played) } : null;
  return { frets, fingers, barre, generated: true };
}

// 取得某個和弦的所有指型：先放 chords.json 的開放指型，再補封閉和弦
export function chordShapes(name, openTable = {}) {
  const p = parseChordName(name);
  if (!p) return [];
  const out = [];
  const exactKeys = [p.name, chordKey(p.root, p.quality, p.bass)];
  for (const k of exactKeys) for (const v of openTable[k] || []) out.push({ ...v, generated: false });
  if (p.bass) {
    if (out.length) return dedupe(out);
    // 沒收錄的分割和弦：先給主和弦指型，提示低音要換
    return chordShapes(chordKey(p.root, p.quality), openTable).map(s => ({ ...s, bassNote: p.bass }));
  }
  const pc = ROOTS.indexOf(p.root);
  const eFret = (pc - 4 + 12) % 12;
  const aFret = (pc - 9 + 12) % 12;
  if (E_SHAPES[p.quality] && (eFret > 0 || !out.length)) out.push(movable(E_SHAPES[p.quality], eFret || 12));
  if (A_SHAPES[p.quality] && (aFret > 0 || !out.length)) out.push(movable(A_SHAPES[p.quality], aFret || 12));
  for (const k of [p.root + p.quality].filter(k => !exactKeys.includes(k))) for (const v of openTable[k] || []) out.push({ ...v, generated: false });
  return dedupe(out);
}
function dedupe(list) {
  const seen = new Set();
  return list.filter(s => { const k = s.frets.join(','); if (seen.has(k)) return false; seen.add(k); return true; });
}
