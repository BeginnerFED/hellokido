import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  // Hesap yönetici listesinde mi? null: henüz bilinmiyor (ya da sorulamadı)
  const [isAdmin, setIsAdmin] = useState(null)

  useEffect(() => {
    // Mevcut oturum kontrolü
    supabase.auth.getSession()
      .then(({ data }) => setUser(data?.session?.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))

    // Oturum değişikliklerini dinle
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Giriş yapmış olmak yetmez: veritabanı yalnızca yönetici listesindeki hesaplara veri
  // verir (public.is_admin). Listede olmayan hesap boş bir panel yerine açıklama görür.
  const userId = user?.id ?? null

  const checkAdmin = useCallback(async () => {
    if (!userId) {
      setIsAdmin(null)
      return
    }

    const { data, error } = await supabase.rpc('is_admin')
    // Sorgu başarısızsa (bağlantı) "yetkisiz" sayılmaz; veriler zaten sunucuda korunuyor
    setIsAdmin(error ? null : data === true)
  }, [userId])

  useEffect(() => {
    setIsAdmin(null)
    checkAdmin()
  }, [checkAdmin])

  const value = {
    user,
    loading,
    isAdmin,
  }

  // Çocuklar oturum denetimi beklenmeden çizilir: herkese açık takvim ve giriş sayfası
  // kimlik sunucusuna ulaşılamasa da açılır. Korumalı sayfalar `loading` bitene kadar bekler.
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
