import { useEffect } from 'react'
import { useSettingsStore } from './store/settingsStore'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { GameSession } from './pages/GameSession'
import { MetronomePage } from './pages/MetronomePage'
import { ProgressPage } from './pages/ProgressPage'
import { SettingsPage } from './pages/SettingsPage'
import { PracticePage } from './pages/PracticePage'
import { TrainHub } from './pages/TrainHub'

function Shell() {
  const location = useLocation()
  const reducedMotion = useSettingsStore((s) => s.reducedMotion)
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(reducedMotion)
  }, [reducedMotion])
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])
  const hideNav = location.pathname.startsWith('/play/')

  return (
    <div className="app-shell">
      <main className={`app-main ${hideNav ? 'app-main--play' : ''}`}>
        <Routes>
          <Route path="/" element={<TrainHub />} />
          <Route path="/practice" element={<PracticePage />} />
          <Route path="/metronome" element={<MetronomePage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route
            path="/play/:levelId"
            element={<GameSession key={location.pathname} />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {hideNav ? null : <BottomNav />}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  )
}
