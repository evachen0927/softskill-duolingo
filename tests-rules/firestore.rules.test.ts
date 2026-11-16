/**
 * Firestore 安全規則測試：只在 Firebase Emulator 上跑（npm run test:rules），不碰真的 Firebase。
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { addDoc, collection, deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

let env: RulesTestEnvironment;

const event = (uid: string, extra: Record<string, unknown> = {}) => ({
  device_id: 'device-1',
  uid,
  type: 'answer',
  question_id: 'q001',
  choice: 'B',
  correct: true,
  slot: 1,
  review: false,
  platform: 'ios',
  standalone: true,
  ts: '2026-11-16T12:00:00.000Z',
  ...extra,
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-softskill',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
afterAll(async () => env?.cleanup());
beforeEach(async () => env.clearFirestore());

describe('events/', () => {
  it('已登入（匿名）的使用者可以新增自己的事件', async () => {
    const db = env.authenticatedContext('alice').firestore();
    await assertSucceeds(addDoc(collection(db, 'events'), event('alice')));
  });

  it('未登入不能新增', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(addDoc(collection(db, 'events'), event('alice')));
  });

  it('不能冒用別人的 uid', async () => {
    const db = env.authenticatedContext('alice').firestore();
    await assertFails(addDoc(collection(db, 'events'), event('bob')));
  });

  it('不在清單內的 type 或多餘欄位會被拒絕', async () => {
    const db = env.authenticatedContext('alice').firestore();
    await assertFails(addDoc(collection(db, 'events'), event('alice', { type: 'hack' })));
    await assertFails(addDoc(collection(db, 'events'), event('alice', { email: 'x@y.z' })));
  });

  it('任何人都不能讀、改、刪事件（包含本人）', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'events/e1'), event('alice'));
    });
    const db = env.authenticatedContext('alice').firestore();
    await assertFails(getDoc(doc(db, 'events/e1')));
    await assertFails(updateDoc(doc(db, 'events/e1'), { choice: 'A' }));
    await assertFails(deleteDoc(doc(db, 'events/e1')));
  });
});

describe('push_subs/{uid}', () => {
  const sub = { fcm_token: 't', reminder_time: '20:00', timezone: 'Asia/Taipei' };

  it('本人可以建立、讀取、更新、刪除自己的訂閱', async () => {
    const db = env.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(db, 'push_subs/alice'), sub));
    await assertSucceeds(getDoc(doc(db, 'push_subs/alice')));
    await assertSucceeds(setDoc(doc(db, 'push_subs/alice'), { last_completed_date: '2026-11-16' }, { merge: true }));
    await assertSucceeds(deleteDoc(doc(db, 'push_subs/alice')));
  });

  it('不能讀寫別人的訂閱', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'push_subs/bob'), sub);
    });
    const db = env.authenticatedContext('alice').firestore();
    await assertFails(getDoc(doc(db, 'push_subs/bob')));
    await assertFails(setDoc(doc(db, 'push_subs/bob'), sub));
    await assertFails(deleteDoc(doc(db, 'push_subs/bob')));
  });

  it('未登入不能讀寫', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, 'push_subs/alice'), sub));
    await assertFails(getDoc(doc(db, 'push_subs/alice')));
  });

  it('不能寫入清單外的欄位', async () => {
    const db = env.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(db, 'push_subs/alice'), { ...sub, is_admin: true }));
  });
});

describe('其他路徑', () => {
  it('一律拒絕', async () => {
    const db = env.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(db, 'users/alice'), { a: 1 }));
  });
});
