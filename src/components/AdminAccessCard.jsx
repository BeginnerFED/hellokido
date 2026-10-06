import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../context/LanguageContext'

// Ayarlar › Panel Erişimi: yönetim paneline girebilen hesapların listesi.
// Supabase'de hesap açmak tek başına yetmez; hesabın bu listede olması gerekir
// (veritabanındaki tüm kurallar public.is_admin() üzerinden bu listeye bakar).
export default function AdminAccessCard() {
  const { language } = useLanguage()
  const [admins, setAdmins] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [email, setEmail] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [confirmingUserId, setConfirmingUserId] = useState(null)
  const [message, setMessage] = useState(null) // { type: 'success' | 'error', text }

  const loadAdmins = useCallback(async () => {
    const { data, error } = await supabase.rpc('list_admins')

    if (error) {
      console.error('Yönetici listesi yüklenemedi:', error)
      setLoadFailed(true)
    } else {
      setAdmins(data || [])
      setLoadFailed(false)
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadAdmins()
  }, [loadAdmins])

  const handleGrant = async (e) => {
    e.preventDefault()
    const value = email.trim()
    if (!value || isSaving) return

    setIsSaving(true)
    setMessage(null)

    const { error } = await supabase.rpc('grant_admin', { p_email: value })

    if (error) {
      const notFound = error.message === 'user_not_found'
      setMessage({
        type: 'error',
        text: notFound
          ? (language === 'tr'
            ? 'Bu e-postayla bir hesap bulunamadı. Önce Supabase panelinden (Authentication › Users) hesap oluşturulmalı.'
            : 'No account was found for this email. Create the account in the Supabase dashboard first (Authentication › Users).')
          : (language === 'tr' ? 'Erişim verilemedi, lütfen tekrar deneyin.' : 'Access could not be granted, please try again.')
      })
    } else {
      setEmail('')
      setMessage({
        type: 'success',
        text: language === 'tr' ? 'Erişim verildi.' : 'Access granted.'
      })
      await loadAdmins()
    }

    setIsSaving(false)
  }

  const handleRevoke = async (userId) => {
    if (isSaving) return

    setIsSaving(true)
    setMessage(null)

    const { error } = await supabase.rpc('revoke_admin', { p_user_id: userId })

    if (error) {
      setMessage({
        type: 'error',
        text: language === 'tr' ? 'Erişim kaldırılamadı, lütfen tekrar deneyin.' : 'Access could not be removed, please try again.'
      })
    } else {
      setMessage({
        type: 'success',
        text: language === 'tr' ? 'Erişim kaldırıldı.' : 'Access removed.'
      })
      await loadAdmins()
    }

    setConfirmingUserId(null)
    setIsSaving(false)
  }

  return (
    <div className="md:col-span-2 bg-white dark:bg-[#1a1f2e] rounded-xl p-6 shadow-sm border border-gray-100 dark:border-[#2a3241]">
      <h4 className="font-medium text-[#1d1d1f] dark:text-white">
        {language === 'tr' ? 'Panel Erişimi' : 'Panel Access'}
      </h4>
      <p className="mt-1 mb-4 text-sm text-gray-500 dark:text-gray-400">
        {language === 'tr'
          ? 'Yönetim paneline yalnızca bu listedeki hesaplar girebilir.'
          : 'Only the accounts in this list can enter the management panel.'}
      </p>

      {isLoading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {language === 'tr' ? 'Yükleniyor...' : 'Loading...'}
        </p>
      ) : loadFailed ? (
        <p className="text-sm text-red-600 dark:text-red-400">
          {language === 'tr' ? 'Liste yüklenemedi. Sayfayı yenileyip tekrar deneyin.' : 'The list could not be loaded. Refresh the page and try again.'}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {admins.map((admin) => (
            <li key={admin.user_id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-sm text-gray-900 dark:text-white break-all">{admin.email}</span>

              {admin.is_self ? (
                <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                  {language === 'tr' ? 'Siz' : 'You'}
                </span>
              ) : confirmingUserId === admin.user_id ? (
                <span className="shrink-0 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleRevoke(admin.user_id)}
                    disabled={isSaving}
                    className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                  >
                    {language === 'tr' ? 'Evet, kaldır' : 'Yes, remove'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingUserId(null)}
                    disabled={isSaving}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:underline disabled:opacity-50"
                  >
                    {language === 'tr' ? 'Vazgeç' : 'Cancel'}
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingUserId(admin.user_id)}
                  className="shrink-0 text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                >
                  {language === 'tr' ? 'Kaldır' : 'Remove'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleGrant} className="mt-4 flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={language === 'tr' ? 'e-posta adresi' : 'email address'}
          autoComplete="off"
          className="flex-1 h-10 px-3 rounded-lg text-sm bg-white dark:bg-[#121621] text-gray-900 dark:text-white placeholder-gray-400 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        />
        <button
          type="submit"
          disabled={isSaving || !email.trim()}
          className="h-10 px-4 rounded-lg text-sm font-medium bg-gray-50 dark:bg-[#242b3d] text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#2d364a] border border-gray-200 dark:border-gray-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {language === 'tr' ? 'Erişim Ver' : 'Grant Access'}
        </button>
      </form>

      {message && (
        <p className={`mt-3 text-sm ${message.type === 'success' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
