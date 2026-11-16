import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { getDeviceId } from './lib/storage';
import { startAutoFlush } from './lib/firebase';
import { preloadCharacters } from './lib/characterSvg';
import './styles.css';

getDeviceId(); // 第一次開啟就產生匿名 device_id
registerSW({ immediate: true });
startAutoFlush();
preloadCharacters(); // 7 張角色 SVG 先載入，換狀態不會閃空白 // 有設定 Firebase 時，補送離線時累積的事件

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
