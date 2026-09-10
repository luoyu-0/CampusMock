import { useEffect, useState } from 'react'
import { ProtoBar } from './components/ProtoBar'
import { SceneBackdrop } from './components/SceneBackdrop'
import { EndingPage } from './pages/EndingPage'
import { ErrorPage } from './pages/ErrorPage'
import { GamePage } from './pages/GamePage'
import { StartPage } from './pages/StartPage'
import { useGame } from './state/useGame'

const GAME_SCREENS = ['generating', 'choice', 'result', 'endingPending']

export default function App() {
  const { screen, snapshot, busy, error, scene, saveFailed, actions } = useGame()
  const [showNotes, setShowNotes] = useState(false)

  useEffect(() => {
    document.body.classList.toggle('show-notes', showNotes)
  }, [showNotes])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [screen])

  const inGame = snapshot !== null && GAME_SCREENS.includes(screen)

  return (
    <>
      <ProtoBar
        screen={screen}
        snapshot={snapshot}
        showNotes={showNotes}
        onNotes={setShowNotes}
        onLoad={(next, hold) => actions.loadAt(next, hold)}
        onForget={() => actions.forgetSave()}
      />
      <SceneBackdrop theme={scene} />
      <main className="stage">
        {saveFailed && (
          <p className="save-warn" role="status">
            这台设备现在写不进存档（浏览器拦了写入，或者空间满了）。这一局还能继续玩，但刷新会退回上一次成功保存的地方。
          </p>
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
          {inGame && snapshot && <GamePage snapshot={snapshot} busy={busy} actions={actions} />}
          {screen === 'ending' && snapshot && <EndingPage snapshot={snapshot} onRestart={() => actions.restart()} />}
          {(screen === 'errRetry' || screen === 'errFatal') && error && (
            <ErrorPage error={error} snapshot={snapshot} busy={busy} actions={actions} />
          )}
        </div>
      </main>
    </>
  )
}
