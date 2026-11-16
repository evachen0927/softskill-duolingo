/** 純函式的 CSV 工具，前端 #/debug 和 scripts/export-events.ts 共用。 */
export const EVENT_COLUMNS = [
  'device_id', 'uid', 'type', 'question_id', 'choice', 'correct', 'feedback',
  'slot', 'review', 'permission', 'tab', 'platform', 'standalone', 'ts',
] as const;

function cell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'string' ? v : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(header: readonly string[], rows: unknown[][]): string {
  return [header.map(cell).join(','), ...rows.map((r) => r.map(cell).join(','))].join('\r\n') + '\r\n';
}

export function eventsToCSV(events: Record<string, unknown>[]): string {
  return toCSV(EVENT_COLUMNS, events.map((e) => EVENT_COLUMNS.map((c) => e[c])));
}
