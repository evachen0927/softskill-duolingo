import { describe, it, expect } from 'vitest';
import { parsePushPayload, notificationUrl, DEFAULT_BODY } from '../src/lib/swHelpers';

describe('service worker：推播內容與點擊網址', () => {
  it('FCM data 訊息', () => {
    expect(parsePushPayload({ data: { title: 'T', body: 'B', link: '#/practice' } })).toEqual({ title: 'T', body: 'B', link: '#/practice' });
  });
  it('缺欄位時用預設文案', () => {
    expect(parsePushPayload({})).toEqual({ title: '軟實力多鄰國', body: DEFAULT_BODY, link: '#/practice' });
  });
  it('不接受外部網址，一律回到今日題', () => {
    expect(parsePushPayload({ data: { link: 'https://evil.example' } }).link).toBe('#/practice');
  });
  it('點通知打開今日題，GitHub Pages 子路徑也正確', () => {
    expect(notificationUrl('https://eva.github.io/softskill/', '#/practice')).toBe('https://eva.github.io/softskill/#/practice');
    expect(notificationUrl('http://localhost:4173', '#/practice')).toBe('http://localhost:4173/#/practice');
  });
});
