import type { CSSProperties, ReactNode } from 'react'
import { Photo } from './Photo'

interface Leaf {
  x: string
  t: string
  d: string
  color?: string
}

function leafStyle(leaf: Leaf): CSSProperties {
  const style: Record<string, string> = { '--x': leaf.x, '--t': leaf.t, '--d': leaf.d }
  if (leaf.color) style['--leaf'] = leaf.color
  return style as CSSProperties
}

/* 横幅：兜底 SVG 在最底下，水彩位图盖上去，发光和落叶是同一套装饰。
   层叠顺序照 design/prototype.html，样式全在 global.css 里。 */
export function ArtFrame({
  frameClass,
  src,
  svg,
  leaves,
}: {
  frameClass: string
  src: string
  svg: ReactNode
  leaves: Leaf[]
}) {
  return (
    <div className={frameClass}>
      {svg}
      <Photo className="photo" src={src} />
      <span className="glow" />
      <span className="leaves" aria-hidden="true">
        {leaves.map((leaf, index) => (
          <i key={index} style={leafStyle(leaf)} />
        ))}
      </span>
    </div>
  )
}

export const HERO_LEAVES: Leaf[] = [
  { x: '14%', t: '8.5s', d: '.4s' },
  { x: '31%', t: '11s', d: '3.2s', color: '#c98b52' },
  { x: '57%', t: '9.5s', d: '1.6s' },
  { x: '74%', t: '12.5s', d: '5.4s', color: '#8fd79c' },
  { x: '89%', t: '10s', d: '7.2s' },
]

export const ENDING_LEAVES: Leaf[] = [
  { x: '18%', t: '9.5s', d: '1.2s', color: '#d9a441' },
  { x: '44%', t: '12s', d: '4.6s', color: '#c98b52' },
  { x: '68%', t: '10.5s', d: '2.4s', color: '#d9a441' },
  { x: '85%', t: '13s', d: '7s', color: '#8fd79c' },
]
