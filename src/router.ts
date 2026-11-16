import { useEffect, useState } from 'react';

/** 極簡 hash router（不加 react-router，少一個套件）。#/library → '/library' */
export function readHashPath(hash: string = window.location.hash): string {
  const p = hash.replace(/^#/, '').split('?')[0];
  return p === '' ? '/' : p.startsWith('/') ? p : `/${p}`;
}

export function useHashPath(): string {
  const [path, setPath] = useState(readHashPath());
  useEffect(() => {
    const onChange = () => setPath(readHashPath());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return path;
}

export function navigate(path: string): void {
  window.location.hash = path;
}
