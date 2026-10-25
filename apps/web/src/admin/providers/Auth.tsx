import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

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
  const user = session?.user ?? null
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

  const value = useMemo<AuthValue>(
    () => ({
      user,
      session,
      loading,
      isAdmin,
      // This device only: the default would end the account's sessions everywhere
      signOut: async () => {
        const { error } = await supabase.auth.signOut({ scope: 'local' })
        return !error
      }
    }),
    [user, session, loading, isAdmin]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
