// 音名、頻率、調弦的換算。調音器、指板、和弦字典、歌曲頁都用這裡。

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// 'Eb2' → 39；'F#3' → 54
export function noteToMidi(name) {
  const m = /^([A-Ga-g])([#b♯♭]?)(-?\d)$/.exec(String(name).trim());
  if (!m) return NaN;
  let pc = PC[m[1].toUpperCase()];
  if (m[2] === '#' || m[2] === '♯') pc += 1;
  if (m[2] === 'b' || m[2] === '♭') pc -= 1;
  return (Number(m[3]) + 1) * 12 + pc;
}
export const midiToName = (m, flat = false) => (flat ? FLAT_NAMES : NOTE_NAMES)[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
export const pitchClass = (m, flat = false) => (flat ? FLAT_NAMES : NOTE_NAMES)[((m % 12) + 12) % 12];
export const midiFreq = m => 440 * Math.pow(2, (m - 69) / 12);
export const freqMidi = f => 69 + 12 * Math.log2(f / 440);

// 調弦：notes 由 6 弦（最低）排到 1 弦
export const TUNINGS = {
  standard: { name: '標準調弦', notes: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
  'half-step-down': { name: '降半音', notes: ['Eb2', 'Ab2', 'Db3', 'Gb3', 'Bb3', 'Eb4'] },
  'whole-step-down': { name: '降全音（D 標準）', notes: ['D2', 'G2', 'C3', 'F3', 'A3', 'D4'] },
  'drop-d': { name: 'Drop D', notes: ['D2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
  dadgad: { name: 'D A D G A D', notes: ['D2', 'A2', 'D3', 'G3', 'A3', 'D4'] },
  'open-d': { name: 'Open D', notes: ['D2', 'A2', 'D3', 'F#3', 'A3', 'D4'] },
  'open-g': { name: 'Open G', notes: ['D2', 'G2', 'D3', 'G3', 'B3', 'D4'] },
  cgdgad: { name: 'C G D G A D', notes: ['C2', 'G2', 'D3', 'G3', 'A3', 'D4'] },
};
export const TUNING_IDS = [...Object.keys(TUNINGS), 'custom'];

export function songTuning(song) {
  if (song && song.tuning === 'custom' && Array.isArray(song.tuningNotes) && song.tuningNotes.length === 6) {
    return { id: 'custom', name: '特殊調弦', notes: song.tuningNotes };
  }
  const id = song && TUNINGS[song.tuning] ? song.tuning : 'standard';
  return { id, ...TUNINGS[id] };
}
// ['C2','G2',…] → 'C G D G A D'
export const tuningLetters = notes => notes.map(n => n.replace(/-?\d+$/, '')).join(' ');
// 跟標準調弦比，哪幾條弦被改了（回傳 [{ string: 6, from: 'E', to: 'C' }]）
export function changedStrings(notes) {
  const std = TUNINGS.standard.notes;
  return notes.map((n, i) => ({ string: 6 - i, from: std[i].replace(/\d/, ''), to: n.replace(/-?\d+$/, ''), diff: noteToMidi(n) - noteToMidi(std[i]) }))
    .filter(x => x.diff !== 0);
}

export const fmtTime = s => {
  s = Math.max(0, Math.floor(s || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
