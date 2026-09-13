import { useCallback, useEffect, useRef, useState } from 'react'
import { chooseOption, generateEnding, generateEvent, setProfile } from '../api/gameApi'
import { EMPTY_DRAFT, applyDraftFrame } from '../api/frames'
import { DAY_SCRIPT, TOTAL_DAYS, initialSnapshot } from '../api/script'
import { clearSnapshot, isSnapshot, loadSnapshot, saveSnapshot, STORAGE_KEY } from '../storage'
import { clearProfile, loadProfile } from './profile'
import type { FrameHandler, StreamDraft } from '../api/frames'
import type { ApiError, ApiResult, GameEvent, Snapshot } from './types'
import { isFailure } from './types'

export type ScreenKey =
  | 'start'
  | 'generating'
  | 'choice'
  | 'result'
  | 'endingPending'
  | 'ending'
  | 'errRetry'
  | 'errFatal'

type ApiCall = (snapshot: Snapshot, requestId: string, onFrame: FrameHandler) => Promise<unknown>
type ResumeAfterSave = 'none' | 'generateEvent' | 'generateEnding'

interface PendingSave {
  snapshot: Snapshot
  resume: ResumeAfterSave
}

const UNSUPPORTED: ApiError = {
  code: 'SNAPSHOT_VERSION_UNSUPPORTED',
  message: '存档的版本和当前规则对不上。原始存档仍保留在这台设备上。',
  retryable: false,
}

const INVALID_SAVE: ApiError = {
  code: 'SNAPSHOT_INVALID',
  message: '这份存档内容不完整或已经损坏。原始存档没有被覆盖。',
  retryable: false,
}

const STORAGE_UNAVAILABLE: ApiError = {
  code: 'STORAGE_UNAVAILABLE',
  message: '浏览器目前无法读取或修改本机存档，请检查隐私设置和存储权限。',
  retryable: false,
}

const EXTERNAL_CHANGE: ApiError = {
  code: 'SAVE_CHANGED_IN_ANOTHER_TAB',
  message: '另一个标签页已经更新了这局日记。请重新载入，以免覆盖较新的进度。',
  retryable: false,
}

function screenOfPhase(snapshot: Snapshot): ScreenKey {
  switch (snapshot.phase) {
    case 'pendingEvent':
      return 'generating'
    case 'pendingChoice':
      return 'choice'
    case 'showResult':
      return 'result'
    case 'pendingEnding':
      return 'endingPending'
    case 'ended':
      return 'ending'
  }
}

const SCREEN_ORDER: ScreenKey[] = ['start', 'generating', 'choice', 'result', 'endingPending', 'ending', 'errRetry', 'errFatal']

function sceneFor(day: number, screen: ScreenKey): number {
  return (((day - 1 + SCREEN_ORDER.indexOf(screen)) % 5) + 5) % 5 + 1
}

function createRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `request-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function isApiResult(value: unknown): value is ApiResult {
  if (!value || typeof value !== 'object') return false
  const response = value as Record<string, unknown>
  if (typeof response.requestId !== 'string') return false
  if ('error' in response) {
    const error = response.error
    return (
      typeof error === 'object' &&
      error !== null &&
      typeof (error as Record<string, unknown>).code === 'string' &&
      typeof (error as Record<string, unknown>).message === 'string' &&
      typeof (error as Record<string, unknown>).retryable === 'boolean'
    )
  }
  return Number.isSafeInteger(response.baseRevision) && 'snapshot' in response
}

/* 「在想」只能靠时间猜：服务端不告诉我们它写到哪、卡在哪，只看上一帧离现在多久。
   假服务两帧之间最多两百来毫秒（mockApi 把 420~1150ms 均分给六七帧），1.2 秒远在它之上，
   所以离线走查里不会一闪一闪地切进思考态。真模型第一帧要等多久我没测过，可能超过这个阈值。 */
const FRAME_IDLE_MS = 1200

export function useGame() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  const [entered, setEntered] = useState(false)
  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null)
  const [recoveryRaw, setRecoveryRaw] = useState<string | null>(null)
  /** 只在事件生成的那几秒存在：流式帧写进来的标题与正文草稿。不进快照、不进 localStorage。 */
  const [draft, setDraft] = useState<StreamDraft>(EMPTY_DRAFT)
  /** 笔尖"停一下在想"：请求在飞，但上一帧已经等了一阵子（或者一帧都没来过）。同样不进存档。 */
  const [thinking, setThinking] = useState(false)

  const currentSnapshot = useRef<Snapshot | null>(null)
  const requestGeneration = useRef(0)
  const lastCall = useRef<{ base: Snapshot; call: ApiCall } | null>(null)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const applySnapshot = useCallback((next: Snapshot | null) => {
    currentSnapshot.current = next
    setSnapshot(next)
  }, [])

  /** 重新计时：请求刚发起、每来一帧都算"还在写"。到点还没动静就把笔尖切进思考态。 */
  const watchForStall = useCallback(() => {
    if (idleTimer.current !== null) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => {
      idleTimer.current = null
      setThinking(true)
    }, FRAME_IDLE_MS)
  }, [])

  const stopWatchingStall = useCallback(() => {
    if (idleTimer.current !== null) {
      clearTimeout(idleTimer.current)
      idleTimer.current = null
    }
    setThinking(false)
  }, [])

  const invalidateRequests = useCallback(() => {
    requestGeneration.current += 1
    lastCall.current = null
    setBusy(false)
    setDraft(EMPTY_DRAFT)
    stopWatchingStall()
  }, [stopWatchingStall])

  const persistAndApply = useCallback(
    (next: Snapshot, resume: ResumeAfterSave = 'none'): boolean => {
      if (!saveSnapshot(next)) {
        setPendingSave({ snapshot: next, resume })
        return false
      }
      setPendingSave(null)
      applySnapshot(next)
      return true
    },
    [applySnapshot],
  )

  const dispatch = useCallback(
    async (base: Snapshot, call: ApiCall): Promise<Snapshot | null> => {
      const token = ++requestGeneration.current
      const requestId = createRequestId()
      lastCall.current = { base, call }
      setBusy(true)
      setError(null)
      setDraft(EMPTY_DRAFT)
      stopWatchingStall()
      watchForStall()

      /* 流式帧是在 await 期间一帧一帧进来的。请求一旦结束或者已经被更新的一次请求顶掉，
         迟到的帧必须扔掉，否则上一天写了一半的字会串进下一天的等待屏。 */
      let settled = false
      const onFrame: FrameHandler = frame => {
        if (settled || token !== requestGeneration.current) return
        setDraft(prev => applyDraftFrame(prev, frame))
        setThinking(false)
        watchForStall()
      }

      let result: unknown
      try {
        result = await call(base, requestId, onFrame)
      } catch {
        if (token !== requestGeneration.current) return null
        setBusy(false)
        setError({ code: 'NETWORK_ERROR', message: '暂时联系不上服务，当前进度没有改变。', retryable: true })
        return null
      } finally {
        settled = true
        // 只清自己这一次的计时：被新请求顶掉后新请求的计时器已经挂上，旧请求不能去撤它。
        if (token === requestGeneration.current) stopWatchingStall()
      }

      if (token !== requestGeneration.current) return null
      setBusy(false)
      if (!isApiResult(result)) {
        setError({ code: 'INVALID_RESPONSE', message: '服务返回的数据格式不完整，我没有写入存档。', retryable: true })
        return null
      }
      if (result.requestId !== requestId) {
        setError({ code: 'REQUEST_MISMATCH', message: '收到了一份不属于当前操作的响应，我没有采纳它。', retryable: true })
        return null
      }
      if (isFailure(result)) {
        setError(result.error)
        return null
      }

      const current = currentSnapshot.current
      const responseMatchesBase =
        result.baseRevision === base.revision &&
        result.snapshot.gameId === base.gameId &&
        current?.gameId === base.gameId &&
        current.revision === base.revision
      if (!responseMatchesBase) {
        setError({ code: 'REVISION_CONFLICT', message: '这一步的响应回来晚了，我没有采纳它。', retryable: true })
        return null
      }
      if (!isSnapshot(result.snapshot)) {
        setError({ code: 'INVALID_RESPONSE', message: '服务返回的数据不完整，我没有写入存档。', retryable: true })
        return null
      }

      lastCall.current = null
      return persistAndApply(result.snapshot) ? result.snapshot : null
    },
    [persistAndApply, stopWatchingStall, watchForStall],
  )

  const stepFrom = useCallback(
    (base: Snapshot) => {
      if (base.phase === 'pendingEvent') void dispatch(base, generateEvent)
      else if (base.phase === 'pendingEnding') void dispatch(base, generateEnding)
    },
    [dispatch],
  )

  useEffect(() => {
    // 档案不进快照，所以刷新后要继续这一局时必须先把它交回适配层，否则结局那次生成就丢了档案
    setProfile(loadProfile())
    const loaded = loadSnapshot()
    if (loaded.kind === 'ok') {
      applySnapshot(loaded.snapshot)
      return
    }
    if (loaded.kind === 'unsupported') {
      setRecoveryRaw(loaded.raw)
      setError(UNSUPPORTED)
    } else if (loaded.kind === 'invalid') {
      setRecoveryRaw(loaded.raw)
      setError(INVALID_SAVE)
    } else if (loaded.kind === 'unavailable') {
      setError(STORAGE_UNAVAILABLE)
    }
  }, [applySnapshot])

  useEffect(() => {
    const handleExternalSave = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || event.storageArea !== localStorage) return
      invalidateRequests()
      setPendingSave(null)
      setRecoveryRaw(event.newValue)
      setError(EXTERNAL_CHANGE)
      setEntered(true)
    }
    window.addEventListener('storage', handleExternalSave)
    return () => window.removeEventListener('storage', handleExternalSave)
  }, [invalidateRequests])

  useEffect(
    () => () => {
      // 卸载只撤计时器、不碰状态：这时候再 setState 已经没有人接了。
      if (idleTimer.current !== null) clearTimeout(idleTimer.current)
    },
    [],
  )

  const screen: ScreenKey = error
    ? error.retryable
      ? 'errRetry'
      : 'errFatal'
    : !entered || !snapshot
      ? 'start'
      : busy && snapshot.phase === 'showResult'
        ? 'generating'
        : screenOfPhase(snapshot)

  const day = snapshot ? Math.min(snapshot.history.length + 1, TOTAL_DAYS) : 1
  // 生成完成后沿用同一天的背景，避免装饰层重挂载产生闪动。
  const scene = sceneFor(day, screen === 'choice' ? 'generating' : screen)
  const storageBlocked = pendingSave !== null

  const startGame = useCallback(() => {
    invalidateRequests()
    setError(null)
    setRecoveryRaw(null)
    setEntered(true)
    const fresh = initialSnapshot()
    if (persistAndApply(fresh, 'generateEvent')) void dispatch(fresh, generateEvent)
  }, [dispatch, invalidateRequests, persistAndApply])

  const actions = {
    start: startGame,
    resume() {
      if (!snapshot || busy || storageBlocked) return
      setEntered(true)
      stepFrom(snapshot)
    },
    choose(event: GameEvent, optionId: string) {
      if (!snapshot || busy || storageBlocked) return
      void dispatch(snapshot, (base, requestId) => chooseOption(base, event.id, optionId, requestId))
    },
    continueDay() {
      if (!snapshot || busy || storageBlocked) return
      if (snapshot.history.length >= TOTAL_DAYS) void dispatch(snapshot, generateEnding)
      else void dispatch(snapshot, generateEvent)
    },
    retry() {
      const pending = lastCall.current
      if (!pending || busy || storageBlocked) return
      void dispatch(pending.base, pending.call)
    },
    retrySave() {
      const pending = pendingSave
      if (!pending || busy || !saveSnapshot(pending.snapshot)) return
      setPendingSave(null)
      applySnapshot(pending.snapshot)
      if (pending.resume === 'generateEvent') void dispatch(pending.snapshot, generateEvent)
      else if (pending.resume === 'generateEnding') void dispatch(pending.snapshot, generateEnding)
    },
    dismissError() {
      lastCall.current = null
      setError(null)
      // 待生成事件那一态的界面是一张没有按钮的骨架屏，只清错误等于把玩家放进去干等，所以退出要退回开始页，
      // 让玩家从「继续上次的日记」重新发起这一步。pendingEnding 不需要这个特例了：
      // GamePage 在结尾请求没在飞时渲染的是第 14 篇结算页，那颗「去写结尾」就是这一步的重入口。
      if (currentSnapshot.current?.phase === 'pendingEvent') setEntered(false)
    },
    restart: startGame,
    runFullWalk() {
      invalidateRequests()
      setError(null)
      setRecoveryRaw(null)
      setEntered(true)
      const fresh = initialSnapshot()
      if (!persistAndApply(fresh)) return

      void (async () => {
        let current = fresh
        for (const draft of DAY_SCRIPT) {
          const generated = await dispatch(current, generateEvent)
          if (!generated?.currentEvent) return
          const option = generated.currentEvent.options[draft.walk]
          const settled = await dispatch(generated, (base, requestId) =>
            chooseOption(base, generated.currentEvent!.id, option.id, requestId),
          )
          if (!settled) return
          current = settled
        }
        await dispatch(current, generateEnding)
      })()
    },
    loadAt(next: Snapshot, hold: boolean) {
      invalidateRequests()
      setError(null)
      setRecoveryRaw(null)
      setEntered(true)
      const resume: ResumeAfterSave = hold ? 'none' : next.phase === 'pendingEnding' ? 'generateEnding' : 'generateEvent'
      if (persistAndApply(next, resume) && !hold) stepFrom(next)
    },
    forgetSave() {
      invalidateRequests()
      if (!clearSnapshot()) {
        setError(STORAGE_UNAVAILABLE)
        return
      }
      clearProfile()
      setProfile(null)
      setPendingSave(null)
      setRecoveryRaw(null)
      setError(null)
      setEntered(false)
      applySnapshot(null)
    },
    reloadLatest() {
      window.location.reload()
    },
    exportBrokenSave() {
      if (recoveryRaw === null) return
      const blob = new Blob([recoveryRaw], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `campusmock-save-backup-${new Date().toISOString().slice(0, 10)}.json`
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 0)
    },
    clearBrokenSave() {
      const confirmed = window.confirm('确定已经备份并清除这份无法读取的存档吗？此操作无法撤销。')
      if (!confirmed) return
      invalidateRequests()
      if (!clearSnapshot()) {
        setError(STORAGE_UNAVAILABLE)
        return
      }
      clearProfile()
      setProfile(null)
      setPendingSave(null)
      setRecoveryRaw(null)
      setError(null)
      setEntered(false)
      applySnapshot(null)
    },
  }

  return {
    screen,
    snapshot,
    busy,
    error,
    scene,
    draft,
    thinking,
    saveFailed: storageBlocked,
    canExportBrokenSave: recoveryRaw !== null,
    actions,
  }
}

export type GameActions = ReturnType<typeof useGame>['actions']
