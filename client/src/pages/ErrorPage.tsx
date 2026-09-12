import { useState } from 'react'
import { Chrome, chromeDay, chromeTitle } from '../components/Chrome'
import { ErrorCard, Note } from '../components/Cards'
import type { ApiError, Snapshot } from '../state/types'
import type { GameActions } from '../state/useGame'

/** 「本机存档出了问题」的已知 code，出自我们自己的读档分支与服务端的结构校验。
    反过来判定更稳：服务端 code 还没冻结，新增的（AI_CONFIG、STAGE_MISMATCH…）一律按生成类处理。 */
const SAVE_ISSUE_CODES = new Set([
  'SNAPSHOT_INVALID',
  'SNAPSHOT_VERSION_UNSUPPORTED',
  'SAVE_CHANGED_IN_ANOTHER_TAB',
  'STORAGE_UNAVAILABLE',
  'INVALID_SNAPSHOT',
])

export function ErrorPage({
  error,
  snapshot,
  busy,
  canExportBrokenSave,
  actions,
}: {
  error: ApiError
  snapshot: Snapshot | null
  busy: boolean
  canExportBrokenSave: boolean
  actions: GameActions
}) {
  const [showHelp, setShowHelp] = useState(false)
  const retryable = error.retryable
  const changedElsewhere = error.code === 'SAVE_CHANGED_IN_ANOTHER_TAB'
  const recoverableSave = error.code === 'SNAPSHOT_INVALID' || error.code === 'SNAPSHOT_VERSION_UNSUPPORTED'
  const isSaveIssue = SAVE_ISSUE_CODES.has(error.code)

  return (
    <>
      {retryable && snapshot && (
        <Chrome
          title={chromeTitle(snapshot.history, snapshot.phase)}
          day={chromeDay(snapshot.history, snapshot.phase)}
          attributes={snapshot.attributes}
        />
      )}
      <ErrorCard retryable={retryable} message={error.message} />

      {retryable ? (
        <div className="btn-row">
          <button className="btn" disabled={busy} onClick={actions.retry}>
            再试一次
          </button>
          <button className="btn muted" disabled={busy} onClick={actions.dismissError}>
            先回到上一页
          </button>
        </div>
      ) : changedElsewhere ? (
        <div className="btn-row">
          <button className="btn" onClick={actions.reloadLatest}>
            重新载入最新进度
          </button>
        </div>
      ) : isSaveIssue ? (
        <div className="btn-row">
          <button className="btn muted" onClick={() => setShowHelp(value => !value)}>
            {showHelp ? '收起处理说明' : '查看处理说明'}
          </button>
          {canExportBrokenSave && (
            <button className="btn muted" onClick={actions.exportBrokenSave}>
              导出原始存档
            </button>
          )}
          {recoverableSave && canExportBrokenSave && (
            <button className="btn muted" onClick={actions.clearBrokenSave}>
              清除坏档并返回开始页
            </button>
          )}
        </div>
      ) : (
        <div className="btn-row">
          <button className="btn" disabled={busy} onClick={actions.dismissError}>
            先回到上一页
          </button>
          <button className="btn muted" onClick={() => setShowHelp(value => !value)}>
            {showHelp ? '收起处理说明' : '查看处理说明'}
          </button>
        </div>
      )}

      {showHelp && (
        <div className="error-help" role="note">
          {isSaveIssue ? (
            <>
              <p>建议先导出原始存档，再检查浏览器是否允许本站使用本机存储。</p>
              <p>若存档来自旧版本，保留备份后可以清除它并开始新的一局；清除前会再次确认。</p>
            </>
          ) : (
            <>
              <p>这一步是服务端没有写出内容，不是你点错了，已经保存的进度没有被改动。</p>
              <p>回去可以看已经写好的部分。同一句提示反复出现时，要查的是服务那边，不用在这台设备上找原因。</p>
            </>
          )}
        </div>
      )}

      <p className="hint">
        {retryable
          ? '重试不会消耗这一天，也不会重复结算'
          : changedElsewhere
            ? '重新载入后将使用另一标签页已经保存的最新状态'
            : isSaveIssue
              ? '无法读取的原始数据不会被自动覆盖或清除'
              : '这一步没有写入，进度仍停在上一次保存的存档'}
      </p>
      <Note>
        {retryable
          ? '对应 error.retryable = true。请求失败时保留原快照，只有成功响应被可靠保存后才推进。'
          : changedElsewhere
            ? '检测到同一访问源下的其他标签页改写了存档，本页已经停止接纳进行中的旧响应。'
            : isSaveIssue
              ? '存档格式、规则版本或浏览器存储不可用时保留原数据，由玩家决定是否备份和清除。'
              : 'retryable = false 但问题不在存档：#19 之后密钥缺失、阶段不匹配都会落到这一屏。成员 C 的 README 定了界面形态只看 retryable，五个 code 不逐个写文案，所以这里只补一条出路和一句不误导的说明。'}
      </Note>
    </>
  )
}
