/* 一局的状态机。页面组件只接 props 和回调，不碰 localStorage、不比较 revision、不丢过期响应，
   这些全在这一层（docs/成员-A-前端.md 待协作事项 3 里提给成员 D 的接缝）。
   调用一律「发完整快照、收完整快照」，所以刷新和重试都不会二次累加。 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiError, ApiResult, GameEvent, Snapshot } from './types'
import { isFailure } from './types'
import { TOTAL_DAYS, initialSnapshot } from '../api/script'
import { chooseOption, generateEnding, generateEvent } from '../api/mockApi'
import { clearSnapshot, loadSnapshot, saveSnapshot } from './store'

export type ScreenKey =
  | 'start'
  | 'generating'
  | 'choice'
  | 'result'
  | 'endingPending'
  | 'ending'
  | 'errRetry'
  | 'errFatal'

const UNSUPPORTED: ApiError = {
  code: 'SNAPSHOT_VERSION_UNSUPPORTED',
  message: '存档的版本和当前规则对不上。我没有改动它，也没有清空它——你之前的记录还在原处。',
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

/** 侧景主题：同时满足「可复现」和「每次换屏都看得见变化」两条。
 *  纯取模 `day % 5` 会让同一天里的 ①→②→③ 三次换屏背景一动不动；纯随机则截图无法回溯。
 *  按 (天数 + 屏序号) 取模是确定的，所以同一个状态永远同一套图，而换屏一定换图。 */
const SCREEN_ORDER: ScreenKey[] = ['start', 'generating', 'choice', 'result', 'endingPending', 'ending', 'errRetry', 'errFatal']

function sceneFor(day: number, screen: ScreenKey): number {
  return (((day - 1 + SCREEN_ORDER.indexOf(screen)) % 5) + 5) % 5 + 1
}

export function useGame() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  /* 读到存档也先停在开始页，让「继续上次的日记」这个入口出现（原型注明两个按钮同一时刻只出现一个） */
  const [entered, setEntered] = useState(false)
  const lastCall = useRef<{ base: Snapshot; call: (s: Snapshot) => Promise<ApiResult> } | null>(null)
  /* 存档写不进去（配额满、浏览器拦写入）时不能继续装作存上了 —— 验收项「不假装保存成功」。
     只记一个布尔，不切屏不挡操作：这一局还能继续玩，提示条会说明刷新会退回上一次成功保存的位置。 */
  const [saveFailed, setSaveFailed] = useState(false)
  const persist = useCallback((next: Snapshot) => {
    setSaveFailed(!saveSnapshot(next))
  }, [])

  const dispatch = useCallback(async (base: Snapshot, call: (s: Snapshot) => Promise<ApiResult>) => {
    lastCall.current = { base, call }
    setBusy(true)
    setError(null)
    const result = await call(base)
    setBusy(false)
    if (isFailure(result)) {
      setError(result.error)
      return
    }
    // 只接纳 baseRevision 还跟得上的响应，慢回来的旧快照直接丢掉
    if (result.baseRevision !== base.revision) {
      setError({ code: 'REVISION_CONFLICT', message: '这一步的响应回来晚了，我没有采纳它。', retryable: true })
      return
    }
    lastCall.current = null
    setSnapshot(result.snapshot)
    persist(result.snapshot)
  }, [persist])

  const stepFrom = useCallback(
    (base: Snapshot) => {
      if (base.phase === 'pendingEvent') void dispatch(base, generateEvent)
      else if (base.phase === 'pendingEnding') void dispatch(base, generateEnding)
    },
    [dispatch],
  )

  /* 挂载时恢复存档：只把快照读回来，要不要继续由玩家在开始页决定。 */
  useEffect(() => {
    const loaded = loadSnapshot()
    if (loaded.kind === 'unsupported') {
      setError(UNSUPPORTED)
      return
    }
    if (loaded.kind === 'ok') setSnapshot(loaded.snapshot)
  }, [])

  const screen: ScreenKey = error
    ? error.retryable
      ? 'errRetry'
      : 'errFatal'
    : !entered || !snapshot
      ? 'start'
      : screenOfPhase(snapshot)

  /* 正在写的这一天 = 已完成天数 + 1；结局屏停在最后一天 */
  const day = snapshot ? Math.min(snapshot.history.length + 1, TOTAL_DAYS) : 1
  const scene = sceneFor(day, screen)

  /* 开始页「开始第一天」与结局页「重新开始两周」是同一件事：先清掉旧档再开新局 */
  const startGame = useCallback(() => {
    clearSnapshot()
    setEntered(true)
    const fresh = initialSnapshot()
    setSnapshot(fresh)
    persist(fresh)
    void dispatch(fresh, generateEvent)
  }, [dispatch, persist])

  const actions = {
    start: startGame,
    /** 开始页「继续上次的日记」：停在待生成事件/待生成结局时，把那一半补上 */
    resume() {
      if (!snapshot || busy) return
      setEntered(true)
      stepFrom(snapshot)
    },
    choose(event: GameEvent, optionId: string) {
      if (!snapshot || busy) return
      void dispatch(snapshot, base => chooseOption(base, event.id, optionId))
    },
    /** 展示结果后的「继续」：第 14 天之后是生成结局，不是新事件 */
    continueDay() {
      if (!snapshot || busy) return
      const base = snapshot
      if (base.history.length >= TOTAL_DAYS) void dispatch(base, generateEnding)
      else void dispatch(base, generateEvent)
    },
    retry() {
      const pending = lastCall.current
      if (!pending || busy) return
      void dispatch(pending.base, pending.call)
    },
    /** 错误屏的「先回到上一页」：只收起提示，快照没动过 */
    dismissError() {
      lastCall.current = null
      setError(null)
    },
    restart: startGame,
    /** 走查面板直接塞一份快照进来，等价于成员 D 恢复出的某个中间状态。
     *  hold=true 时不补接口，让①④这两个中间态停在屏上供评审。 */
    loadAt(next: Snapshot, hold: boolean) {
      clearSnapshot()
      setError(null)
      setEntered(true)
      setSnapshot(next)
      persist(next)
      if (!hold) stepFrom(next)
    },
    forgetSave() {
      clearSnapshot()
      setError(null)
      setEntered(false)
      setSnapshot(null)
    },
  }

  return { screen, snapshot, busy, error, scene, saveFailed, actions }
}

export type GameActions = ReturnType<typeof useGame>['actions']
