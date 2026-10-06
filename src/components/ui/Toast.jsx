import React, { useEffect, useRef } from 'react'
import { CheckCircleIcon, XCircleIcon, XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'

// Türe göre görünüm. Tanınmayan tür hata gibi gösterilir.
const TOAST_STYLES = {
  success: {
    box: 'bg-[#73f7c8] text-[#1c865f] border border-[#1c865f]/20',
    close: 'hover:text-[#2d9770]',
    Icon: CheckCircleIcon
  },
  // Kısmen başarılı işlemler (ör. hafta kopyalamada bazı derslerin atlanması)
  warning: {
    box: 'bg-[#ffe9b0] text-[#8a5a00] border border-[#8a5a00]/20',
    close: 'hover:text-[#b37400]',
    Icon: ExclamationTriangleIcon
  },
  error: {
    box: 'bg-[#fdc9c9] text-[#b62929] border border-[#b62929]/20',
    close: 'hover:text-[#ef4444]',
    Icon: XCircleIcon
  }
}

// Mesajın ekranda kalma süresi: başarı mesajları en az 3 sn, uyarı ve hatalar en az 5 sn;
// uzun mesajlar okunabilecek kadar (en çok 8 sn) kalır.
const getDuration = (message, type) => {
  const minimum = type === 'success' ? 3000 : 5000
  return Math.min(8000, Math.max(minimum, String(message ?? '').length * 60))
}

export default function Toast({ message, type = 'success', isVisible, onClose }) {
  // onClose çoğu yerde her render'da yeni bir fonksiyon olarak geliyor; sayaç bu yüzden
  // yeniden başlamasın diye son hali ref'te tutulur.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onCloseRef.current?.()
      }, getDuration(message, type))

      return () => clearTimeout(timer)
    }
  }, [isVisible, message, type])

  if (!isVisible) return null

  const style = TOAST_STYLES[type] || TOAST_STYLES.error
  const Icon = style.Icon

  return (
    // Uzun mesajlar dar ekranda taşmasın: satır kırılır, kutu ekran genişliğini aşmaz
    <div className="fixed top-4 right-4 left-4 sm:left-auto z-[9999] flex justify-end pointer-events-none">
      <div className={`pointer-events-auto max-w-md flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg transition-all transform ${style.box}`}>
        <Icon className="w-5 h-5 shrink-0" />
        <span className="text-sm font-medium">{message}</span>
        <button
          onClick={onClose}
          className={`p-1 rounded-lg hover:bg-black/5 transition-colors ${style.close}`}
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
