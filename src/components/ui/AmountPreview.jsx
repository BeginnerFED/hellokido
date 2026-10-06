import React from 'react'
import { parseAmount, formatMoney } from '../../lib/money'

// Tutar kutusunun sağ kenarında, yazılan tutarın nasıl kaydedileceğini gösterir.
// Aynı kutuya hem "4.450" (dört bin dört yüz elli) hem "4,45" yazılabildiği için
// kaydedilecek değer yazarken görünür: "= 4.450 ₺" / "= 4,45 ₺".
// `relative` bir sarmalayıcının içine, input'tan sonra yerleştirilir.
export default function AmountPreview({ value, language }) {
  const text = String(value ?? '').trim()
  if (text === '') return null

  const amount = parseAmount(text)
  const baseClasses = 'absolute inset-y-0 right-3 flex items-center text-xs pointer-events-none'

  if (amount === null) {
    return (
      <span className={`${baseClasses} text-[#b62929] dark:text-[#ff6961]`}>
        {language === 'tr' ? 'Geçersiz tutar' : 'Invalid amount'}
      </span>
    )
  }

  // Ayraçsız küçük tutarlarda ("500") gösterilecek ek bilgi yok
  if (amount < 1000 && !/[.,]/.test(text)) return null

  return (
    <span className={`${baseClasses} text-[#86868b]`}>
      = {formatMoney(amount)} ₺
    </span>
  )
}
