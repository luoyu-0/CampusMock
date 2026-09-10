import type { Attributes, Grade, HistoryEntry, Phase } from '../state/types'
import { TOTAL_DAYS } from '../api/script'
import { dayLineDate } from '../state/calendar'
import { formatValue, sentence } from '../format'

const ENERGY_ICON = (
  <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" strokeLinejoin="round" />
  </svg>
)

const MONEY_ICON = (
  <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 3v18M8 7l4 5 4-5M6 12h12M7 21h10" strokeLinecap="round" />
  </svg>
)

/* 顶栏：第几天 + 日期 + 精力/金钱。学业与社交不在这里出现（已确认的界面规则）。
   dots 传当前是第几天；错误屏没有进度条，所以留空。 */
export function Chrome({
  title,
  day,
  attributes,
  dots,
}: {
  title: string
  day: number
  attributes: Attributes
  dots?: number
}) {
  return (
    <div className="chrome">
      <div className="day-line">
        <span className="d">{title}</span>
        <span className="w">{dayLineDate(day)}</span>
      </div>
      <div className="hud">
        <span className="pill energy">
          {ENERGY_ICON}
          精力 {formatValue(attributes.energy)}
        </span>
        <span className="pill money">
          {MONEY_ICON}
          金钱 {formatValue(attributes.money)}
        </span>
      </div>
      {dots !== undefined && (
        <div className="dots">
          {Array.from({ length: TOTAL_DAYS }, (_, index) => {
            const n = index + 1
            const cls = n < dots ? 'done' : n === dots ? 'now' : ''
            return <i key={n} className={cls} />
          })}
        </div>
      )}
    </div>
  )
}

const GRADE_LABEL: Record<keyof Attributes, string> = {
  academics: '学业',
  social: '社交',
  energy: '精力',
  money: '金钱',
}

const GRADE_ORDER: (keyof Attributes)[] = ['academics', 'social', 'energy', 'money']

/* 四个各自一档，不是一个总档位。待团队确认：结局页要不要把学业/社交的数字也放出来，
   所以现在只有档位字母，没有数值。 */
export function Grades({ grades }: { grades: Record<keyof Attributes, Grade> }) {
  return (
    <div className="grades">
      {GRADE_ORDER.map(key => (
        <div className="grade" key={key}>
          <span className="n">{GRADE_LABEL[key]}</span>
          <span className={`g ${grades[key].toLowerCase()}`}>{grades[key]}</span>
        </div>
      ))}
    </div>
  )
}

/* 折叠的历史列表读的是 history，每条显示事件标题和结果文字的第一句。 */
export function HistoryList({ history }: { history: HistoryEntry[] }) {
  if (history.length === 0) return null
  return (
    <details className="hist">
      <summary>前面几天</summary>
      <ul>
        {history.map(entry => (
          <li key={entry.eventId}>
            <b>
              第 {entry.day} 天 · {entry.eventTitle}
            </b>
            {sentence(entry.resultText.split('\n')[0])}
          </li>
        ))}
      </ul>
    </details>
  )
}

/** 顶栏标题：结算完的那一天仍然显示「第 N 天」，两周写满后换成总结句。 */
export function chromeTitle(history: HistoryEntry[], phase: Phase): string {
  if (phase === 'pendingEnding' || phase === 'ended') return '两周都写完了'
  return `第 ${history.length + (phase === 'showResult' ? 0 : 1)} 天`
}

/** 顶栏当前是第几天（进度条上「now」那一段）。 */
export function chromeDay(history: HistoryEntry[], phase: Phase): number {
  return phase === 'showResult' ? history.length : Math.min(history.length + 1, TOTAL_DAYS)
}
