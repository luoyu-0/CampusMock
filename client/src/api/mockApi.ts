/* 本地假 API。刻意做成「无状态 + 纯函数」，跟真接口一样：浏览器把完整快照发过来，
   这里返回下一份快照。所以重复提交同一份快照必然得到同一份结果，不会二次累加。
   换成成员 B 的真服务时，只需要把这个文件的三个函数换成 fetch，其他代码不用动。 */

import type { ApiError, AttributeKey, ErrorResponse, GameEvent, Snapshot, SuccessResponse } from '../state/types'
import type { FrameHandler, StreamFrame } from './frames'
import { TOTAL_DAYS, advanceOneDay, eventForDay } from './script'
import { buildEnding } from './ending'

export type FaultKind = 'none' | 'retryable' | 'fatal' | 'fatalServer'

let fault: FaultKind = 'none'

/** 只有走查面板会调它：让下一次请求返回失败响应，用来验可重试、存档类不可重试、服务端类不可重试三屏。 */
export function setFault(next: FaultKind) {
  fault = next
}

const LATENCY = { min: 420, max: 1150 }

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, Math.max(0, ms)))
}

function pickLatency() {
  return LATENCY.min + Math.random() * (LATENCY.max - LATENCY.min)
}

/** 假服务也逐帧输出：把标题和正文切片，在原来那段等待里均匀发完，终帧之后才返回响应。
    所以开流式不会让某一天变慢，只是等待屏上有了在往下写的字。 */
async function spread(frames: StreamFrame[], onFrame: FrameHandler | undefined, ms: number) {
  if (!onFrame || frames.length === 0) {
    await sleep(ms)
    return
  }
  const step = ms / (frames.length + 1)
  let elapsed = 0
  for (const frame of frames) {
    await sleep(step)
    elapsed += step
    onFrame(frame)
  }
  await sleep(ms - elapsed)
}

function eventFrames(event: GameEvent): StreamFrame[] {
  const pieces: StreamFrame[] = [{ k: 'title', v: event.title }]
  for (let at = 0; at < event.description.length; at += 16) {
    pieces.push({ k: 'desc', v: event.description.slice(at, at + 16) })
  }
  return pieces
}

/** base 是请求方发来的那份快照，next 是本次转换的结果；
 *  baseRevision 必须取 base，客户端靠它判断响应有没有过期。 */
function ok(requestId: string, base: Snapshot, next: Snapshot): SuccessResponse {
  return { requestId, baseRevision: base.revision, snapshot: next }
}

function fail(requestId: string, code: string, message: string, retryable: boolean): ErrorResponse {
  return { requestId, error: { code, message, retryable } satisfies ApiError }
}

/* 游戏规则里的单次增减范围。假数据本来就在范围内，这条校验是照着 B 的服务端校验写的：
   真模型给出越界值时，界面要走的分支已经在原型里画好了。 */
const RANGE: Record<AttributeKey, [number, number]> = {
  academics: [-2, 3],
  social: [-2, 3],
  energy: [-2, 2],
  money: [-300, 300],
}

function outOfRange(event: GameEvent): boolean {
  const keys = Object.keys(RANGE) as AttributeKey[]
  return event.options.some(option =>
    keys.some(key => {
      const [lo, hi] = RANGE[key]
      const value = option.effects[key]
      return !Number.isInteger(value) || value < lo || value > hi
    }),
  )
}

function injectedFault(requestId: string): ErrorResponse | null {
  if (fault === 'none') return null
  const kind = fault
  fault = 'none'
  if (kind === 'retryable') {
    return fail(requestId, 'MODEL_TIMEOUT', '网络好像打了个盹，前面写好的内容都还在。', true)
  }
  if (kind === 'fatalServer') {
    // code 与文案都照抄真服务：controller 把 AiError 的 AI_CONFIG 改名成 AI_CONFIG_ERROR 后原样透传这一句。
    return fail(requestId, 'AI_CONFIG_ERROR', '心神不定，不知如何落笔（未配置API密钥）', false)
  }
  return fail(
    requestId,
    'SNAPSHOT_VERSION_UNSUPPORTED',
    '存档的版本和当前规则对不上。我没有改动它，也没有清空它——你之前的记录还在原处。',
    false,
  )
}

/** POST /api/events/generate */
export async function generateEvent(
  snapshot: Snapshot,
  requestId: string,
  onFrame?: FrameHandler,
): Promise<SuccessResponse | ErrorResponse> {
  const ms = pickLatency()
  const injected = injectedFault(requestId)
  if (injected) {
    await sleep(ms)
    return injected
  }

  // 待选择说明有一局事件已经生成好但还没结算：直接返回它，不重新抽取（接口约定的幂等分支）
  if (snapshot.phase === 'pendingChoice' && snapshot.currentEvent) {
    await sleep(ms)
    return ok(requestId, snapshot, snapshot)
  }

  const day = snapshot.history.length + 1
  if (day > TOTAL_DAYS) {
    await sleep(ms)
    return fail(requestId, 'GAME_ALREADY_DONE', '两周已经写满了。', false)
  }

  const event = eventForDay(day)
  if (outOfRange(event)) {
    await sleep(ms)
    return fail(requestId, 'EFFECT_OUT_OF_RANGE', '这一次生成的数值不对，我重新问一次。', true)
  }

  await spread(eventFrames(event), onFrame, ms)

  const next: Snapshot = {
    ...snapshot,
    revision: snapshot.revision + 1,
    phase: 'pendingChoice',
    currentEvent: event,
  }
  return ok(requestId, snapshot, next)
}

/** POST /api/events/choose —— 确定性算术，不调模型 */
export async function chooseOption(
  snapshot: Snapshot,
  eventId: string,
  optionId: string,
  requestId: string,
): Promise<SuccessResponse | ErrorResponse> {
  await sleep(pickLatency())
  const injected = injectedFault(requestId)
  if (injected) return injected

  // 该事件已在历史里：返回既有结算，绝不第二次累加
  if (snapshot.history.some(entry => entry.eventId === eventId)) {
    return ok(requestId, snapshot, snapshot)
  }

  const event = snapshot.currentEvent
  if (!event || event.id !== eventId || snapshot.phase !== 'pendingChoice') {
    return fail(requestId, 'STAGE_MISMATCH', '这一步现在不能做。', false)
  }
  const index = event.options.findIndex(option => option.id === optionId)
  if (index < 0) {
    return fail(requestId, 'OPTION_NOT_FOUND', '找不到这个选项。', false)
  }

  return ok(requestId, snapshot, advanceOneDay(snapshot, event, index))
}

/** POST /api/endings/generate */
export async function generateEnding(snapshot: Snapshot, requestId: string): Promise<SuccessResponse | ErrorResponse> {
  await sleep(pickLatency())
  const injected = injectedFault(requestId)
  if (injected) return injected

  // 结局已经生成过就返回保存的那一份，刷新和重试都拿同一个
  if (snapshot.ending) {
    return ok(requestId, snapshot, snapshot)
  }
  if (snapshot.history.length < TOTAL_DAYS) {
    return fail(requestId, 'GAME_NOT_FINISHED', '还没写完两周。', false)
  }

  const next: Snapshot = {
    ...snapshot,
    revision: snapshot.revision + 1,
    phase: 'ended',
    currentEvent: null,
    ending: buildEnding(snapshot.attributes),
  }
  return ok(requestId, snapshot, next)
}
