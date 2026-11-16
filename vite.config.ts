import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = env.VITE_BASE || '/';
  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        // 自己寫 service worker（src/sw.ts）：除了離線快取，還要接收每日提醒推播、處理點擊
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
          // Firebase SDK 只在設定好 Firebase 時才載入，不放進離線預先快取，讓第一次安裝輕一點
          globIgnores: ['**/firebase-*.js'],
        },
        includeAssets: ['characters/*.svg', 'icons/*.png'],
        manifest: {
          name: '軟實力多鄰國',
          short_name: '軟實力多鄰國',
          description: '30 天、每天 5 分鐘，跟著練會職場溝通。',
          lang: 'zh-Hant-TW',
          display: 'standalone',
          start_url: '.',
          scope: '.',
          background_color: '#F6F8FB',
          theme_color: '#1F4E79',
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
      }),
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (/node_modules\/(firebase|@firebase)\//.test(id)) return 'firebase';
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['tests/setup.ts'],
      include: ['tests/**/*.test.{ts,tsx}'],
    },
  };
});
