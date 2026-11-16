import styles from './IosInstallGuide.module.css';

/** iPhone「加入主畫面」教學。圖示是自己畫的示意圖，不使用 Apple 素材。 */
export function IosInstallGuide() {
  const share = (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" /><path d="M8 7l4-4 4 4" /><path d="M6 11v9h12v-9" />
    </svg>
  );
  const add = (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8v8M8 12h8" />
    </svg>
  );
  return (
    <ol className={styles.steps} aria-label="加入主畫面的步驟">
      <li><span className={styles.icon}>{share}</span><span>在 Safari 下方點<b>「分享」</b>按鈕</span></li>
      <li><span className={styles.icon}>{add}</span><span>往下滑，點<b>「加入主畫面」</b>，再點右上角<b>「加入」</b></span></li>
      <li><span className={styles.icon}><img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" width={22} height={22} /></span><span>回到主畫面，點<b>「軟實力多鄰國」</b>打開，就能開啟提醒</span></li>
    </ol>
  );
}
