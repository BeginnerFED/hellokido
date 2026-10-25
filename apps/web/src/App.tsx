import { Suspense, lazy } from 'react'
import { HashRouter, Routes, Route } from 'react-router'
import PublicPage from './public-calendar/PublicPage'

// The public calendar (/takvim) is the only page parents open. It never loads the admin code,
// the session or the theme and language settings, so it opens fast even when the browser
// blocks site data. The admin panel is its own chunk, loaded only when needed.
const AdminApp = lazy(() => import('./admin/AdminApp'))

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/takvim" element={<PublicPage />} />
        <Route
          path="/*"
          element={
            <Suspense fallback={<div className="min-h-dvh bg-ground" />}>
              <AdminApp />
            </Suspense>
          }
        />
      </Routes>
    </HashRouter>
  )
}
