import { dumpAll, getItem } from './storage';
import type { AppEvent } from './firebase';
import { EVENT_COLUMNS, eventsToCSV, toCSV } from './csv';

export { EVENT_COLUMNS, toCSV };

/** 事件 CSV：一列一個事件。 */
export function eventsCSV(events: AppEvent[] = getItem<AppEvent[]>('event_queue', [])): string {
  return eventsToCSV(events as unknown as Record<string, unknown>[]);
}

/** 本機資料 CSV：一列一個 key，值以 JSON 表示（事件另有 events CSV）。 */
export function localDataCSV(data: Record<string, unknown> = dumpAll()): string {
  const rows = Object.entries(data)
    .filter(([k]) => k !== 'event_queue')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => [k, JSON.stringify(v)]);
  return toCSV(['key', 'value_json'], rows);
}

export function allJSON(): string {
  return JSON.stringify({ exported_at: new Date().toISOString(), data: dumpAll() }, null, 2);
}

export function download(filename: string, content: string, type: string): void {
  // CSV 加 BOM，Excel 開中文才不會亂碼
  const blob = new Blob([type.startsWith('text/csv') ? '﻿' + content : content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
