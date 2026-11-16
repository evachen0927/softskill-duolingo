import { useState } from 'react';
import { navigate, useHashPath } from './router';
import { TabBar } from './components/TabBar';
import { Home } from './pages/Home';
import { ComingSoon } from './pages/ComingSoon';
import { PainPoints } from './pages/PainPoints';
import { Commit } from './pages/Commit';
import { Practice } from './pages/Practice';
import { Debug } from './pages/Debug';
import { NotifStep } from './pages/NotifStep';
import { getStage, type Stage } from './lib/onboarding';

const PLACEHOLDERS: Record<string, { title: string; blurb: string }> = {
  '/library': { title: '題庫', blurb: '之後可以在這裡瀏覽所有練習過的題目，並重練答錯的題。' },
  '/ai': { title: 'AI 對話練習', blurb: '之後可以在這裡跟 AI 扮演的上司直接對話練習。' },
  '/me': { title: '關於我', blurb: '之後可以在這裡看到你的練習紀錄和設定。' },
};

export function App() {
  const path = useHashPath();
  const [stage, setStage] = useState<Stage>(getStage);
  const [askNotif, setAskNotif] = useState(false);
  const refresh = () => setStage(getStage());

  // 隱藏頁：任何階段都能進
  if (path === '/debug') {
    return <Debug onCleared={() => { refresh(); navigate('/'); }} />;
  }

  // 引導沒完成：不管網址是什麼都留在引導，不顯示底部 tab，避免跳過
  if (stage === 'pain_points') return <PainPoints onDone={refresh} />;
  if (stage === 'commit') {
    return (
      <Commit
        onDone={() => {
          setAskNotif(true); // 擊掌後接著問通知權限
          refresh();
        }}
      />
    );
  }

  if (askNotif) {
    return (
      <NotifStep
        onDone={() => {
          setAskNotif(false);
          navigate('/practice');
        }}
      />
    );
  }

  // 出題畫面照設計版位（選項靠底到 y=794），不放底部 tab；左上角有「回到首頁」
  if (path === '/practice') return <Practice />;

  const placeholder = PLACEHOLDERS[path];
  const current = placeholder ? path : '/';
  return (
    <>
      {placeholder ? <ComingSoon key={path} {...placeholder} /> : <Home />}
      <TabBar current={current} />
    </>
  );
}
