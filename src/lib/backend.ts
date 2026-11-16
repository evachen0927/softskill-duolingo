/**
 * 真正呼叫 Firebase SDK 的地方，只在 isFirebaseConfigured() 為 true 時才會被動態載入。
 * 測試一律 vi.mock 這個檔案，不碰真的 Firebase。
 * 開發模式（import.meta.env.DEV）一律連本機 Emulator。
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { addDoc, collection, connectFirestoreEmulator, doc, getFirestore, setDoc } from 'firebase/firestore';
import { firebaseEnv, type AppEvent } from './firebase';

let app: FirebaseApp | null = null;

function getApp(): FirebaseApp {
  if (app) return app;
  const { vapidKey: _v, ...config } = firebaseEnv();
  app = initializeApp(config);
  if (import.meta.env.DEV) {
    const host = import.meta.env.VITE_EMULATOR_HOST || '127.0.0.1';
    connectAuthEmulator(getAuth(app), `http://${host}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(getFirestore(app), host, 8080);
  }
  return app;
}

/** 匿名登入，回傳 uid（Firebase 會在本機記住，下次是同一個 uid）。 */
export async function ensureUser(): Promise<string> {
  const auth = getAuth(getApp());
  if (auth.currentUser) return auth.currentUser.uid;
  const cred = await signInAnonymously(auth);
  return cred.user.uid;
}

export async function addEvent(event: AppEvent): Promise<void> {
  // 去掉 undefined 欄位（Firestore 不接受 undefined）
  const clean = Object.fromEntries(Object.entries(event).filter(([, v]) => v !== undefined));
  await addDoc(collection(getFirestore(getApp()), 'events'), clean);
}

export interface PushSubFields {
  fcm_token?: string;
  reminder_time?: string;
  timezone?: string;
  last_completed_date?: string;
}

export async function savePushSub(uid: string, fields: PushSubFields): Promise<void> {
  await setDoc(doc(getFirestore(getApp()), 'push_subs', uid), fields, { merge: true });
}

/** 用我們自己的 service worker 註冊 FCM，取得推播 token。 */
export async function getFcmToken(registration: ServiceWorkerRegistration): Promise<string | null> {
  const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
  if (!(await isSupported())) return null;
  const token = await getToken(getMessaging(getApp()), {
    vapidKey: firebaseEnv().vapidKey,
    serviceWorkerRegistration: registration,
  });
  return token || null;
}
