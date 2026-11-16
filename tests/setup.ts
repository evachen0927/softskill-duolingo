import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { CHARACTER_FILES, primeSvg } from '../src/lib/characterSvg';

for (const n of CHARACTER_FILES) primeSvg(n, readFileSync(`public/characters/${n}.svg`, 'utf8'));

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.location.hash = '';
});
