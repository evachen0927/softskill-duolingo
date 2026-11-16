import { useState } from 'react';
import styles from './NotificationSetting.module.css';
import { askPermission, notifAvailability, syncPermissionFromBrowser, type NotifStatus } from '../lib/notify';
import { detectPlatform } from '../lib/firebase';
import { IosInstallGuide } from './IosInstallGuide';

const SETTINGS_HELP: Record<'ios' | 'android' | 'desktop', string[]> = {
  ios: ['打開 iPhone 的「設定」', '點「通知」，找到「軟實力多鄰國」', '打開「允許通知」，再回到 App'],
  android: ['在 Chrome 點網址列左邊的圖示（從主畫面開啟的話，長按 App 圖示 →「應用程式資訊」）', '點「權限」或「通知」', '改成「允許」，再回到 App'],
  desktop: ['點網址列左邊的圖示', '打開「網站設定」', '把「通知」改成「允許」，再重新整理頁面'],
};

/** 首頁「提醒設定」裡的通知狀態與重新開啟入口。只有按按鈕才會請求權限。 */
export function NotificationSetting() {
  const [status, setStatus] = useState<NotifStatus | null>(syncPermissionFromBrowser);
  const [busy, setBusy] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const avail = notifAvailability();
  const platform = detectPlatform();

  if (status === 'granted') {
    return <p className={styles.ok} data-testid="notif-state">✓ 系統通知已開啟，會在這個時間提醒你</p>;
  }

  if (avail === 'ios_needs_install') {
    return (
      <div data-testid="notif-state">
        <p className={styles.text}>iPhone 要先把 App 加入主畫面，才收得到通知。</p>
        <button type="button" className={styles.button} aria-expanded={showGuide} onClick={() => setShowGuide((v) => !v)}>
          {showGuide ? '收起說明' : '看怎麼加入主畫面'}
        </button>
        {showGuide && <div className={styles.guide}><IosInstallGuide /></div>}
      </div>
    );
  }

  if (avail === 'unsupported' || status === 'unsupported') {
    return <p className={styles.text} data-testid="notif-state">這個瀏覽器不支援系統通知；打開 App 時，首頁會提醒你。</p>;
  }

  if (status === 'denied') {
    return (
      <div data-testid="notif-state">
        <p className={styles.text}>系統通知目前是關閉的。想打開的話：</p>
        <ol className={styles.help}>
          {SETTINGS_HELP[platform].map((s) => <li key={s}>{s}</li>)}
        </ol>
        <p className={styles.small}>還沒打開也沒關係，打開 App 時首頁會提醒你。</p>
      </div>
    );
  }

  return (
    <div data-testid="notif-state">
      <p className={styles.text}>還沒開啟系統通知，現在只會在 App 裡提醒你。</p>
      <button
        type="button"
        className={styles.button}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setStatus(await askPermission());
          setBusy(false);
        }}
      >
        開啟通知
      </button>
    </div>
  );
}
