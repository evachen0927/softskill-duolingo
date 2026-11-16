/**
 * 角色 SVG 載入：從 public/characters/ 讀檔（設計換檔不用改程式），以 inline SVG 插入，CSS 才動得到內部圖層。
 * 處理：拿掉固定 width/height（由外層決定大小）、外層 svg 設 overflow visible、
 *       clipPath id="cut" 改成每個實例唯一（同頁多張時不衝突），其餘圖層 id 保留給 motion-spec 的 CSS 用。
 */
export type CharacterFile =
  | 'orca-idle' | 'orca-raise' | 'orca-highfive'
  | 'boss-enter' | 'boss-ask' | 'boss-correct' | 'boss-wrong';

export const CHARACTER_FILES: CharacterFile[] = [
  'orca-idle', 'orca-raise', 'orca-highfive', 'boss-enter', 'boss-ask', 'boss-correct', 'boss-wrong',
];

const UID = '__CHAR_UID__';
const cache = new Map<CharacterFile, string>();
const pending = new Map<CharacterFile, Promise<string>>();

/** 把原始 SVG 轉成可插入的模板（UID 之後再換成實例 id）。 */
export function prepareSvg(raw: string): string {
  return raw
    .replace(/<\?xml[^>]*>/, '')
    .replace(/<svg\b([^>]*)>/, (_m, attrs: string) => {
      const cleaned = attrs
        .replace(/\s(width|height)="[^"]*"/g, '')
        .replace(/\srole="[^"]*"/, '')
        .replace(/\saria-label="[^"]*"/, '');
      return `<svg${cleaned} overflow="visible" aria-hidden="true" focusable="false">`;
    })
    .replace(/id="cut"/g, `id="cut-${UID}"`)
    .replace(/url\(#cut\)/g, `url(#cut-${UID})`);
}

export function instanceSvg(template: string, uid: string): string {
  return template.split(UID).join(uid.replace(/[^a-zA-Z0-9_-]/g, ''));
}

export function getCachedSvg(name: CharacterFile): string | undefined {
  return cache.get(name);
}

/** 測試或預先載入時直接放進快取。 */
export function primeSvg(name: CharacterFile, raw: string): void {
  cache.set(name, prepareSvg(raw));
}

export function loadSvg(name: CharacterFile): Promise<string> {
  const hit = cache.get(name);
  if (hit) return Promise.resolve(hit);
  let p = pending.get(name);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}characters/${name}.svg`)
      .then((r) => {
        if (!r.ok) throw new Error(`${name}.svg ${r.status}`);
        return r.text();
      })
      .then((raw) => {
        const t = prepareSvg(raw);
        cache.set(name, t);
        pending.delete(name);
        return t;
      });
    pending.set(name, p);
  }
  return p;
}

/** App 啟動時先載入 7 張，換狀態時不會閃空白。 */
export function preloadCharacters(): void {
  CHARACTER_FILES.forEach((n) => void loadSvg(n).catch(() => undefined));
}
