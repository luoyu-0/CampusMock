import { useState } from 'react'

/** 水彩位图的一次性加载：拿到就通知父容器加 .has-art 把矢量兜底盖掉；
 *   取不到才把自己撤掉，留下兜底 SVG。加载成功后必须留在 DOM 里，
 *   因为它才是最终显示的那张图（global.css 用动画把它淡入）。 */
export function Photo({
  src,
  className,
  onLoaded,
}: {
  src: string
  className: string
  onLoaded?: () => void
}) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'missing'>('loading')
  if (status === 'missing') return null
  return (
    <img
      className={className}
      src={src}
      alt=""
      aria-hidden="true"
      onLoad={() => {
        setStatus('loaded')
        onLoaded?.()
      }}
      onError={() => setStatus('missing')}
    />
  )
}
