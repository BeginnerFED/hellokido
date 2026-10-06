import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// "Beni Hatırla": işaretliyse oturum tarayıcı kapatılıp açılsa da sürer (localStorage);
// işaretli değilse yalnızca bu sekme açıkken geçerlidir (sessionStorage).
// Tercih girişten hemen önce setRememberSession ile kaydedilir; hiç kaydedilmemişse
// oturum kalıcıdır (önceki davranış).
const REMEMBER_KEY = 'hk-remember-session'

const pickStores = () => {
  const remember = localStorage.getItem(REMEMBER_KEY) !== '0'
  return remember
    ? { target: localStorage, other: sessionStorage }
    : { target: sessionStorage, other: localStorage }
}

const authStorage = {
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
      // Eski tercihten kalan kopya, sekme kapandıktan sonra oturumu geri getirmesin
      other.removeItem(key)
      target.setItem(key, value)
    } catch {
      // Depolama kullanılamıyor: oturum yalnızca bellekte kalır
    }
  },
  removeItem: (key) => {
    try {
      sessionStorage.removeItem(key)
      localStorage.removeItem(key)
    } catch {
      // Depolama kullanılamıyor
    }
  }
}

export const setRememberSession = (remember) => {
  try {
    localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0')
  } catch {
    // Depolama kullanılamıyor
  }
}

// Uygulamanın tek Supabase istemcisi. Her dosyanın kendi istemcisini oluşturması,
// aynı oturum anahtarını paylaşan çok sayıda kimlik doğrulama istemcisine yol açıyordu.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { storage: authStorage }
})
