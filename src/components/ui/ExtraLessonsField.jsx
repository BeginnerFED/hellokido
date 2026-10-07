import React from 'react'
import { GiftIcon, MinusIcon, PlusIcon } from '@heroicons/react/24/outline'
import { MAX_EXTRA_LESSONS } from '../../lib/lessonUsage'

// Pakete ek olarak verilen ders sayısı: etiket solda, azalt / sayı / artır sağda.
// Kayıt formlarındaki diğer kutularla aynı kalıptadır (yükseklik, kenarlık, soldaki ikon).
// Ücretsiz katılımda ders hakkı izlenmediği için pasif gösterilir (disabled).
export default function ExtraLessonsField({ value, onChange, label, language, disabled = false, tabIndex }) {
  const count = Math.min(Math.max(Math.trunc(Number(value)) || 0, 0), MAX_EXTRA_LESSONS)
  const hasExtra = count > 0 && !disabled

  const stepButtonClasses = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-[#1d1d1f] dark:text-white transition-colors hover:bg-black/5 dark:hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] disabled:text-[#c7c7cc] dark:disabled:text-[#48484a] disabled:hover:bg-transparent disabled:cursor-not-allowed'

  return (
    <div
      role="group"
      aria-label={label}
      className={`relative flex h-[50px] items-center rounded-xl border border-[#d2d2d7] dark:border-[#2a3241] bg-white dark:bg-[#121621] pl-11 pr-0.5 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <GiftIcon className="w-5 h-5 text-[#86868b]" />
      </div>
      <span className={`min-w-0 flex-1 truncate ${hasExtra ? 'text-[#1d1d1f] dark:text-white' : 'text-[#6e6e73] dark:text-[#86868b]'}`}>
        {label}
      </span>
      <button
        type="button"
        onClick={() => onChange(count - 1)}
        disabled={disabled || count <= 0}
        aria-label={language === 'tr' ? 'Ekstra dersi azalt' : 'Decrease extra lessons'}
        className={stepButtonClasses}
        tabIndex={tabIndex}
      >
        <MinusIcon className="w-4 h-4" aria-hidden="true" />
      </button>
      <output
        aria-live="polite"
        className={`w-8 shrink-0 text-center tabular-nums ${hasExtra ? 'font-semibold text-[#1d1d1f] dark:text-white' : 'text-[#6e6e73] dark:text-[#86868b]'}`}
      >
        {count}
      </output>
      <button
        type="button"
        onClick={() => onChange(count + 1)}
        disabled={disabled || count >= MAX_EXTRA_LESSONS}
        aria-label={language === 'tr' ? 'Ekstra dersi artır' : 'Increase extra lessons'}
        className={stepButtonClasses}
        tabIndex={tabIndex}
      >
        <PlusIcon className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  )
}
