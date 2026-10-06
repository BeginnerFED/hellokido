import { createClient } from '@supabase/supabase-js'

// Herkese açık takvim sayfası (/takvim) için AYRI, oturumsuz Supabase istemcisi.
//
// Neden ayrı?
//  - Bu sayfayı veliler ve site ziyaretçileri açar; oturum, localStorage veya sekmeler arası
//    kilit (navigator.locks) kullanmasına gerek yok. Tarayıcı site verisini engelliyorsa bile
//    (ör. "tüm çerezleri engelle") takvim açılır.
//  - İstekler her zaman anon anahtarıyla gider. Aynı tarayıcıda bir yönetici oturumu açık olsa
//    bile sayfa, velinin gördüğünün AYNISINI gösterir (anon RLS kuralları).
export const supabasePublic = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'hk-public-calendar',
      // Kalıcı oturum olmadığı için kilide ihtiyaç yok; navigator.locks kullanılmaz
      lock: async (_name, _acquireTimeout, fn) => await fn()
    }
  }
)
