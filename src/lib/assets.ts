/** 情境背景圖路徑（public/backgrounds/{name}.svg），設計之後直接換檔。 */
export function backgroundSrc(name: string): string {
  return `${import.meta.env.BASE_URL}backgrounds/${name}.svg`;
}
