import { describe, it, expect } from 'vitest';
import { pickQuestions, journeyDay, getOrCreateDailySet, QUESTION_BANK } from '../src/lib/dailySet';
import { getItem, setItem } from '../src/lib/storage';

const bank3 = ['q1', 'q2', 'q3'];
const bank7 = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7'];

describe('pickQuestions：每日出題規則', () => {
  it('第 1 天出新題 1、2、3', () => {
    expect(pickQuestions(bank3, 1)).toEqual({ question_ids: ['q1', 'q2', 'q3'], review: [false, false, false] });
  });

  it('只有 3 題時，第 2 天起三題都標示「複習」', () => {
    for (const day of [2, 3, 10, 30]) {
      expect(pickQuestions(bank3, day)).toEqual({ question_ids: ['q1', 'q2', 'q3'], review: [true, true, true] });
    }
  });

  it('題庫 7 題：第 1、2 天都是新題', () => {
    expect(pickQuestions(bank7, 1)).toEqual({ question_ids: ['q1', 'q2', 'q3'], review: [false, false, false] });
    expect(pickQuestions(bank7, 2)).toEqual({ question_ids: ['q4', 'q5', 'q6'], review: [false, false, false] });
  });

  it('題庫 7 題：第 3 天出第 7、1、2 題，第 1、2 題標示「複習」', () => {
    expect(pickQuestions(bank7, 3)).toEqual({ question_ids: ['q7', 'q1', 'q2'], review: [false, true, true] });
  });

  it('題庫 7 題：第 4 天之後全是複習，且同一天不重複', () => {
    const d4 = pickQuestions(bank7, 4);
    expect(d4).toEqual({ question_ids: ['q3', 'q4', 'q5'], review: [true, true, true] });
    for (let day = 1; day <= 30; day++) {
      const ids = pickQuestions(bank7, day).question_ids;
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('題庫少於 3 題時，只出題庫裡有的題數', () => {
    expect(pickQuestions(['q1', 'q2'], 1)).toEqual({ question_ids: ['q1', 'q2'], review: [false, false] });
    expect(pickQuestions(['q1', 'q2'], 2)).toEqual({ question_ids: ['q1', 'q2'], review: [true, true] });
    expect(pickQuestions(['q1'], 1)).toEqual({ question_ids: ['q1'], review: [false] });
    expect(pickQuestions(['q1'], 5)).toEqual({ question_ids: ['q1'], review: [true] });
    expect(pickQuestions([], 1)).toEqual({ question_ids: [], review: [] });
  });
});

describe('journeyDay', () => {
  it('journey_start 當天是第 1 天，跨月也正確', () => {
    expect(journeyDay('2026-11-16', '2026-11-16')).toBe(1);
    expect(journeyDay('2026-11-16', '2026-11-17')).toBe(2);
    expect(journeyDay('2026-11-30', '2026-12-02')).toBe(3);
  });
});

describe('getOrCreateDailySet：當天第一次開始就固定', () => {
  it('第一次產生後存進 daily_set，同一天再叫是同一組', () => {
    setItem('journey_start', '2026-11-16');
    const now = new Date('2026-11-17T01:00:00Z'); // 台北 11/17 09:00，第 2 天
    const a = getOrCreateDailySet(now);
    expect(a).toEqual({ date: '2026-11-17', question_ids: ['q001', 'q002', 'q003'], review: [false, false, false] });
    expect(getItem('daily_set', null)).toEqual(a);

    // 就算題庫中途變了，同一天也沿用已存的題組
    const later = getOrCreateDailySet(new Date('2026-11-17T15:00:00Z'), ['x', 'y', 'z']);
    expect(later).toEqual(a);
  });

  it('過了台北午夜就換新的一天', () => {
    setItem('journey_start', '2026-11-16');
    const d1 = getOrCreateDailySet(new Date('2026-11-16T15:59:00Z'));
    const d2 = getOrCreateDailySet(new Date('2026-11-16T16:00:00Z'));
    expect(d1.date).toBe('2026-11-16');
    expect(d1.review).toEqual([false, false, false]);
    expect(d2.date).toBe('2026-11-17');
    expect(d2.question_ids).toEqual(['q001', 'q002', 'q003']);
    expect(d2.review).toEqual([false, false, false]);
    expect(d1.question_ids).toEqual(['u1q1', 'u1q2', 'u1q3']);
  });

  it('題庫是第 1 單元 3 題，後面接著既有題目', () => {
    expect(QUESTION_BANK).toEqual(['u1q1', 'u1q2', 'u1q3', 'q001', 'q002', 'q003']);
  });
});
