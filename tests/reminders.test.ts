import { describe, it, expect, vi } from 'vitest';
import { decide, localNow, runReminders, NOTIFICATION, type PushSub, type Deps } from '../scripts/lib/reminders';

// 假時間：台北 = UTC+8
const tpe = (date: string, time: string) => new Date(`${date}T${time}:00+08:00`);
const base: PushSub = { fcm_token: 'tok', reminder_time: '20:00', timezone: 'Asia/Taipei' };

describe('decide：已經超過提醒時間、今天還沒發', () => {
  it('還沒到時間 → 不發', () => {
    expect(decide(base, tpe('2026-11-16', '19:59'))).toEqual({ send: false, reason: 'not_yet' });
  });
  it('已經到時間 → 發', () => {
    expect(decide(base, tpe('2026-11-16', '20:00'))).toEqual({ send: true, date: '2026-11-16' });
  });
  it('今天只做 2 題（last_completed_date 不是今天）→ 仍要發', () => {
    expect(decide({ ...base, last_completed_date: '2026-11-15' }, tpe('2026-11-16', '20:05'))).toEqual({ send: true, date: '2026-11-16' });
  });
  it('今天已完成 → 不發', () => {
    expect(decide({ ...base, last_completed_date: '2026-11-16' }, tpe('2026-11-16', '20:05'))).toEqual({ send: false, reason: 'completed_today' });
  });
  it('今天已發過 → 不再發（一天最多一則）', () => {
    expect(decide({ ...base, last_notified_date: '2026-11-16' }, tpe('2026-11-16', '21:30'))).toEqual({ send: false, reason: 'notified_today' });
  });
  it('cron 延遲 20 分鐘 → 照樣發，不會漏', () => {
    expect(decide(base, tpe('2026-11-16', '20:20'))).toEqual({ send: true, date: '2026-11-16' });
  });
  it('昨天發過不影響今天', () => {
    expect(decide({ ...base, last_notified_date: '2026-11-15' }, tpe('2026-11-16', '20:00'))).toMatchObject({ send: true });
  });
  it('用台北時間判斷：UTC 12:00 = 台北 20:00', () => {
    expect(decide(base, new Date('2026-11-16T12:00:00Z'))).toEqual({ send: true, date: '2026-11-16' });
    expect(decide(base, new Date('2026-11-16T11:59:00Z'))).toMatchObject({ send: false, reason: 'not_yet' });
  });
  it('跨日：台北 00:05 是新的一天，前一天發過的紀錄不擋', () => {
    const sub = { ...base, reminder_time: '00:00', last_notified_date: '2026-11-16' };
    expect(decide(sub, tpe('2026-11-17', '00:05'))).toEqual({ send: true, date: '2026-11-17' });
  });
  it('沒有 token 或時間格式錯 → 不發', () => {
    expect(decide({ ...base, fcm_token: '' }, tpe('2026-11-16', '21:00'))).toMatchObject({ reason: 'no_token' });
    expect(decide({ ...base, reminder_time: '8:00' }, tpe('2026-11-16', '21:00'))).toMatchObject({ reason: 'bad_time' });
  });
  it('localNow 以 24 小時制回傳', () => {
    expect(localNow(tpe('2026-11-16', '00:30'))).toEqual({ date: '2026-11-16', time: '00:30' });
  });
});

function fakeDeps(subs: Array<{ id: string; data: PushSub }>, sendImpl?: (token: string) => Promise<void>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deps: Record<keyof Deps, any> = {
    listSubs: vi.fn(async () => subs),
    send: vi.fn(sendImpl ?? (async () => undefined)),
    markNotified: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
    log: vi.fn(),
  };
  return deps;
}

describe('runReminders（假資料）', () => {
  const now = tpe('2026-11-16', '20:20'); // cron 延遲 20 分鐘
  const subs = [
    { id: 'a', data: { ...base } },                                              // 到時間 → 發
    { id: 'b', data: { ...base, reminder_time: '21:00' } },                      // 還沒到
    { id: 'c', data: { ...base, last_completed_date: '2026-11-16' } },           // 今天已完成
    { id: 'd', data: { ...base, last_notified_date: '2026-11-16' } },            // 今天已發過
    { id: 'e', data: { ...base, fcm_token: 'tok-e', last_completed_date: '2026-11-15' } }, // 今天只做 2 題 → 發
  ];

  it('只發給符合條件的人，發完寫 last_notified_date', async () => {
    const deps = fakeDeps(subs);
    const s = await runReminders(deps, now, false);
    expect(s).toMatchObject({ checked: 5, sent: 2, skipped: 3, removed: 0, failed: 0 });
    expect(deps.send.mock.calls.map((c: any[]) => c[0])).toEqual(['tok', 'tok-e']);
    expect(deps.markNotified).toHaveBeenCalledWith('a', '2026-11-16');
    expect(deps.markNotified).toHaveBeenCalledWith('e', '2026-11-16');
  });

  it('--dry-run：只列出會發給誰，不發送、不寫入', async () => {
    const deps = fakeDeps(subs);
    const s = await runReminders(deps, now, true);
    expect(s.wouldSend).toEqual(['a', 'e']);
    expect(deps.send).not.toHaveBeenCalled();
    expect(deps.markNotified).not.toHaveBeenCalled();
  });

  it('同一輪跑兩次（cron 重疊）：第二次因為已發過而跳過', async () => {
    const store: Record<string, PushSub> = { a: { ...base } };
    const deps = fakeDeps([]);
    deps.listSubs = vi.fn(async () => Object.entries(store).map(([id, data]) => ({ id, data: { ...data } })));
    deps.markNotified = vi.fn(async (id: string, date: string) => { store[id].last_notified_date = date; });
    await runReminders(deps, now, false);
    await runReminders(deps, tpe('2026-11-16', '20:35'), false);
    expect(deps.send).toHaveBeenCalledTimes(1);
  });

  it('token 失效 → 刪掉那份訂閱；其他錯誤 → 保留、下次再試', async () => {
    const deps = fakeDeps(
      [
        { id: 'dead', data: { ...base, fcm_token: 'dead' } },
        { id: 'flaky', data: { ...base, fcm_token: 'flaky' } },
      ],
      async (token) => {
        if (token === 'dead') throw Object.assign(new Error('gone'), { code: 'messaging/registration-token-not-registered' });
        throw Object.assign(new Error('503'), { code: 'messaging/internal-error' });
      },
    );
    const s = await runReminders(deps, now, false);
    expect(s).toMatchObject({ removed: 1, failed: 1, sent: 0 });
    expect(deps.remove).toHaveBeenCalledWith('dead');
    expect(deps.remove).not.toHaveBeenCalledWith('flaky');
    expect(deps.markNotified).not.toHaveBeenCalled();
  });

  it('通知文案沒有答案或個資', () => {
    expect(NOTIFICATION.body).toBe('今天的 5 分鐘練習還沒完成，要不要現在練？');
    expect(NOTIFICATION.link).toBe('#/practice');
  });
});
