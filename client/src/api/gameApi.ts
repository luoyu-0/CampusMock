import * as mockApi from './mockApi'
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

async function post(path: string, body: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new Error(`接口 ${path} 返回了非 JSON 响应`)
  }
  return response.json()
}

export function setFault(kind: FaultKind) {
  if (SUPPORTS_FAULT_INJECTION) mockApi.setFault(kind)
}

export function generateEvent(snapshot: Snapshot, requestId: string): Promise<ApiResult | unknown> {
  if (API_MODE === 'mock') return mockApi.generateEvent(snapshot, requestId)
  return post('/api/events/generate', bodyWithProfile(requestId, snapshot))
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
