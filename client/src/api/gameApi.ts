import * as mockApi from './mockApi'
import type { ApiResult, Snapshot } from '../state/types'
import type { FaultKind } from './mockApi'

export const API_MODE = import.meta.env.VITE_API_MODE === 'mock' ? 'mock' : 'server'
export const SUPPORTS_FAULT_INJECTION = API_MODE === 'mock'

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
  return post('/api/events/generate', { requestId, snapshot })
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
  return post('/api/endings/generate', { requestId, snapshot })
}
