import { Chrome, HistoryList, chromeDay, chromeTitle } from '../components/Chrome'
import { EndingWaitingCard, EventCard, EventWaitingCard, ResultCard } from '../components/Cards'
import { TOTAL_DAYS } from '../api/script'
import type { Snapshot } from '../state/types'
import type { GameActions } from '../state/useGame'

/* ①②③④ 四个中间态共用一个页面：顶栏一样，只有卡片内容和底部按钮按 phase 换。 */
export function GamePage({
  snapshot,
  busy,
  waiting,
  actions,
}: {
  snapshot: Snapshot
  busy: boolean
  /** 请求在飞。只有结算页用它把按钮换成进度条；其余三态显示什么完全由 phase 决定。 */
  waiting: boolean
  actions: GameActions
}) {
  const { phase, history, currentEvent } = snapshot
  const day = chromeDay(history, phase)
  const lastEntry = history[history.length - 1]
  const isLastDay = history.length >= TOTAL_DAYS

  return (
    <>
      <Chrome
        title={chromeTitle(history, phase)}
        day={day}
        attributes={snapshot.attributes}
        dots={day}
      />

      {phase === 'pendingEvent' && <EventWaitingCard />}

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

      {phase === 'showResult' && lastEntry && (
        <>
          <div className={waiting ? 'turning' : undefined}>
            <ResultCard entry={lastEntry} />
          </div>
          {waiting ? (
            <div className="next" role="status">
              <p className="t">{isLastDay ? '正在写结尾' : `正在写第 ${day + 1} 天`}</p>
              <div className="bar" />
            </div>
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

      {phase === 'pendingEnding' && <EndingWaitingCard />}
    </>
  )
}
