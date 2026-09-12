import * as mockApi from './mockApi'
import { createFrameParser } from './frames'
import type { FrameHandler, StreamFrame } from './frames'
import type { ApiResult, PlayerProfile, Snapshot } from '../state/types'
import type { FaultKind } from './mockApi'

export const API_MODE = import.meta.env.VITE_API_MODE === 'mock' ? 'mock' : 'server'
export const SUPPORTS_FAULT_INJECTION = API_MODE === 'mock'

/** 玩家档案。由开始页写入，只在会调用模型的两个请求上带一份；
    和下面的 setFault 一样是适配层的模块内状态，页面与状态机都不碰它。 */
let currentProfile: PlayerProfile | null = null

export function setProfile(profile: PlayerProfile | null) {
  currentProfile = profile
}

/** 没填档案就整个字段不出现，不发 null，免得服务端为它单独判一次。 */
function bodyWithProfile(requestId: string, snapshot: Snapshot): Record<string, unknown> {
  return currentProfile ? { requestId, snapshot, profile: currentProfile } : { requestId, snapshot }
}

async function post(path: string, body: Record<string, unknown>, onFrame?: FrameHandler): Promise<unknown> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/x-ndjson')) return readFrames(response, onFrame)
  if (!contentType.includes('application/json')) {
    throw new Error(`接口 ${path} 返回了非 JSON 响应`)
  }
  return response.json()
}

/** 逐帧读取。中间帧只交给 onFrame 画在等待卡上，返回值一定是终帧——它才是要进存档的那份完整响应。 */
async function readFrames(response: Response, onFrame?: FrameHandler): Promise<unknown> {
  if (!response.body) throw new Error('服务说它要逐帧输出，但这条连接不支持读流')

  const parser = createFrameParser()
  const decoder = new TextDecoder()
  const reader = response.body.getReader()
  let terminal: unknown = null

  const take = (frames: StreamFrame[]) => {
    for (const frame of frames) {
      if (frame.k === 'end') terminal = frame
      else onFrame?.(frame)
    }
  }

  for (;;) {
    const chunk = await reader.read()
    if (chunk.done) break
    take(parser.push(decoder.decode(chunk.value, { stream: true })))
  }
  take(parser.push(decoder.decode()))
  take(parser.end())

  // 没有终帧就是没写完。抛出去会落进状态机既有的「联系不上服务、进度没变、可重试」分支。
  if (terminal === null) throw new Error('这页日记写到一半就断了')
  return terminal
}

export function setFault(kind: FaultKind) {
  if (SUPPORTS_FAULT_INJECTION) mockApi.setFault(kind)
}

/** 只有事件生成这一路可能吃到流式响应：成员 C 有 generateEventStream，没有 generateEndingStream。
    结局那一路即使哪天也开始逐帧输出，readFrames 仍会拿终帧返回，只是不画草稿。 */
export function generateEvent(
  snapshot: Snapshot,
  requestId: string,
  onFrame?: FrameHandler,
): Promise<ApiResult | unknown> {
  if (API_MODE === 'mock') return mockApi.generateEvent(snapshot, requestId, onFrame)
  return post('/api/events/generate', bodyWithProfile(requestId, snapshot), onFrame)
}

export function chooseOption(
  snapshot: Snapshot,
  eventId: string,
  optionId: string,
  requestId: string,
): Promise<ApiResult | unknown> {
  if (API_MODE === 'mock') return mockApi.chooseOption(snapshot, eventId, optionId, requestId)
  return post('/api/events/choose', { requestId, snapshot, eventId, optionId })
}

export function generateEnding(snapshot: Snapshot, requestId: string): Promise<ApiResult | unknown> {
  if (API_MODE === 'mock') return mockApi.generateEnding(snapshot, requestId)
  return post('/api/endings/generate', bodyWithProfile(requestId, snapshot))
}
