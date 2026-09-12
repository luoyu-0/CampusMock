import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArtFrame, HERO_LEAVES } from '../components/ArtFrame'
import { HeroArtSvg } from '../components/art/HeroArt'
import { Note } from '../components/Cards'
import { HERO_ART } from '../sceneArt'
import { TOTAL_DAYS } from '../api/script'
import { setProfile } from '../api/gameApi'
import { chromeDay } from '../components/Chrome'
import { MAJOR_MAX, loadProfile, normalizeProfile, saveProfile } from '../state/profile'
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
  const [stored] = useState(() => loadProfile())
  const [gender, setGender] = useState(stored?.gender ?? '')
  const [major, setMajor] = useState(stored?.major ?? '')

  function submit(event: FormEvent) {
    event.preventDefault()
    const next = normalizeProfile({ gender, major })
    saveProfile(next)
    setProfile(next)
    onStart()
  }

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

      {saved ? (
        <>
          <div className="btn-row">
            <button className="btn" disabled={busy} onClick={onResume}>
              继续上次的日记（{resumeLabel(saved)}）
            </button>
          </div>
          {stored && <p className="pf-who">这局记下的你：{stored.gender} · {stored.major}</p>}
        </>
      ) : (
        <form className="pf" onSubmit={submit}>
          <p className="q">你的专业</p>
          <input
            type="text"
            value={major}
            maxLength={MAJOR_MAX}
            placeholder="比如：计算机科学与技术"
            autoComplete="off"
            aria-label="你的专业"
            onChange={event => setMajor(event.target.value)}
          />
          <p className="q">你的性别</p>
          <div className="chips">
            {(['男', '女', '不填'] as const).map(choice => {
              const value = choice === '不填' ? '' : choice
              return (
                <button
                  key={choice}
                  type="button"
                  className="chip"
                  aria-pressed={gender === value}
                  onClick={() => setGender(value)}
                >
                  {choice}
                </button>
              )
            })}
          </div>
          <p className="tip">两项都填，日记里才会提到你的专业；缺任何一项，就当作没认识过你来写。</p>
          <div className="btn-row">
            <button className="btn" type="submit" disabled={busy}>
              开始第一天
            </button>
          </div>
        </form>
      )}

      <p className="hint">进度保存在这台设备的这个浏览器里，共 {TOTAL_DAYS} 天</p>
      <Note>
        两个按钮分别对应「无存档」和「有存档」两种开局，实际同一时刻只出现一个。
        存档本身由成员 D 实现，这里只是入口状态。
        专业与性别是玩家档案，只在开局问一次、之后不给改（提示词里它是玩家固定信息），
        随两个生成请求的顶层 profile 字段发给后端。
      </Note>
    </div>
  )
}
