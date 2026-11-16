import { useEffect, useRef, useState } from 'react';
import styles from './ReminderSetting.module.css';
import { REMINDER_OPTIONS, defaultReminderTime } from '../lib/onboarding';
import { setItem } from '../lib/storage';
import { syncPushSub } from '../lib/push';

/** 首頁的提醒時間設定。儲存時同步更新 push_subs（有開通知、有設定 Firebase 時）。 */
export function ReminderSetting({ onSaved }: { onSaved?: (time: string) => void }) {
  const [time, setTime] = useState(defaultReminderTime());
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(time);
  const [saved, setSaved] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  // 打開編輯時捲到畫面中間，避免「儲存」被底部 tab 擋住
  useEffect(() => {
    if (editing) editorRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [editing]);

  if (!editing) {
    return (
      <div className={styles.row}>
        <div>
          <p className={styles.label}>每日提醒</p>
          <p className={styles.value} data-testid="reminder-time">{time}</p>
          {saved && <p className={styles.saved} role="status">已改成 {time}</p>}
        </div>
        <button
          type="button"
          className={styles.edit}
          onClick={() => {
            setDraft(time);
            setSaved(false);
            setEditing(true);
          }}
        >
          修改時間
        </button>
      </div>
    );
  }

  return (
    <div className={styles.editor} ref={editorRef}>
      <label className={styles.label} htmlFor="home-reminder">每天幾點提醒你？</label>
      <select id="home-reminder" className={styles.select} value={draft} onChange={(e) => setDraft(e.target.value)}>
        {REMINDER_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <p className={styles.small}>以台灣時間計算。</p>
      <div className={styles.actions}>
        <button type="button" className={styles.ghost} onClick={() => setEditing(false)}>取消</button>
        <button
          type="button"
          className={styles.save}
          onClick={() => {
            setItem('reminder_time', draft);
            setTime(draft);
            setEditing(false);
            setSaved(true);
            void syncPushSub({ reminder_time: draft });
            onSaved?.(draft);
          }}
        >
          儲存
        </button>
      </div>
    </div>
  );
}
