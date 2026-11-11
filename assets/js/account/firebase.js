// Firebase 版的帳號與資料：Authentication（Google／Email 登入）＋ Firestore。
// 資料放在 users/{uid}/songs/{歌曲 id} 與 users/{uid}/logs/{自動 id}，
// firestore.rules 規定只有本人讀寫得到。
import { CDN } from '../core/cdn.js';
import { authMessage } from './errors.js';

export async function createFirebaseProvider(config) {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(CDN.firebase + 'firebase-app.js'),
    import(CDN.firebase + 'firebase-auth.js'),
    import(CDN.firebase + 'firebase-firestore.js'),
  ]);
  const app = initializeApp(config);
  const auth = A.getAuth(app);
  const db = F.getFirestore(app);
  const toUser = u => (u ? { uid: u.uid, name: u.displayName || (u.email || '').split('@')[0] || '學員', email: u.email || '' } : null);
  const plain = snap => {
    const d = snap.data();
    for (const k of Object.keys(d)) if (d[k] && typeof d[k].toDate === 'function') d[k] = d[k].toDate().toISOString();
    return d;
  };

  return {
    kind: 'firebase',
    canGoogle: true,
    canReset: true,
    onUser(cb) { A.onAuthStateChanged(auth, u => cb(toUser(u))); },
    async signUp(email, pw, name) {
      const cred = await A.createUserWithEmailAndPassword(auth, String(email).trim(), pw);
      const display = String(name || '').trim().slice(0, 30);
      if (display) await A.updateProfile(cred.user, { displayName: display });
      await F.setDoc(F.doc(db, 'users', cred.user.uid), { name: display, createdAt: F.serverTimestamp() }, { merge: true });
      await auth.currentUser.reload();
    },
    signIn: (email, pw) => A.signInWithEmailAndPassword(auth, String(email).trim(), pw),
    async signInGoogle() {
      const cred = await A.signInWithPopup(auth, new A.GoogleAuthProvider());
      await F.setDoc(F.doc(db, 'users', cred.user.uid), { name: cred.user.displayName || '', lastLogin: F.serverTimestamp() }, { merge: true });
    },
    signOut: () => A.signOut(auth),
    resetPassword: email => A.sendPasswordResetEmail(auth, String(email).trim()),
    async loadData(uid) {
      const [songSnap, logSnap] = await Promise.all([
        F.getDocs(F.collection(db, 'users', uid, 'songs')),
        F.getDocs(F.query(F.collection(db, 'users', uid, 'logs'), F.orderBy('date', 'desc'), F.limit(1000))),
      ]);
      const songs = {};
      songSnap.forEach(s => { songs[s.id] = plain(s); });
      const logs = [];
      logSnap.forEach(s => logs.push({ id: s.id, ...plain(s) }));
      return { songs, logs };
    },
    setSong: (uid, id, state) => F.setDoc(F.doc(db, 'users', uid, 'songs', id), {
      status: state.status || '', note: state.note || '', fav: !!state.fav, updatedAt: F.serverTimestamp(),
    }),
    async addLog(uid, log) {
      const ref = await F.addDoc(F.collection(db, 'users', uid, 'logs'), {
        date: log.date, minutes: log.minutes, songIds: log.songIds, note: log.note, createdAt: F.serverTimestamp(),
      });
      return ref.id;
    },
    deleteLog: (uid, id) => F.deleteDoc(F.doc(db, 'users', uid, 'logs', id)),
    errorMessage: authMessage,
  };
}
