/** 情境背景圖路徑（public/backgrounds/{name}.svg），設計之後直接換檔。 */
export function backgroundSrc(name: string): string {
  return `${import.meta.env.BASE_URL}backgrounds/${name}.svg`;
}

/** 題目插圖。還沒給 scene_image 時用中性佔位圖。 */
export function sceneSrc(sceneImage?: string): string {
  const file = sceneImage?.trim() || 'scenes/placeholder.svg';
  return `${import.meta.env.BASE_URL}${file.replace(/^\//, '')}`;
}

/** SVG 優先；同名的 @2x PNG 當載入失敗時的備援。 */
export function sceneSources(sceneImage?: string): { src: string; fallback?: string } {
  const src = sceneSrc(sceneImage);
  const file = sceneImage?.trim();
  if (file?.endsWith('.svg')) return { src, fallback: sceneSrc(file.replace(/\.svg$/, '@2x.png')) };
  return { src };
}
