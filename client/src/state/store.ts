/* 临时存档。成员 D 的 src/storage/ 落地后删掉这个文件，把 App.tsx 里的一行 import 换过去即可，
   其余代码只通过 load/save/clear 三个函数碰持久化。
   键名先占一个，等 D 定：localStorage 按访问源隔离，换端口就等于换档。 */

import type { Snapshot } from './types'
import { SCHEMA_VERSION } from '../api/script'

export const STORAGE_KEY = 'campusmock:snapshot'

export type LoadResult = { kind: 'none' } | { kind: 'ok'; snapshot: Snapshot } | { kind: 'unsupported' }

function looksLikeSnapshot(value: unknown): value is Snapshot {
  if (!value || typeof value !== 'object') return false
  const s = value as Snapshot
  if (typeof s.revision !== 'number' || !Array.isArray(s.history)) return false
  const attrs = s.attributes as unknown as Record<string, unknown> | null
  if (!attrs || typeof attrs !== 'object') return false
  return ['academics', 'social', 'energy', 'money'].every(key => Number.isInteger(attrs[key]))
}

export function loadSnapshot(): LoadResult {
  let raw: string | null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    /* 浏览器设置也可能阻止读取：当成没有存档，不去动它 */
    return { kind: 'none' }
  }
  if (!raw) return { kind: 'none' }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return { kind: 'unsupported' }
    if ((parsed as Snapshot).schemaVersion !== SCHEMA_VERSION) return { kind: 'unsupported' }
    return looksLikeSnapshot(parsed) ? { kind: 'ok', snapshot: parsed } : { kind: 'unsupported' }
  } catch {
    return { kind: 'unsupported' }
  }
}

/** 版本对不上时只提示、不改写，玩家原来的记录还在原处（开发规划的硬要求）。 */
export function saveSnapshot(snapshot: Snapshot): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
    return true
  } catch {
    return false
  }
}

export function clearSnapshot() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* 清不掉也只是留着旧档，不影响本局 */
  }
}
