import { describe, it, expect } from 'vitest';
import { todayStr, daysBetween, addDays } from '../src/lib/date';

describe('date.ts（以 Asia/Taipei 取日期）', () => {
  it(`執行環境時區 = ${Intl.DateTimeFormat().resolvedOptions().timeZone}`, () => {
    expect(true).toBe(true);
  });

  it('台北 23:59 和隔天 00:00 算成不同天（兩個時間在 UTC 是同一天）', () => {
    const before = new Date('2026-11-16T15:59:00Z'); // 台北 2026-11-16 23:59
    const after = new Date('2026-11-16T16:00:00Z'); //  台北 2026-11-17 00:00
    expect(before.toISOString().slice(0, 10)).toBe(after.toISOString().slice(0, 10)); // UTC 同一天
    expect(todayStr(before)).toBe('2026-11-16');
    expect(todayStr(after)).toBe('2026-11-17');
  });

  it('台北清晨（UTC 仍是前一天）算台北的日期', () => {
    expect(todayStr(new Date('2026-11-16T22:30:00Z'))).toBe('2026-11-17'); // 台北 06:30
  });

  it('跨年', () => {
    expect(todayStr(new Date('2026-12-31T15:59:59Z'))).toBe('2026-12-31');
    expect(todayStr(new Date('2026-12-31T16:00:00Z'))).toBe('2027-01-01');
  });

  it('daysBetween / addDays 跨月、跨年、閏年', () => {
    expect(daysBetween('2026-11-16', '2026-11-16')).toBe(0);
    expect(daysBetween('2026-11-30', '2026-12-01')).toBe(1);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-11-16', 29)).toBe('2026-12-15');
  });
});
