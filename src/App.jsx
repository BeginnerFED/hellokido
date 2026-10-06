import { Suspense, lazy } from 'react'
import { HashRouter as Router, Routes, Route } from 'react-router-dom'
import PublicCalendar from './pages/PublicCalendar'

// Yönetim paneli ayrı bir parça (chunk) olarak ve yalnızca gerektiğinde yüklenir.
// Herkese açık takvim (/takvim) — velilerin ve site ziyaretçilerinin açtığı tek sayfa —
// yönetim kodunu, oturum altyapısını (AuthProvider) ve tema/dil ayarlarını hiç yüklemez:
// daha hızlı açılır ve tarayıcı site verisini engellese bile çalışır.
const AdminApp = lazy(() => import('./AdminApp'))

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/takvim" element={<PublicCalendar />} />
        <Route
          path="/*"
          element={
            <Suspense fallback={<div className="min-h-screen bg-[#f6f7f9] dark:bg-[#121621]" />}>
              <AdminApp />
            </Suspense>
          }
        />
      </Routes>
    </Router>
  )
}

export default App
