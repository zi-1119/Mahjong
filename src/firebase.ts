import { initializeApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore"; 
// 🌟 1. 我幫你把 auth 的工具全部合併整理乾淨了，並加入了 GoogleAuthProvider
import { getAuth, initializeAuth, indexedDBLocalPersistence, GoogleAuthProvider } from "firebase/auth";
import { Capacitor } from "@capacitor/core";

// 👇 改用環境變數讀取金鑰！這樣上傳 GitHub 就不會洩漏了
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);

// 🔥 殺手鐧 1：強制開啟 Long Polling 模式，完美適應手機 App 網路環境
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true 
});

// 🔥 殺手鐧 2：終極原生解法！判斷如果是手機 App，就用本機儲存，徹底阻斷 Google 隱形網頁 iframe！
let authInstance: any;
if (Capacitor.isNativePlatform()) {
  authInstance = initializeAuth(app, {
    persistence: indexedDBLocalPersistence
  });
} else {
  // 如果是電腦網頁版，就照舊
  authInstance = getAuth(app);
}

export const auth = authInstance;

// 👇 🌟 3. 新增這行：建立 Google 登入的專屬鑰匙，並讓其他檔案可以使用！
export const googleProvider = new GoogleAuthProvider();

export const isFirebaseEnabled = true;