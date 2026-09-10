/* 背景与横幅位图。路径必须是字面量，Vite 才会静态分析成带 hash 的 URL。
   十张侧景共 545KB，一局里每屏只用两张，所以不在模块顶层导入，
   只在主题被选中后赋给 <img src>；取回前显示 art/sceneFallback.tsx 里的矢量兜底。 */

export type SideKey = '1l' | '1r' | '2l' | '2r' | '3l' | '3r' | '4l' | '4r' | '5l' | '5r'

const SIDE_ART: Record<SideKey, string> = {
  '1l': new URL('../design/assets/side-1-l.webp', import.meta.url).href,
  '1r': new URL('../design/assets/side-1-r.webp', import.meta.url).href,
  '2l': new URL('../design/assets/side-2-l.webp', import.meta.url).href,
  '2r': new URL('../design/assets/side-2-r.webp', import.meta.url).href,
  '3l': new URL('../design/assets/side-3-l.webp', import.meta.url).href,
  '3r': new URL('../design/assets/side-3-r.webp', import.meta.url).href,
  '4l': new URL('../design/assets/side-4-l.webp', import.meta.url).href,
  '4r': new URL('../design/assets/side-4-r.webp', import.meta.url).href,
  '5l': new URL('../design/assets/side-5-l.webp', import.meta.url).href,
  '5r': new URL('../design/assets/side-5-r.webp', import.meta.url).href,
}

export const HERO_ART = new URL('../design/assets/hero-campus.webp', import.meta.url).href
export const ENDING_ART = new URL('../design/assets/ending-dusk.webp', import.meta.url).href

export function sideArt(theme: number, side: 'l' | 'r'): string {
  return SIDE_ART[`${theme}${side}` as SideKey]
}
