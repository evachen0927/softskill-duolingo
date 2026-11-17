import { describe, it, expect } from 'vitest';
// 報告邏輯在純 mjs，給 node 直接跑，沒有另外的型別檔。
// @ts-expect-error weekly-report.mjs 沒有宣告檔
import { buildWeeklyReport } from '../scripts/weekly-report.mjs';

const until = new Date('2026-11-17T00:00:00Z');

describe('每週回報', () => {
  it('統計裝置、答對率、👎 原因、用得到、分頁興趣，並排除測試機', () => {
    const report = buildWeeklyReport([
      { device_id: 'dev', type: 'answer', question_id: 'u1q1', correct: true, ts: '2026-11-16T01:00:00Z' },
      { device_id: 'a', type: 'answer', question_id: 'u1q1', correct: true, ts: '2026-11-16T01:00:00Z' },
      { device_id: 'a', type: 'answer', question_id: 'u1q1', correct: false, ts: '2026-11-16T02:00:00Z' },
      { device_id: 'b', type: 'answer', question_id: 'u1q1', correct: true, ts: '2026-11-16T03:00:00Z' },
      { device_id: 'a', type: 'feedback', question_id: 'u1q1', feedback: 'down', ts: '2026-11-16T02:00:00Z' },
      { device_id: 'a', type: 'feedback_reason', question_id: 'u1q1', reason: 'other', text: '例子太長', ts: '2026-11-16T02:01:00Z' },
      { device_id: 'b', type: 'feedback', question_id: 'u1q1', feedback: 'up', ts: '2026-11-16T03:00:00Z' },
      { device_id: 'a', type: 'day_complete', ts: '2026-11-16T04:00:00Z' },
      { device_id: 'a', type: 'unit_useful', answer: 'yes', unit_id: 'u1', ts: '2026-11-16T04:01:00Z' },
      { device_id: 'b', type: 'unit_useful', answer: 'maybe', unit_id: 'u1', ts: '2026-11-16T04:01:00Z' },
      { device_id: 'a', type: 'tab_view', tab: '題庫', ts: '2026-11-16T05:00:00Z' },
      { device_id: 'b', type: 'tab_view', tab: '題庫', ts: '2026-11-16T05:00:00Z' },
      { device_id: 'c', type: 'tab_view', tab: '題庫', ts: '2026-11-16T05:00:00Z' },
      { device_id: 'a', type: 'feature_interest', tab: '題庫', ts: '2026-11-16T05:01:00Z' },
      { device_id: 'a', type: 'feature_wish', tab: '題庫', text: '可以重練錯題', ts: '2026-11-16T05:02:00Z' },
      { device_id: 'old', type: 'answer', question_id: 'u1q1', correct: false, ts: '2026-10-01T00:00:00Z' },
    ], { days: 7, until, exclude: ['dev'] });

    expect(report).toContain('有活動的裝置：3');
    expect(report).toContain('完成過一天的裝置：1');
    expect(report).toContain('作答 3 次，答對率 67%');
    expect(report).toContain('👍 1、👎 1');
    expect(report).toContain('太簡單 0、跟我的工作無關 0、解析看不懂 0、其他 1');
    expect(report).toContain('「例子太長」');
    expect(report).toContain('用得到 1');
    expect(report).toContain('可能 1');
    expect(report).toContain('用不到 0');
    expect(report).toContain('看過的裝置：3');
    expect(report).toContain('想要的裝置：1');
    expect(report).toContain('興趣率：33%');
    expect(report).toContain('「可以重練錯題」');
    expect(report).not.toContain('dev');
  });
});