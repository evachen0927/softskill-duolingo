import { describe, it, expect } from 'vitest';
import { getItem, setItem, clearAll, dumpAll, getDeviceId } from '../src/lib/storage';
import { logEvent, isFirebaseConfigured } from '../src/lib/firebase';

describe('storage.ts', () => {
  it('key 自動加 softskill_ 前綴', () => {
    setItem('reminder_time', '20:00');
    expect(localStorage.getItem('softskill_reminder_time')).toBe('"20:00"');
    expect(getItem('reminder_time', '')).toBe('20:00');
  });

  it('壞掉的 JSON 會回傳預設值，不讓 App 壞掉', () => {
    localStorage.setItem('softskill_completions', '{oops');
    expect(getItem('completions', {})).toEqual({});
  });

  it('device_id 第一次產生後沿用', () => {
    const id = getDeviceId();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(getDeviceId()).toBe(id);
  });

  it('clearAll 只清 softskill_ 開頭的資料', () => {
    setItem('pain_points', ['p1']);
    localStorage.setItem('other_app', 'keep');
    clearAll();
    expect(dumpAll()).toEqual({});
    expect(localStorage.getItem('other_app')).toBe('keep');
  });
});

describe('firebase.ts（第 0 批只有介面）', () => {
  it('isFirebaseConfigured 一律 false', () => {
    expect(isFirebaseConfigured()).toBe(false);
  });

  it('logEvent 把事件放進 event_queue，不呼叫任何網路', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    logEvent({ type: 'onboarding_done' }, new Date('2026-11-16T12:00:00Z'));
    logEvent({ type: 'answer', question_id: 'q001', choice: 'B', correct: true, slot: 1, review: false });
    const q = getItem<any[]>('event_queue', []);
    expect(q).toHaveLength(2);
    expect(q[0]).toMatchObject({ type: 'onboarding_done', uid: null, ts: '2026-11-16T12:00:00.000Z' });
    expect(q[0].device_id).toBe(getDeviceId());
    expect(['ios', 'android', 'desktop']).toContain(q[0].platform);
    expect(typeof q[0].standalone).toBe('boolean');
    expect(q[1]).toMatchObject({ question_id: 'q001', choice: 'B', correct: true, slot: 1, review: false });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
