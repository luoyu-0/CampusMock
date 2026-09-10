import { useState } from 'react'
import { PRESETS, presetSnapshot, presetSummary } from '../api/presets'
import type { PresetId } from '../api/presets'
import { setFault } from '../api/mockApi'
import type { FaultKind } from '../api/mockApi'
import type { Snapshot } from '../state/types'
import type { ScreenKey } from '../state/useGame'

const FAULTS: { id: FaultKind; label: string }[] = [
  { id: 'none', label: '不注入失败' },
  { id: 'retryable', label: '下次请求·可重试' },
  { id: 'fatal', label: '下次请求·不可重试' },
]

/* 开发期走查面板。原型里它能直接跳 8 个屏，这里改成了「塞一份快照 + 注入一次失败」，
   因为状态机跑起来之后，中间态只能由真实转换到达，硬跳会造出不存在的状态。 */
export function ProtoBar({
  screen,
  snapshot,
  showNotes,
  onNotes,
  onLoad,
  onForget,
}: {
  screen: ScreenKey
  snapshot: Snapshot | null
  showNotes: boolean
  onNotes: (next: boolean) => void
  onLoad: (next: Snapshot, hold: boolean) => void
  onForget: () => void
}) {
  const [active, setActive] = useState<PresetId | null>(null)
  const [fault, setFaultUi] = useState<FaultKind>('none')

  const pickFault = (kind: FaultKind) => {
    setFault(kind)
    setFaultUi(kind)
  }

  return (
    <div className="proto">
      <span className="label">走查</span>
      {PRESETS.map(preset => (
        <button
          key={preset.id}
          className={active === preset.id ? 'on' : undefined}
          onClick={() => {
            setActive(preset.id)
            onLoad(presetSnapshot(preset.id), preset.hold)
          }}
        >
          {preset.label}
        </button>
      ))}
      <button
        onClick={() => {
          setActive(null)
          onForget()
        }}
      >
        清掉本机存档
      </button>

      <span className="label">失败注入</span>
      {FAULTS.map(item => (
        <button
          key={item.id}
          className={fault === item.id ? 'on' : undefined}
          onClick={() => pickFault(item.id)}
        >
          {item.label}
        </button>
      ))}

      <span className="label">
        {screen}
        {snapshot ? ` · ${presetSummary(snapshot)} · rev ${snapshot.revision}` : ''}
      </span>

      <label className="notes-toggle">
        <input type="checkbox" checked={showNotes} onChange={event => onNotes(event.target.checked)} />
        设计标注
      </label>
    </div>
  )
}
