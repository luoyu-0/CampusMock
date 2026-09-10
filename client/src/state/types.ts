/* 临时类型。字段名严格照 docs/游戏规则.md「建议的事件与选项结构」和 docs/接口约定.md，
   没有自造字段。shared/ 目前只有一个 .gitkeep，等成员 B 定了公共类型放哪，
   就把这些定义挪进 shared 并在这里改成 re-export。 */

export type AttributeKey = 'academics' | 'social' | 'energy' | 'money'

export type Attributes = Record<AttributeKey, number>

/** 四个属性的完整增减，未受影响的一项写 0，不省略。 */
export type Effects = Record<AttributeKey, number>

export type Grade = 'A' | 'B' | 'C' | 'D'

/** 待生成事件 / 待选择 / 展示结果 / 待生成结局 / 已结束 */
export type Phase = 'pendingEvent' | 'pendingChoice' | 'showResult' | 'pendingEnding' | 'ended'

export interface GameOption {
  id: string
  text: string
  effects: Effects
  /** 与事件同时生成、选择后才展示的简短结果叙述 */
  resultText: string
}

export interface GameEvent {
  id: string
  day: number
  title: string
  /** 段落之间用空行分隔，渲染时切成多个 <p> */
  description: string
  options: GameOption[]
}

export interface HistoryEntry {
  day: number
  eventId: string
  optionId: string
  eventTitle: string
  chosenText: string
  resultText: string
  /** 已选选项的效果，后端要用它重算属性 */
  effects: Effects
}

export interface Ending {
  finalAttributes: Attributes
  grades: Record<AttributeKey, Grade>
  title: string
  description: string
  evaluation: string
  advice: string
}

export interface Snapshot {
  schemaVersion: number
  rulesVersion: number
  gameId: string
  /** 每次成功转换递增。客户端只接纳 baseRevision 与当前值相符的响应。 */
  revision: number
  phase: Phase
  /** 完整四维，学业与社交只是界面不显示，不能从状态里删 */
  attributes: Attributes
  /** 长度即已完成天数，下一天天数 = length + 1 */
  history: HistoryEntry[]
  currentEvent: GameEvent | null
  ending: Ending | null
}

export interface ApiError {
  code: string
  message: string
  retryable: boolean
}

export interface SuccessResponse {
  requestId: string
  baseRevision: number
  snapshot: Snapshot
}

export interface ErrorResponse {
  requestId: string
  error: ApiError
}

export type ApiResult = SuccessResponse | ErrorResponse

export function isFailure(result: ApiResult): result is ErrorResponse {
  return 'error' in result
}
