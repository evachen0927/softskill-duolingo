import { useEffect, useRef, useState } from 'react';
import styles from './Onboarding.module.css';
import { CONFIG } from '../config';
import { Character } from '../components/Character';
import { askPermission, notifAvailability, skipPermission } from '../lib/notify';
import { defaultReminderTime } from '../lib/onboarding';
import { IosInstallGuide } from '../components/IosInstallGuide';

type Phase = 'ask' | 'granted' | 'reassure' | 'ios';

export const REASSURE = '沒關係，還是可以開始；今天沒練的話，回到 App 也會看到提醒。';

/** 擊掌後的通知權限步驟。不論結果都會進入第一題，不擋流程。 */
export function NotifStep({ onDone }: { onDone: () => void }) {
  const avail = notifAvailability();
  const [phase, setPhase] = useState<Phase>(avail === 'ios_needs_install' ? 'ios' : avail === 'unsupported' ? 'reassure' : 'ask');
  const [busy, setBusy] = useState(false);
  const time = defaultReminderTime();
  const logged = useRef(false);

  // 不支援通知的瀏覽器：不跳任何框，直接記錄並顯示安撫文案
  useEffect(() => {
    if (avail === 'unsupported' && !logged.current) {
      logged.current = true;
      skipPermission('unsupported');
    }
  }, [avail]);

  const enable = async () => {
    setBusy(true);
    const status = await askPermission();
    setBusy(false);
    setPhase(status === 'granted' ? 'granted' : 'reassure');
  };

  const start = <button type="button" className={styles.primary} onClick={onDone}>開始第一題</button>;

  return (
    <main className={styles.page}>
      <p className={styles.step}>最後一步</p>

      {phase === 'ask' && (
        <>
          <h1 className={styles.h1}>要讓雲朵夥伴每天提醒你嗎？</h1>
          <Character kind="buddy" state="raise" className={styles.notifBuddy} />
          <p className={styles.sub}>每天 <b>{time}</b>，提醒你花 5 分鐘練習。</p>
          <p className={styles.note}>
            提醒是為了陪你一起完成 {CONFIG.JOURNEY_DAYS} 天，不是行銷推播。當天練完了，就不會再提醒你。
          </p>
          <div className={styles.spacer} />
          <button type="button" className={styles.primary} onClick={enable} disabled={busy}>開啟提醒</button>
          <button
            type="button"
            className={styles.secondary}
            disabled={busy}
            onClick={() => {
              skipPermission('skipped');
              setPhase('reassure');
            }}
          >
            先不要
          </button>
        </>
      )}

      {phase === 'granted' && (
        <>
          <h1 className={styles.h1}>設定好了！</h1>
          <Character kind="buddy" state="highfive" className={styles.notifBuddy} />
          <p className={styles.sub} role="status">每天 <b>{time}</b> 會提醒你；當天練完就不會打擾你。</p>
          <div className={styles.spacer} />
          {start}
        </>
      )}

      {phase === 'reassure' && (
        <>
          <h1 className={styles.h1}>好，我們先開始</h1>
          <Character kind="buddy" state="idle" className={styles.notifBuddy} />
          <p className={styles.sub} role="status">{REASSURE}</p>
          <p className={styles.note}>
            {avail === 'unsupported' ? '這個瀏覽器不支援系統通知。' : '之後想開啟，首頁的「提醒設定」隨時可以打開。'}
          </p>
          <div className={styles.spacer} />
          {start}
        </>
      )}

      {phase === 'ios' && (
        <>
          <h1 className={styles.h1}>iPhone 要先加入主畫面</h1>
          <p className={styles.sub}>加入主畫面後，從主畫面打開 App，才收得到每天 <b>{time}</b> 的提醒。</p>
          <IosInstallGuide />
          <p className={styles.note}>{REASSURE}</p>
          <div className={styles.spacer} />
          <button
            type="button"
            className={styles.primary}
            onClick={() => {
              skipPermission('ios_needs_install');
              onDone();
            }}
          >
            我知道了，先開始第一題
          </button>
        </>
      )}
    </main>
  );
}
