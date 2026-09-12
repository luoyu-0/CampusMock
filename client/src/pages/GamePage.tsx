import { Chrome, HistoryList, chromeDay, chromeTitle } from '../components/Chrome'
import { EndingWaitingCard, EventCard, EventWaitingCard, ResultCard } from '../components/Cards'
import { TOTAL_DAYS } from '../api/script'
import type { StreamDraft } from '../api/frames'
import type { Snapshot } from '../state/types'
import type { GameActions } from '../state/useGame'

/* ①②③④ 四个中间态共用一个页面：顶栏一样，只有卡片内容和底部按钮按 phase 换。 */
export function GamePage({
  snapshot,
  busy,
  waiting,
  draft,
  thinking = false,
  actions,
}: {
  snapshot: Snapshot
  busy: boolean
  /** 请求在飞时切换到下一天的事件等待页，或结局等待页。 */
  waiting: boolean
  /** 流式草稿只用于待生成事件页。 */
  draft?: StreamDraft
  /** 上一帧已经等了一会儿：笔尖改成原地点触。 */
  thinking?: boolean
  actions: GameActions
}) {
  const { history, currentEvent } = snapshot
  // 仅切换展示阶段；成功终帧到达前不修改已结算的存档。
  const phase = snapshot.phase === 'showResult' && waiting ? 'pendingEvent' : snapshot.phase
  const day = chromeDay(history, phase)
  const lastEntry = history[history.length - 1]
  const isLastDay = history.length >= TOTAL_DAYS
  /* 第 14 天结算后服务端与 mock 都直接返回 pendingEnding（不是 showResult），这一屏要同时吃两个 phase：
     只有结尾请求真的在飞时才换成等待卡，否则必须把「去写结尾」摆出来——不然玩家面对的是一张没有控件的骨架屏。 */
  const settledScreen = phase === 'showResult' || (phase === 'pendingEnding' && !waiting)

  return (
    <>
      <Chrome
        title={chromeTitle(history, phase)}
        day={day}
        attributes={snapshot.attributes}
        dots={day}
      />

      {phase === 'pendingEvent' && <EventWaitingCard draft={draft} thinking={thinking} />}

      {phase === 'pendingChoice' && currentEvent && (
        <>
          <HistoryList history={history} />
          <EventCard
            event={currentEvent}
            disabled={busy}
            onChoose={optionId => actions.choose(currentEvent, optionId)}
          />
        </>
      )}

      {settledScreen && lastEntry && (
        <>
          <div className={waiting ? 'turning' : undefined}>
            <ResultCard entry={lastEntry} />
          </div>
          {waiting ? (
            <>
              <div className="next" role="status">
                <p className="t">{isLastDay ? '正在写结尾' : `正在写第 ${day + 1} 天`}</p>
                <div className="bar" />
              </div>
            </>
          ) : (
            <>
              <button className="btn" disabled={busy} onClick={actions.continueDay}>
                {isLastDay ? '去写结尾' : '继续写下一篇'}
              </button>
              <p className="hint">
                {isLastDay ? '结尾会在你点之后才开始生成，属性已经不再变化' : `第 ${day + 1} 天会在你点继续之后才开始`}
              </p>
            </>
          )}
        </>
      )}

      {phase === 'pendingEnding' && waiting && <EndingWaitingCard />}
    </>
  )
}
