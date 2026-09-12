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

/** 流式中间态的字：标题一次到齐、正文一段一段追加。等待卡和结算页下方共用这一段，保证两处观感一致。 */
export function DraftText({ draft }: { draft: StreamDraft }) {
  return (
    <>
      {draft.title && <h2 className="etitle">{draft.title}</h2>}
      <div className="body typing">
        {paragraphs(draft.description).map((text, index) => (
          <p key={index}>{text}</p>
        ))}
      </div>
    </>
  )
}

/** ① 待生成事件：骨架屏 + 转圈，并且明说等待不消耗这一天。
    服务端逐帧输出时，已经写出来的标题和正文会盖掉骨架屏；一帧都没到就是原来那张骨架屏。 */
export function EventWaitingCard({ draft }: { draft?: StreamDraft }) {
  const shown = draft && hasDraft(draft) ? draft : null
  return (
    <div className="card">
      <p className="kicker">今天的日记</p>
      {shown ? (
        <DraftText draft={shown} />
      ) : (
        <div className="skeleton">
          <div className="l" style={{ width: '52%', height: 20 }} />
          <div className="l" style={{ width: '100%' }} />
          <div className="l" style={{ width: '96%' }} />
          <div className="l" style={{ width: '88%' }} />
        </div>
      )}
      <div className="wait">
        <div className="spin" />
        <p className="t">{shown ? '笔尖还在往下走……' : '台灯已经打开了，日记还在路上……'}</p>
        <p className="s">等待不会消耗这一天</p>
      </div>
      <Note>
        「等待和重试不推进天数」是硬验收项，所以界面上要显式安抚，避免玩家反复点。
        流式只改这一张卡的中间部分：终帧之前没有任何东西进存档，所以刷新、重试、切后台的行为都和原来一致。
      </Note>
    </div>
  )
}

/** ④ 待生成结局：四维已经锁定，这一屏只等结尾。 */
export function EndingWaitingCard() {
  return (
    <>
      <div className="card">
        <div className="wait">
          <div className="spin" />
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

/** ② 待选择：选择前不出现任何数值效果（已确认规则）。 */
export function EventCard({
  event,
  disabled,
  onChoose,
}: {
  event: GameEvent
  disabled: boolean
  onChoose: (optionId: string) => void
}) {
  return (
    <div className="card">
      <p className="kicker">{kickerLabel(event.day)}</p>
      <h2 className="etitle">{event.title}</h2>
      <div className="body">
        {paragraphs(event.description).map((text, index) => (
          <p key={index}>{text}</p>
        ))}
      </div>
      <p className="ask">这时候你会——</p>
      {event.options.map(option => {
        const [line, motive] = splitOption(option.text)
        return (
          <button className="opt" key={option.id} disabled={disabled} onClick={() => onChoose(option.id)}>
            {line}
            {motive && <small>{motive}</small>}
          </button>
        )
      })}
      <Note>
        选择前不出现任何数值效果（已确认规则）。三个选项不能有明显「最优解」，这条要反馈给成员 C 写进提示词。
        前几天列表展示的是历史 resultText，成员 D 存档里对应 history 字段。
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
