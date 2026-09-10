import { useEffect, useRef, useState } from 'react'
import { sceneFallback } from './art/sceneFallback'
import { sideArt } from '../sceneArt'
import { Photo } from './Photo'

/** 一侧远景：位图取不到就永远显示兜底 SVG，取到了加 .has-art 把 SVG 藏掉。 */
function Side({ theme, side, pages }: { theme: number; side: 'l' | 'r'; pages: number }) {
  const [hasArt, setHasArt] = useState(false)
  return (
    <div className={`side side-${side}${hasArt ? ' has-art' : ''}`}>
      <Photo className="side-art" src={sideArt(theme, side)} onLoaded={() => setHasArt(true)} />
      {sceneFallback[`${theme}${side}`]}
      <span className="page" />
      {pages > 1 && <span className="page b" />}
    </div>
  )
}

/* 背景整层是装饰，aria-hidden；鼠标视差靠 --mx/--my 两个自定义属性，
   位移上限写在 global.css 的 .side 规则里。 */
export function SceneBackdrop({ theme }: { theme: number }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      el.style.setProperty('--mx', (event.clientX / window.innerWidth - 0.5).toFixed(3))
      el.style.setProperty('--my', (event.clientY / window.innerHeight - 0.5).toFixed(3))
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  return (
    <div className="scene" data-scene={theme} aria-hidden="true" ref={ref}>
      <svg className="far" viewBox="0 0 1440 220" preserveAspectRatio="none">
        <path d="M0 160 Q 240 90 480 150 T 960 140 T 1440 165 L1440 220 L0 220Z" fill="#cfe3c4" opacity=".75" />
        <path d="M0 190 Q 300 130 620 185 T 1440 190 L1440 220 L0 220Z" fill="#b9d6ad" opacity=".8" />
      </svg>
      <svg className="float-a" viewBox="0 0 200 120">
        <g fill="#fff" opacity=".9">
          <circle cx="60" cy="70" r="30" />
          <circle cx="95" cy="55" r="38" />
          <circle cx="135" cy="72" r="27" />
        </g>
      </svg>
      <svg className="float-b" viewBox="0 0 200 120">
        <g fill="#fff" opacity=".8">
          <circle cx="55" cy="72" r="26" />
          <circle cx="92" cy="58" r="34" />
          <circle cx="130" cy="74" r="24" />
        </g>
      </svg>

      <div className={`th th-${theme}`} key={theme}>
        <Side theme={theme} side="l" pages={1} />
        <Side theme={theme} side="r" pages={2} />
      </div>

      <div className="side mid mid-l">
        <span className="page" />
      </div>
      <div className="side mid mid-r">
        <span className="page" />
      </div>
    </div>
  )
}
