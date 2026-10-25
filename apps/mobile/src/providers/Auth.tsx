import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { forgetThisPhone, registerForReminders } from '../lib/push'
import { supabase } from '../lib/supabase'
import { queryClient } from '../lib/query'
import { useI18n } from './I18n'

type AuthValue = {
  user: User | null
  session: Session | null
  /** True until the stored session has been read. */
  loading: boolean
  /** null while unknown (no user, check pending or failed); data stays protected by RLS anyway. */
  isAdmin: boolean | null
  signOut: () => Promise<boolean>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  // While this phone signs out the sign-in screen is already shown; the network calls finish behind it
  const [leaving, setLeaving] = useState(false)
  const shown = leaving ? null : session
  const user = shown?.user ?? null
  const userId = user?.id ?? null

  useEffect(() => {
    let alive = true
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (alive) setSession(data.session ?? null)
      })
      .catch(() => {
        if (alive) setSession(null)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setLoading(false)
    })
    return () => {
      alive = false
      data.subscription.unsubscribe()
    }
  }, [])

  // Checked again only when the person changes, not on every token refresh
  useEffect(() => {
    setIsAdmin(null)
    if (!userId) return
    let alive = true
    supabase.rpc('is_admin').then(({ data, error }) => {
      if (!alive) return
      setIsAdmin(error ? null : data === true)
    })
    return () => {
      alive = false
    }
  }, [userId])

  // An admin's phone gets the evening reminder; again on each start, so a new token or language is sent along
  const { locale, t } = useI18n()
  const channel = t.messages.evening.channel
  useEffect(() => {
    if (userId && isAdmin === true) void registerForReminders({ locale, channel })
  }, [userId, isAdmin, locale, channel])

  const value = useMemo<AuthValue>(
    () => ({
      user,
      session: shown,
      loading,
      isAdmin,
      // This phone only: the default would end the account's sessions everywhere. The sign-in screen
      // takes over at once instead of waiting for the reminder list and the server to answer.
      signOut: async () => {
        setLeaving(true)
        try {
          await forgetThisPhone()
          await supabase.auth.signOut({ scope: 'local' })
        } catch {
          // Judged below by what is left on this phone
        }
        // The library drops this phone's session even when the server cannot be reached, so only a
        // session still here means the sign-out failed
        const { data } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }))
        const out = !data.session
        if (out) queryClient.clear()
        setLeaving(false)
        return out
      }
    }),
    [user, shown, loading, isAdmin]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
