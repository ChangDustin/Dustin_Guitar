// 學員的個人資料：歌曲進度、筆記、收藏、練習日誌。
// 資料實際存在哪（Firebase 或示範模式的 localStorage）由 auth.js 選的 provider 決定，這裡不用管。
import { S, emit } from '../core/store.js';
import { ymd } from '../core/dom.js';

let provider = null;
let data = { songs: {}, logs: [] };

export function setProvider(p) { provider = p; }

export async function loadProgress() {
  if (!S.user || !provider) { data = { songs: {}, logs: [] }; emit('progress'); return; }
  try {
    data = await provider.loadData(S.user.uid);
  } catch (err) {
    console.error(err);
    data = { songs: {}, logs: [] };
    emit('toast', { msg: '讀取你的練習紀錄失敗：' + (provider.errorMessage ? provider.errorMessage(err) : err.message), type: 'err' });
  }
  data.logs.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  emit('progress');
}

export const songState = id => data.songs[id] || null;
export const allStates = () => data.songs;
export const logs = () => data.logs;

// 先更新畫面再寫入，失敗就還原
export async function setSongState(id, patch) {
  if (!S.user) throw new Error('請先登入');
  const before = data.songs[id] ? { ...data.songs[id] } : null;
  const next = { status: '', note: '', fav: false, ...before, ...patch, updatedAt: new Date().toISOString() };
  if (!['', '想學', '練習中', '已學會'].includes(next.status)) throw new Error('狀態不正確');
  next.note = String(next.note || '').slice(0, 2000);
  data.songs[id] = next;
  emit('progress');
  try {
    await provider.setSong(S.user.uid, id, next);
  } catch (err) {
    if (before) data.songs[id] = before; else delete data.songs[id];
    emit('progress');
    throw new Error(provider.errorMessage ? provider.errorMessage(err) : err.message);
  }
}

export async function addLog({ date, minutes, songIds = [], note = '' }) {
  if (!S.user) throw new Error('請先登入');
  const m = Math.round(Number(minutes));
  if (!Number.isInteger(m) || m < 1 || m > 1440) throw new Error('練習時間要在 1–1440 分鐘之間');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('日期格式不正確');
  const log = { date, minutes: m, songIds: songIds.slice(0, 20), note: String(note).slice(0, 500), createdAt: new Date().toISOString() };
  const id = await provider.addLog(S.user.uid, log).catch(err => { throw new Error(provider.errorMessage ? provider.errorMessage(err) : err.message); });
  data.logs.unshift({ id, ...log });
  data.logs.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  emit('progress');
}

export async function deleteLog(id) {
  const i = data.logs.findIndex(l => l.id === id);
  if (i < 0) return;
  const [removed] = data.logs.splice(i, 1);
  emit('progress');
  try {
    await provider.deleteLog(S.user.uid, id);
  } catch (err) {
    data.logs.splice(i, 0, removed);
    emit('progress');
    throw new Error(provider.errorMessage ? provider.errorMessage(err) : err.message);
  }
}

// 統計：每天分鐘數、連續天數、本週與總時數
export function stats() {
  const days = new Map();
  for (const l of data.logs) days.set(l.date, (days.get(l.date) || 0) + l.minutes);
  const total = [...days.values()].reduce((a, b) => a + b, 0);
  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // 週一
  const ws = ymd(weekStart);
  let week = 0;
  for (const [d, m] of days) if (d >= ws) week += m;
  // 連續天數：今天沒練也從昨天算起，避免早上一打開就歸零
  let streak = 0;
  const cursor = new Date(now);
  if (!days.has(ymd(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(ymd(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }
  const learned = Object.values(data.songs).filter(s => s.status === '已學會').length;
  const favs = Object.entries(data.songs).filter(([, s]) => s.fav).map(([id]) => id);
  return { days, total, week, streak, learned, favs, sessions: data.logs.length };
}
