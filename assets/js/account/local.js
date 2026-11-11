// 示範模式：帳號與紀錄只存在這台瀏覽器的 localStorage。
// 站長還沒設定 Firebase、或網址加上 ?demo 時使用；自動化測試也用這個模式。
import { store, rand } from '../core/dom.js';
import { authMessage } from './errors.js';

const USERS = 'dg-demo-users';
const SESSION = 'dg-demo-session';
const DATA = 'dg-demo-data:';

async function hash(pw, salt) {
  const text = salt + ':' + pw;
  if (window.crypto && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return text; // 非 https 的舊瀏覽器：示範模式本來就不是真的帳號
}
const fail = code => Object.assign(new Error(authMessage({ code })), { code });

export function createLocalProvider() {
  const listeners = [];
  const users = () => store.get(USERS, {});
  const current = () => {
    const uid = store.get(SESSION, null);
    const u = Object.values(users()).find(x => x.uid === uid);
    return u ? { uid: u.uid, name: u.name, email: u.email } : null;
  };
  const notify = () => { const u = current(); listeners.forEach(fn => fn(u)); };
  const read = uid => store.get(DATA + uid, { songs: {}, logs: [] });

  return {
    kind: 'local',
    canGoogle: false,
    canReset: false,
    onUser(cb) { listeners.push(cb); setTimeout(() => cb(current()), 0); },
    async signUp(email, pw, name) {
      email = String(email).trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw fail('auth/invalid-email');
      if (String(pw).length < 6) throw fail('auth/weak-password');
      const all = users();
      if (all[email]) throw fail('auth/email-already-in-use');
      const salt = rand(12);
      const uid = 'demo-' + rand(10);
      all[email] = { uid, email, name: String(name || email.split('@')[0]).slice(0, 30), salt, hash: await hash(pw, salt) };
      store.set(USERS, all);
      store.set(SESSION, uid);
      notify();
    },
    async signIn(email, pw) {
      email = String(email).trim().toLowerCase();
      const u = users()[email];
      if (!u) throw fail('auth/user-not-found');
      if (u.hash !== await hash(pw, u.salt)) throw fail('auth/invalid-credential');
      store.set(SESSION, u.uid);
      notify();
    },
    async signOut() { store.del(SESSION); notify(); },
    async loadData(uid) { return read(uid); },
    async setSong(uid, id, state) { const d = read(uid); d.songs[id] = state; store.set(DATA + uid, d); },
    async addLog(uid, log) {
      const d = read(uid);
      const id = 'log-' + Date.now().toString(36) + rand(4);
      d.logs.push({ id, ...log });
      store.set(DATA + uid, d);
      return id;
    },
    async deleteLog(uid, id) { const d = read(uid); d.logs = d.logs.filter(l => l.id !== id); store.set(DATA + uid, d); },
    errorMessage: authMessage,
  };
}
