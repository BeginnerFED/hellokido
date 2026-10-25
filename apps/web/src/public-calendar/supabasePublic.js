import { createClient } from '@supabase/supabase-js'

// A separate, session-less Supabase client for the public calendar (/takvim).
//
// Why separate?
//  - Parents and site visitors open this page. It needs no session and no localStorage, so it
//    opens even when the browser blocks site data. (supabase-js no longer takes a cross-tab lock,
//    so the old no-op `lock` option is gone; passing it now only logs a deprecation warning.)
//  - Requests always go with the anon key. Even with an admin signed in in the same browser,
//    the page shows exactly what a parent sees (anon RLS rules).
export const supabasePublic = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'hk-public-calendar'
    }
  }
)
