/** 用服務帳號初始化 Firebase Admin。金鑰只從環境變數讀，不寫進程式碼。 */
import { cert, initializeApp, type App } from 'firebase-admin/app';

export function initAdmin(): App | null {
  // 有設 FIRESTORE_EMULATOR_HOST 時，firebase-admin 會自動連 Emulator，不需要金鑰
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-softskill' });
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  const sa = JSON.parse(raw);
  return initializeApp({ credential: cert(sa), projectId: sa.project_id });
}
