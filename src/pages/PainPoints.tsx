import { useState } from 'react';
import styles from './Onboarding.module.css';
import { PAIN_POINTS, UNSURE, togglePain, savePainPoints } from '../lib/onboarding';

function Option({ id, label, checked, onToggle }: { id: string; label: string; checked: boolean; onToggle: (id: string) => void }) {
  return (
    <li>
      <button type="button" role="checkbox" aria-checked={checked} className={styles.option} onClick={() => onToggle(id)}>
        {label}
      </button>
    </li>
  );
}

export function PainPoints({ onDone }: { onDone: () => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (id: string) => setSelected((s) => togglePain(s, id));

  return (
    <main className={styles.page}>
      <p className={styles.step}>第 1 步／共 2 步</p>
      <h1 className={styles.h1}>你在職場溝通上，最常卡在哪裡？</h1>
      <p className={styles.sub}>可以複選，讓我們更了解你卡在哪。</p>

      <ul className={styles.options} aria-label="溝通困難選項">
        {PAIN_POINTS.map((p) => <Option key={p.id} {...p} checked={selected.includes(p.id)} onToggle={toggle} />)}
      </ul>
      <p className={styles.or} aria-hidden="true">或</p>
      <ul className={styles.options}>
        <Option {...UNSURE} checked={selected.includes(UNSURE.id)} onToggle={toggle} />
      </ul>

      <div className={styles.spacer} />
      <button
        type="button"
        className={styles.primary}
        disabled={selected.length === 0}
        onClick={() => {
          savePainPoints(selected);
          onDone();
        }}
      >
        下一步
      </button>
      <p className={styles.hint} aria-live="polite">
        {selected.length === 0 ? '至少選 1 項才能繼續' : `已選 ${selected.length} 項`}
      </p>
    </main>
  );
}
