import 'expo-sqlite/localStorage/install'
import { AppState } from 'react-native'
import { createClient } from '@supabase/supabase-js'
import { setSupabaseClient } from '@hellokido/core/rules/client.js'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL as string
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string

// The session is kept in the phone's own storage and renewed while the app is open
export const supabase = createClient(url, key, {
  auth: { storage: localStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false }
})

// The shared rules in core talk to the database through this one client
setSupabaseClient(supabase)

// Timers sleep in the background: renew the token only while the app is in front
AppState.addEventListener('change', (state) => {
  if (state === 'active') void supabase.auth.startAutoRefresh()
  else void supabase.auth.stopAutoRefresh()
})
