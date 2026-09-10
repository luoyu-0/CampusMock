/* 走查用的预置快照：让 5 个游戏屏 + 2 个错误屏在不等后端、不等模型的情况下都能稳定到达。
   第 5 天那一组的属性与历史是按 design/prototype.html 上的数字反推的：
   待选择时 精力 5 / 金钱 940，选第一个选项结算后 精力 3 / 金钱 940（金钱「没变」）。 */

import type { Snapshot } from '../state/types'
import { TOTAL_DAYS, advanceOneDay, eventForDay, fullWalkSnapshot, initialSnapshot, snapshotAtDay5 } from './script'
import { buildEnding } from './ending'

export type PresetId = 'fresh' | 'pendingEvent' | 'pendingChoice' | 'showResult' | 'pendingEnding' | 'ended'

export const PRESETS: { id: PresetId; label: string; hold: boolean }[] = [
  { id: 'fresh', label: '跑完整 14 天', hold: false },
  { id: 'pendingEvent', label: '① 待生成事件', hold: true },
  { id: 'pendingChoice', label: '② 待选择', hold: true },
  { id: 'showResult', label: '③ 展示结果', hold: true },
  { id: 'pendingEnding', label: '④ 待生成结局', hold: true },
  { id: 'ended', label: '⑤ 已结束', hold: true },
]

/** 第 5 天前夕：前 4 天按剧本的 walk 选项结算，数值正好等于原型顶栏。 */
function day4Settled(): Snapshot {
  return snapshotAtDay5()
}

export function presetSnapshot(id: PresetId): Snapshot {
  switch (id) {
    case 'fresh':
      return initialSnapshot()
    case 'pendingEvent':
      return { ...day4Settled(), phase: 'pendingEvent', currentEvent: null }
    case 'pendingChoice':
      return {
        ...day4Settled(),
        revision: day4Settled().revision + 1,
        phase: 'pendingChoice',
        currentEvent: eventForDay(5),
      }
    case 'showResult':
      return advanceOneDay(day4Settled(), eventForDay(5), 0)
    case 'pendingEnding':
      return fullWalkSnapshot()
    case 'ended': {
      const walked = fullWalkSnapshot()
      return {
        ...walked,
        revision: walked.revision + 1,
        phase: 'ended',
        currentEvent: null,
        ending: buildEnding(walked.attributes),
      }
    }
  }
}

/** 走查面板底部那行小字：当前停在哪个状态、数值规模对不对。 */
export function presetSummary(snapshot: Snapshot): string {
  return `已写 ${snapshot.history.length}/${TOTAL_DAYS} 篇 · 精力 ${snapshot.attributes.energy} · 金钱 ${snapshot.attributes.money}`
}
