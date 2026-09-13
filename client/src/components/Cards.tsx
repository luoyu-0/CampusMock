import type { ReactNode } from 'react'
import type { Effects, GameEvent, HistoryEntry } from '../state/types'
import { hasDraft } from '../api/frames'
import type { StreamDraft } from '../api/frames'
import { kickerLabel } from '../state/calendar'
import { deltaClass, formatDelta, paragraphs, splitOption } from '../format'

/** 设计标注：只在走查面板勾上「设计标注」后才显示，玩家看不到。 */
export function Note({ children }: { children: ReactNode }) {
  return <div className="note">{children}</div>
}

/** 等生成时的那支笔，替掉转圈圈：米黄纸、淡横线、金属笔尖落在纸上，暖光呼吸，蓝墨迹沿横线缓慢延伸。
    只有形状在这里——颜色、节奏、全部动效都在 global.css 的 `.wait .pen` 一节，改观感不用回这个文件。
    渐变的每一档色值同样留在 global.css，改配色不用碰这个文件。
    四层嵌套各管一个属性（走纸 → 换行 → 抬笔 → 浮动），因为同一个元素上两条动画会互相顶掉。
    thinking 只加一个类名：冻住书写、笔尖原地点触、光晕跟着闪，动效全在 CSS 里分岔。
    aria-hidden 是因为旁边那句「笔尖还在往下走」才是给读屏的状态文字，这幅画只是它的重复。 */
export function PenRest({ thinking = false }: { thinking?: boolean }) {
  return (
    <svg className={thinking ? 'pen is-thinking' : 'pen'} viewBox="0 0 180 108" aria-hidden="true">
      <defs>
        <linearGradient id="cm-pen-metal" x1="0" y1="0" x2="1" y2="0">
          <stop className="mt-1" offset="0" />
          <stop className="mt-2" offset=".38" />
          <stop className="mt-3" offset=".62" />
          <stop className="mt-4" offset="1" />
        </linearGradient>
        <radialGradient id="cm-pen-warm">
          <stop className="wm-1" offset="0" />
          <stop className="wm-2" offset="1" />
        </radialGradient>
        <radialGradient id="cm-pen-wet">
          <stop className="wt-1" offset="0" />
          <stop className="wt-2" offset="1" />
        </radialGradient>
      </defs>

      <g className="pn-leaf">
        <path className="pn-blade" d="M36 2c5 2 7 7 5 12-2 5-8 6-11 3-3-4 0-10 6-15z" />
      </g>
      <g className="pn-leaf pn-leaf2">
        <path className="pn-blade pn-blade2" d="M148 0c4 2 6 6 4 10-2 4-7 5-9 2-2-3 0-8 5-12z" />
      </g>

      <g className="pn-sheet">
        <rect className="pn-paper" x="10" y="10" width="160" height="88" rx="9" />
        <path className="pn-rule" d="M24 36H156" />
        <path className="pn-rule" d="M24 54H156" />
        <path className="pn-rule" d="M24 72H156" />
        <path className="pn-rule" d="M24 90H118" />

        {/* pathLength=100 把这两条线归一化，CSS 里的虚线偏移就能写成百分比，不必去量真实长度。
            终点 (150 70) 与 (110 88) 是笔尖走纸的两个端点，改动线形要连着改 cm-pen-hand 的百分比。 */}
        <g className="pn-written">
          <path
            className="pn-ink pn-ink1"
            pathLength={100}
            d="M30 70 C42 65 54 75 66 70 C78 65 90 75 102 70 C114 65 126 75 138 70 C142 68 146 69 150 70"
          />
          <path
            className="pn-ink pn-ink2"
            pathLength={100}
            d="M30 88 C40 83 50 93 60 88 C70 83 80 93 90 88 C96 85 104 90 110 88"
          />
        </g>
      </g>

      <g className="pn-hand">
        <g className="pn-line">
          <g className="pn-lift">
            <g className="pn-tip">
              <circle className="pn-glow" cx="108" cy="70" r="17" />
              <ellipse className="pn-wet" cx="108" cy="73" rx="7" ry="3.4" />
              <rect className="pn-holder" x="99" y="20" width="18" height="15" rx="4" />
              <path className="pn-body" d="M108 70c-7-12-9-24-8-35h16c1 11-1 23-8 35z" />
              <path className="pn-slit" d="M108 63V44" />
              <circle className="pn-hole" cx="108" cy="41" r="2.8" />
            </g>
          </g>
        </g>
      </g>
    </svg>
  )
}

/** ④ 待生成结局：四维已经锁定，这一屏只等结尾。 */
export function EndingWaitingCard() {
  return (
    <>
      <div className="card">
        <div className="wait">
          {/* 结局这一路服务端没有逐帧接口，永远收不到帧，所以笔尖一直停在"想"的状态是实话。 */}
          <PenRest thinking />
          <p className="t">十四天的日记摊在桌上，正在为你写结尾……</p>
          <p className="s">属性已经锁定，这一步只重试结局，不会重做第 14 天</p>
        </div>
        <Note>
          这一屏必须和「① 待生成事件」区分开：这里四维已经确定，玩家知道结果不会因重试而改变。
          成员 B 已确认第 14 天结算与结局生成分两次保存。
        </Note>
      </div>
      <button className="btn muted" disabled>
        重试需要时才会出现在这里
      </button>
    </>
  )
}

/** 生成和选择共用一张卡片，终帧到达时保留标题、正文节点，只追加选项。
    笔尖与"刚到那几个字洇一下墨"都挂在这一支：`!event` 就是还在生成，终帧一到整个 wait 块消失、正文换成 event 的字。
    正文的 <p> 列表始终由同一个表达式产生，所以换成真事件时只有文字变、节点不重挂。
    段落是按整篇文本切的，所以刚到的 chunk 结尾正好落在换行上时 `endsWith` 拿不到尾巴——那就按原样渲染，宁可不动画也不能掉字。 */
export function EventCard({
  event,
  day,
  draft,
  thinking = false,
  disabled,
  onChoose,
}: {
  event: GameEvent | null
  day: number
  draft?: StreamDraft
  /** 上一帧到现在已经等了一会儿：笔尖改成原地点触。 */
  thinking?: boolean
  disabled: boolean
  onChoose: (optionId: string) => void
}) {
  const parts = paragraphs(event?.description ?? draft?.description ?? '')
  const generating = !event
  const fresh =
    generating && draft?.fresh && parts[parts.length - 1]?.endsWith(draft.fresh) ? draft.fresh : null
  const title = event?.title ?? draft?.title ?? ''
  return (
    <div className="card">
      <p className="kicker">{kickerLabel(day)}</p>
      <h2 className="etitle">{generating && title ? <span className="ink-in">{title}</span> : title}</h2>
      <div className={event ? 'body' : 'body typing'}>
        {parts.map((text, index) => (
          <p key={index}>
            {fresh && index === parts.length - 1 ? text.slice(0, text.length - fresh.length) : text}
            {fresh && index === parts.length - 1 && (
              <span className="ink-in" key={draft?.chunk}>
                {fresh}
              </span>
            )}
          </p>
        ))}
      </div>
      {!event && (
        <div className="wait" role="status">
          <PenRest thinking={thinking} />
          <p className="t">
            {!draft || !hasDraft(draft)
              ? '台灯已经打开了，日记还在路上……'
              : thinking
                ? '笔尖停了一下，在想下一句……'
                : '笔尖还在往下走……'}
          </p>
          <p className="s">等待不会消耗这一天</p>
        </div>
      )}
      {event && <p className="ask">这时候你会——</p>}
      {event?.options.map((option, index) => {
        const [line, motive] = splitOption(option.text)
        return (
          <button className="opt option-reveal" style={{ animationDelay: `${index * 160}ms` }} key={option.id} disabled={disabled} onClick={() => onChoose(option.id)}>
            {line}
            {motive && <small>{motive}</small>}
          </button>
        )
      })}
      <Note>
        选择前不出现任何数值效果（已确认规则）。三个选项不能有明显「最优解」，这条要反馈给成员 C 写进提示词。
        前几天列表展示的是历史 resultText，成员 D 存档里对应 history 字段。
        「等待和重试不推进天数」是硬验收项，所以生成中要显式写在下面那句话里，避免玩家反复点。
      </Note>
    </div>
  )
}

function DeltaRow({ name, value, tone }: { name: string; value: number; tone: 'down' | 'up' }) {
  return (
    <div className={`d ${tone}`}>
      <span className="name">{name}</span>
      <span className={deltaClass(value)}>{formatDelta(value)}</span>
    </div>
  )
}

/** ③ 展示结果：只直接展示精力与金钱；resultText 第一段是标题，后面是正文。 */
export function ResultCard({ entry }: { entry: HistoryEntry }) {
  const [heading, ...rest] = paragraphs(entry.resultText)
  const effects: Effects = entry.effects
  return (
    <div className="card">
      <p className="chosen">
        你选择了 · <b>{entry.chosenText}</b>
      </p>
      <h2 className="etitle" style={{ fontSize: 20 }}>
        {heading}
      </h2>
      {rest.length > 0 && (
        <div className="body">
          {rest.map((text, index) => (
            <p key={index}>{text}</p>
          ))}
        </div>
      )}
      <div className="delta">
        <DeltaRow name="精力" value={effects.energy} tone="down" />
        <DeltaRow name="金钱" value={effects.money} tone="up" />
      </div>
      <Note>
        只直接展示精力与金钱的增减；这一项变化为 0 时写「没变」而不是 0，避免像表格。
        学业与社交已写入 history，但界面上不出现数字，只由上面那段文字暗示。
      </Note>
    </div>
  )
}

const RETRY_ICON = (
  <svg
    className="err-ico"
    viewBox="0 0 48 48"
    fill="none"
    stroke="#d9534f"
    strokeWidth="3"
    strokeLinecap="round"
  >
    <circle cx="24" cy="24" r="19" />
    <path d="M24 14v13M24 33v.5" />
  </svg>
)

const FATAL_ICON = (
  <svg
    className="err-ico"
    viewBox="0 0 48 48"
    fill="none"
    stroke="#d9534f"
    strokeWidth="3"
    strokeLinecap="round"
  >
    <rect x="9" y="7" width="30" height="34" rx="4" />
    <path d="M16 18h16M16 26h16M16 34h9" />
  </svg>
)

/** 两类错误共用一张卡：可重试说「今天还没写完」，不可重试说「这本日记我读不懂」。 */
export function ErrorCard({ retryable, message }: { retryable: boolean; message: string }) {
  return (
    <div className="card err">
      {retryable ? RETRY_ICON : FATAL_ICON}
      <p className="t">{retryable ? '今天的日记还没写完' : '这本日记我读不懂'}</p>
      <p className="m">{message}</p>
    </div>
  )
}
