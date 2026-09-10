import { ArtFrame, HERO_LEAVES } from '../components/ArtFrame'
import { HeroArtSvg } from '../components/art/HeroArt'
import { Note } from '../components/Cards'
import { HERO_ART } from '../sceneArt'
import { TOTAL_DAYS } from '../api/script'
import { chromeDay } from '../components/Chrome'
import type { Snapshot } from '../state/types'

function resumeLabel(saved: Snapshot): string {
  if (saved.phase === 'ended') return '已读到结局'
  if (saved.phase === 'pendingEnding') return '两周已写完'
  return `第 ${chromeDay(saved.history, saved.phase)} 天`
}

export function StartPage({
  saved,
  busy,
  onStart,
  onResume,
}: {
  saved: Snapshot | null
  busy: boolean
  onStart: () => void
  onResume: () => void
}) {
  return (
    <div className="hero">
      <ArtFrame frameClass="art-frame" src={HERO_ART} svg={<HeroArtSvg />} leaves={HERO_LEAVES} />
      <h1>我的大学日记</h1>
      <p className="sub">入学两周 · 十四篇日记</p>
      <p className="desc">
        每一天都会有一件真实得有点耳熟的事发生。
        <br />
        你只需要决定，当时的自己会怎么做。
      </p>
      <div className="btn-row">
        {saved ? (
          <button className="btn" disabled={busy} onClick={onResume}>
            继续上次的日记（{resumeLabel(saved)}）
          </button>
        ) : (
          <button className="btn" disabled={busy} onClick={onStart}>
            开始第一天
          </button>
        )}
      </div>
      <p className="hint">进度保存在这台设备的这个浏览器里，共 {TOTAL_DAYS} 天</p>
      <Note>
        两个按钮分别对应「无存档」和「有存档」两种开局，实际同一时刻只出现一个。
        存档本身由成员 D 实现，这里只是入口状态。
      </Note>
    </div>
  )
}
