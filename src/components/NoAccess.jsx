import { useNavigate } from 'react-router-dom'
import { LockClosedIcon } from '@heroicons/react/24/outline'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'

// Giriş yapmış ama yönetici listesinde olmayan hesaplar için.
// Veriler zaten veritabanı kurallarıyla korunuyor; bu ekran yalnızca boş bir panel
// yerine ne olduğunu ve ne yapılması gerektiğini söyler.
export default function NoAccess() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { language } = useLanguage()

  const handleLogout = async () => {
    // Çıkış başarısızsa (bağlantı) oturum yerinde durur; giriş sayfasına gitmek anlamsız olur
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) {
      console.error('Logout error:', error.message)
      return
    }
    navigate('/login')
  }

  return (
    <div className="w-full min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white dark:bg-[#1a1f2e] border border-[#E2E4E9] dark:border-[#2a3241] rounded-2xl p-8 text-center">
        <div className="w-12 h-12 mx-auto mb-5 rounded-full bg-[#f5f5f7] dark:bg-[#242b3d] flex items-center justify-center">
          <LockClosedIcon className="w-6 h-6 text-[#6e6e73] dark:text-[#86868b]" />
        </div>

        <h1 className="text-xl font-semibold text-[#1d1d1f] dark:text-white mb-3">
          {language === 'tr' ? 'Bu hesabın panele erişimi yok' : 'This account has no access to the panel'}
        </h1>

        <p className="text-sm text-[#6e6e73] dark:text-[#86868b] leading-relaxed">
          {language === 'tr'
            ? 'Erişim için mevcut bir yöneticinin Ayarlar › Panel Erişimi bölümünden bu e-postayı eklemesi gerekir.'
            : 'An existing administrator needs to add this email under Settings › Panel Access.'}
        </p>

        {user?.email && (
          <p className="mt-4 text-sm font-medium text-[#1d1d1f] dark:text-white break-all">
            {user.email}
          </p>
        )}

        <button
          onClick={handleLogout}
          className="mt-6 w-full h-10 bg-gray-100 dark:bg-[#242b3d] text-[#1d1d1f] dark:text-white text-sm font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-[#2d364a] focus:outline-none transition-colors"
        >
          {language === 'tr' ? 'Çıkış Yap' : 'Log Out'}
        </button>
      </div>
    </div>
  )
}
