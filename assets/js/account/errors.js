// 帳號與資料庫錯誤 → 看得懂的中文（說明發生什麼、怎麼辦）
const MESSAGES = {
  'auth/email-already-in-use': '這個 Email 已經註冊過了，請直接登入。',
  'auth/invalid-email': 'Email 格式不正確。',
  'auth/weak-password': '密碼至少要 6 個字元。',
  'auth/invalid-credential': 'Email 或密碼不正確。',
  'auth/user-not-found': '找不到這個帳號，請先建立帳號。',
  'auth/wrong-password': 'Email 或密碼不正確。',
  'auth/too-many-requests': '嘗試太多次了，請過幾分鐘再試。',
  'auth/popup-closed-by-user': '登入視窗被關掉了，請再試一次。',
  'auth/cancelled-popup-request': '登入視窗被關掉了，請再試一次。',
  'auth/popup-blocked': '瀏覽器擋住了登入視窗，請允許這個網站開啟彈出視窗。',
  'auth/unauthorized-domain': '這個網址還沒被加進 Firebase 的「已授權網域」，請通知站長。',
  'auth/operation-not-allowed': '站長還沒在 Firebase 開啟這種登入方式。',
  'auth/network-request-failed': '網路連線失敗，請檢查網路後再試。',
  'permission-denied': '沒有權限讀寫這份資料，請重新登入。',
  unavailable: '資料庫暫時連不上，請稍後再試。',
};
export const authMessage = err => (err && MESSAGES[err.code]) || (err && err.message) || '發生未知的錯誤。';
