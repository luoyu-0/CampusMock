import { useEffect, useState } from 'react'
import { ProtoBar } from './components/ProtoBar'
import { SceneBackdrop } from './components/SceneBackdrop'
import { EndingPage } from './pages/EndingPage'
import { ErrorPage } from './pages/ErrorPage'
import { GamePage } from './pages/GamePage'
import { StartPage } from './pages/StartPage'
import { useGame } from './state/useGame'

const GAME_SCREENS = ['generating', 'choice', 'result', 'endingPending']
const SHOW_PROTO_BAR = import.meta.env.DEV || import.meta.env.VITE_ENABLE_PROTO_BAR === 'true'

export default function App() {
  const { screen, snapshot, busy, error, scene, saveFailed, canExportBrokenSave, actions } = useGame()
  const [showNotes, setShowNotes] = useState(false)

  useEffect(() => {
    document.body.classList.toggle('show-notes', showNotes)
  }, [showNotes])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [screen])

  const inGame = snapshot !== null && GAME_SCREENS.includes(screen)
  const interactionBlocked = busy || saveFailed

  return (
    <>
      {SHOW_PROTO_BAR && (
        <ProtoBar
          screen={screen}
          snapshot={snapshot}
          busy={interactionBlocked}
          showNotes={showNotes}
          onNotes={setShowNotes}
          onRunFull={() => actions.runFullWalk()}
          onLoad={(next, hold) => actions.loadAt(next, hold)}
          onForget={() => actions.forgetSave()}
        />
      )}
      <SceneBackdrop theme={scene} />
      <main className="stage">
        {saveFailed && (
          <div className="save-warn" role="alert">
            <span>这一步已经完成，但浏览器暂时写不进存档。进度尚未推进，重试保存不会再次生成内容。</span>
            <button className="btn muted" disabled={busy} onClick={actions.retrySave}>
              重试保存
            </button>
          </div>
        )}
        {/* key={screen} 让每次换屏重挂载一次，global.css 里 .screen.on 的 0.3s 淡入因此仍然成立 */}
        <div className="screen on" key={screen}>
          {screen === 'start' && (
            <StartPage
              saved={snapshot}
              busy={busy}
              onStart={() => actions.start()}
              onResume={() => actions.resume()}
            />
          )}
          {inGame && snapshot && <GamePage snapshot={snapshot} busy={interactionBlocked} actions={actions} />}
          {screen === 'ending' && snapshot && <EndingPage snapshot={snapshot} onRestart={() => actions.restart()} />}
          {(screen === 'errRetry' || screen === 'errFatal') && error && (
            <ErrorPage
              error={error}
              snapshot={snapshot}
              busy={interactionBlocked}
              canExportBrokenSave={canExportBrokenSave}
              actions={actions}
            />
          )}
        </div>
      </main>
    </>
  )
}
