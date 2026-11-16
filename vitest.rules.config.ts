import { defineConfig } from 'vitest/config';

// 只給 Firestore 規則測試用（要先開 Emulator）：npm run test:rules
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests-rules/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
