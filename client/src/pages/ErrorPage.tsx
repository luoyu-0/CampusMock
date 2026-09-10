import { Chrome, chromeDay, chromeTitle } from '../components/Chrome'
import { ErrorCard, Note } from '../components/Cards'
import type { ApiError, Snapshot } from '../state/types'
import type { GameActions } from '../state/useGame'

/* 两类错误屏。可重试保留顶栏（玩家要看得见自己停在哪一天），
   不可重试按原型一样只留一张卡，不给任何会写存档的按钮。 */
export function ErrorPage({
  error,
  snapshot,
  busy,
  actions,
}: {
  error: ApiError
  snapshot: Snapshot | null
  busy: boolean
  actions: GameActions
}) {
  const retryable = error.retryable
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
          <button className="btn muted" onClick={actions.dismissError}>
            先回到上一页
          </button>
        </div>
      ) : (
        <div className="btn-row">
          <button className="btn muted" disabled>
            查看运行说明
          </button>
        </div>
      )}
      <p className="hint">
        {retryable ? '重试不会消耗这一天，也不会重复结算' : '这里刻意不给「重新开始」，避免误删存档'}
      </p>
      <Note>
        {retryable
          ? '对应 error.retryable = true（模型超时、临时调用失败、字段缺失或越界）。文案统一「简体中文、不暴露 API 密钥与原始供应商报错」。'
          : '对应「存档格式或规则版本不支持」。开发规划要求保留原数据、提示无法读取、不静默清空，所以这一屏没有任何会写存档的按钮。「查看运行说明」暂时禁用：仓库根目录的 Deploy.md 已经有了，但打包后的前端没有指向它的地址，要定的是「跳仓库文档（局域网设备上不可用）」还是「做一屏内置说明」。'}
      </Note>
    </>
  )
}
