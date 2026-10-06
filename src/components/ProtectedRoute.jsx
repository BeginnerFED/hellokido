import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import NoAccess from './NoAccess'

export default function ProtectedRoute({ children }) {
  const { user, loading, isAdmin } = useAuth()
  const location = useLocation()

  // Oturum denetimi sürerken giriş sayfasına atma (sayfa yenilendiğinde oturum hâlâ geçerli olabilir)
  if (loading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#d2d2d7] dark:border-[#2a3241] border-t-[#0071e3] dark:border-t-[#0071e3] animate-spin" />
      </div>
    )
  }

  if (!user) {
    // Girişten sonra istenen sayfaya dönülür
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // Hesap yönetici listesinde değil: boş bir panel yerine açıklama göster
  if (isAdmin === false) {
    return <NoAccess />
  }

  return children
}
