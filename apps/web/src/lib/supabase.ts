import { createClient, type SupportedStorage } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// "Remember me": when ticked the session survives closing the browser (localStorage);
// otherwise it lasts while this tab is open (sessionStorage). The choice is stored right
// before signing in; when it was never stored the session is persistent (old behaviour).
const REMEMBER_KEY = 'hk-remember-session'

const pickStores = () => {
  const remember = localStorage.getItem(REMEMBER_KEY) !== '0'
  return remember ? { target: localStorage, other: sessionStorage } : { target: sessionStorage, other: localStorage }
}

const authStorage: SupportedStorage = {
  getItem: (key) => {
    try {
      return sessionStorage.getItem(key) ?? localStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem: (key, value) => {
    try {
      const { target, other } = pickStores()
      // A copy left by the previous choice must not bring the session back after the tab closes
      other.removeItem(key)
      target.setItem(key, value)
    } catch {
      // Storage unavailable: the session lives in memory only
    }
  },
  removeItem: (key) => {
    try {
      sessionStorage.removeItem(key)
      localStorage.removeItem(key)
    } catch {
      // Storage unavailable
    }
  }
}

export const setRememberSession = (remember: boolean) => {
  try {
    localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0')
  } catch {
    // Storage unavailable
  }
}

// The admin panel's one Supabase client (one auth client per session key).
export const supabase = createClient(url, anonKey, { auth: { storage: authStorage } })
