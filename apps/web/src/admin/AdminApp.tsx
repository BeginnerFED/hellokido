import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { RouterProvider } from 'react-aria-components'
import { Navigate, Route, Routes, useHref, useLocation, useNavigate } from 'react-router'
import { setSupabaseClient } from '@hellokido/core/rules/client.js'
import { supabase } from '../lib/supabase'
import { AuthProvider, useAuth } from './providers/Auth'
import { I18nProvider, useI18n } from './providers/I18n'
import { ThemeProvider } from './providers/Theme'
import { ToastProvider } from './providers/Toasts'
import { ActionsProvider } from './shell/ActionsHost'
import { NoAccess } from './shell/NoAccess'
import { OfflineNotice } from './shell/OfflineNotice'
import { Shell } from './shell/Shell'
import { FullScreenSpinner } from './ui/Spinner'
import Login from './pages/Login'
import TodayPage from './features/today/TodayPage'
import CalendarPage from './features/calendar/CalendarPage'
import ChildrenPage from './features/children/ChildrenPage'
import FinancePage from './features/finance/FinancePage'
import WaitlistPage from './features/waitlist/WaitlistPage'
import NotesPage from './features/notes/NotesPage'
import SettingsPage from './features/settings/SettingsPage'

// The shared rules in core talk to the database through this one client
setSupabaseClient(supabase)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // The database client already retries a dropped read three times (1, 2 and 4 s); another
      // round here only doubled the wait before "could not load" with its retry button showed
      retry: false,
      refetchOnWindowFocus: true
    }
  }
})

export default function AdminApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <I18nProvider>
          <ThemeProvider>
            <Toasts>
              <AriaRouter>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route
                    element={
                      <Protected>
                        <ActionsProvider>
                          <Shell />
                        </ActionsProvider>
                      </Protected>
                    }
                  >
                    <Route index element={<TodayPage />} />
                    <Route path="calendar" element={<CalendarPage />} />
                    {/* One route for list and child, so the list keeps its search on the way back */}
                    <Route path="children/:id?" element={<ChildrenPage />} />
                    <Route path="finance" element={<FinancePage />} />
                    <Route path="waitlist" element={<WaitlistPage />} />
                    <Route path="notes" element={<NotesPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                    {/* Addresses of the previous panel keep working from old bookmarks */}
                    <Route path="registration" element={<Navigate to="/children" replace />} />
                    <Route path="remaining-usage" element={<Navigate to="/children" replace />} />
                    <Route path="income-expense" element={<Navigate to="/finance" replace />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Routes>
              </AriaRouter>
            </Toasts>
          </ThemeProvider>
        </I18nProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

function Toasts({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  return (
    <ToastProvider closeLabel={t.common.close} notice={<OfflineNotice />}>
      {children}
    </ToastProvider>
  )
}

// tel:, https://wa.me/… and other full addresses are not routes of the app
const EXTERNAL = /^([a-z][a-z\d+.-]*:|\/\/)/i

function useAppHref(to: string) {
  const href = useHref(to)
  return EXTERNAL.test(to) ? to : href
}

/** Lets react-aria links and menu items navigate inside the app. */
function AriaRouter({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  return (
    <RouterProvider navigate={(to) => navigate(to)} useHref={useAppHref}>
      {children}
    </RouterProvider>
  )
}

function Protected({ children }: { children: ReactNode }) {
  const { loading, user, isAdmin } = useAuth()
  const { t } = useI18n()
  const location = useLocation()
  // Never redirect while the stored session is still being read
  if (loading) return <FullScreenSpinner label={t.common.loading} />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  if (isAdmin === false) return <NoAccess />
  return <>{children}</>
}
