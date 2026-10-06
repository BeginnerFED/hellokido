import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../context/LanguageContext'
import { capitalizeName, capitalizeWords, upperFirst } from '../lib/text'
import { phoneDigits, isValidPhone } from '../lib/phone'
import { changeKeepingCaret } from '../lib/caret'
import { localDateKey } from '../lib/dates'
import DatePicker, { registerLocale } from 'react-datepicker'
import { parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import "react-datepicker/dist/react-datepicker.css"
import { 
  XMarkIcon,
  FaceSmileIcon,
  UsersIcon,
  PhoneIcon,
  CakeIcon,
  CubeIcon,
  CalendarDaysIcon,
  ClockIcon,
  PencilSquareIcon
} from '@heroicons/react/24/outline'

// Türkçe lokalizasyonu kaydet
registerLocale('tr', tr)

const inputClasses = "w-full h-[46px] pl-11 pr-4 rounded-xl border border-[#e5e5e5] dark:border-[#2a3241] bg-white dark:bg-[#121621] text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:ring-2 focus:ring-[#0071e3] focus:border-transparent transition-all text-sm"
const iconClasses = "w-5 h-5 text-[#86868b]"
const iconWrapperClasses = "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"

// Kaydı form alanlarına çevirir (notes veritabanında NULL olabilir)
const toFormData = (entry) => ({
  parent_name: entry.parent_name ?? '',
  parent_phone: entry.parent_phone ?? '',
  student_name: entry.student_name ?? '',
  student_age: entry.student_age ?? '',
  package_type: entry.package_type ?? '',
  // "YYYY-AA-GG" yerel gün olarak okunur (new Date() UTC sayar, batıdaki saat dilimlerinde bir gün kayar)
  contact_date: parseISO(entry.contact_date),
  status: entry.status ?? '',
  notes: entry.notes ?? ''
})

// Formu kaydedilecek alanlara çevirir: metinler kırpılır, contact_date yerel gün olarak yazılır
const toPayload = (formData) => ({
  parent_name: formData.parent_name.trim(),
  parent_phone: phoneDigits(formData.parent_phone),
  student_name: formData.student_name.trim(),
  student_age: formData.student_age.trim(),
  package_type: formData.package_type,
  contact_date: localDateKey(formData.contact_date),
  status: formData.status,
  notes: formData.notes.trim()
})

// DatePicker özel stil
// Bileşenin dışında tanımlı: içeride tanımlanınca her render'da input yeniden oluşturuluyordu.
// onKeyDown iletilir ki Enter/Escape/ok tuşları takvime ulaşsın ve Enter formu göndermesin.
// onFocus/onBlur bilerek iletilmez: iletilirse gün seçildikten sonra takvim yeniden açılabiliyor.
const DateInput = React.forwardRef(function DateInput({ value, onClick, onKeyDown, placeholder }, ref) {
  return (
    <div className="relative w-full">
      <div className={iconWrapperClasses}>
        <CalendarDaysIcon className={iconClasses} />
      </div>
      <input
        type="text"
        ref={ref}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.preventDefault()
          onKeyDown?.(e)
        }}
        value={value}
        readOnly
        className={`${inputClasses} cursor-pointer`}
        placeholder={placeholder}
      />
    </div>
  )
})

export default function UpdateWaitlistModal({ isOpen, onClose, onSuccess, entry }) {
  const { language } = useLanguage()
  const [isLoading, setIsLoading] = useState(false)
  // Form, açılan kaydın değerleriyle başlar; modal her kayıt için yeniden oluşturulur (Waitlist.jsx)
  const [formData, setFormData] = useState(() => toFormData(entry))

  // Form validasyonu için state
  const [isFormValid, setIsFormValid] = useState(false)

  // Telefon yalnızca değiştirildiyse denetlenir: eski kayıttaki kısa numara diğer düzenlemeleri engellemesin
  const isPhoneOk =
    phoneDigits(formData.parent_phone) === phoneDigits(entry.parent_phone) ||
    isValidPhone(formData.parent_phone)

  // Form validasyonunu kontrol et
  useEffect(() => {
    const isValid =
      formData.parent_name.trim() !== '' &&
      isPhoneOk &&
      formData.student_name.trim() !== '' &&
      formData.student_age.trim() !== '' &&
      formData.package_type !== '' &&
      formData.contact_date !== null &&
      formData.status !== ''

    setIsFormValid(isValid)
  }, [formData, isPhoneOk])

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!isFormValid) {
      return
    }

    setIsLoading(true)

    try {
      // Yalnızca bu formda değiştirilen alanlar gönderilir: kart açıkken başka bir yöneticinin
      // diğer alanlarda yaptığı değişiklik (ör. durum) eski değerlerle ezilmesin.
      const payload = toPayload(formData)
      const original = toPayload(toFormData(entry))
      const changes = Object.fromEntries(
        Object.entries(payload).filter(([field, value]) => value !== original[field])
      )

      // Değişiklik yoksa istek göndermeden kapat
      if (Object.keys(changes).length === 0) {
        onClose()
        return
      }

      const { data, error } = await supabase
        .from('waitlist')
        .update(changes)
        .eq('id', entry.id)
        .select('id')

      if (error) throw error

      // Hata yok ama güncellenen satır da yok: kayıt bu sırada başkası tarafından silinmiş
      if (!data || data.length === 0) {
        const goneMessage = language === 'tr'
          ? 'Kayıt güncellenemedi: kayıt silinmiş olabilir. Liste yenilendi.'
          : 'The record could not be updated: it may have been deleted. The list was refreshed.'

        onSuccess?.(goneMessage, 'error', { refresh: true })
        onClose()
        return
      }

      const successMessage = language === 'tr'
        ? 'Kayıt başarıyla güncellendi.' 
        : 'Record updated successfully.'

      onSuccess?.(successMessage, 'success')
      onClose()
    } catch (error) {
      console.error('Kayıt güncellenirken hata:', error.message)
      const errorMessage = language === 'tr'
        ? 'Kayıt güncellenirken bir hata oluştu.'
        : 'An error occurred while updating the record.'
      onSuccess?.(errorMessage, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  // Alanı yazılırken düzeltir (baş harf büyütme, yalnızca rakam) ve imleci yerinde tutar
  const handleTextChange = (field, transform) => (e) => {
    changeKeepingCaret(e, transform, (value) => {
      setFormData(prev => ({ ...prev, [field]: value }))
    })
  }

  const showPhoneHint = formData.parent_phone !== '' && !isPhoneOk

  if (!isOpen) return null

  return (
    <>
      <style>
        {`
          .react-datepicker-wrapper {
            width: 100%;
            display: block;
          }
          .react-datepicker {
            font-family: inherit;
            border: none;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 0 0 1px #e5e5e5, 0 8px 16px -4px rgba(0, 0, 0, 0.1);
            background-color: white;
            margin-top: 8px;
          }
          .dark .react-datepicker {
            background-color: #121621;
            box-shadow: 0 0 0 1px #2a3241, 0 8px 16px -4px rgba(0, 0, 0, 0.3);
          }
          .react-datepicker__header {
            background-color: white;
            border-bottom: 1px solid #e5e5e5;
            padding: 16px;
          }
          .dark .react-datepicker__header {
            background-color: #121621;
            border-color: #2a3241;
          }
          .react-datepicker__current-month {
            color: #1d1d1f;
            font-weight: 600;
            font-size: 14px;
            margin-bottom: 8px;
          }
          .dark .react-datepicker__current-month {
            color: white;
          }
          .react-datepicker__day-names {
            margin-top: 8px;
          }
          .react-datepicker__day-name {
            color: #86868b;
            font-size: 12px;
            width: 36px;
            height: 36px;
            line-height: 36px;
            margin: 0;
          }
          .react-datepicker__month {
            margin: 0;
            padding: 12px;
          }
          .react-datepicker__day {
            color: #1d1d1f;
            font-size: 13px;
            width: 36px;
            height: 36px;
            line-height: 36px;
            margin: 0;
            border-radius: 50%;
          }
          .dark .react-datepicker__day {
            color: white;
          }
          .react-datepicker__day:hover {
            background-color: #f5f5f7;
            border-radius: 50%;
          }
          .dark .react-datepicker__day:hover {
            background-color: #2a3241;
          }
          .react-datepicker__day--selected {
            background-color: #0071e3 !important;
            color: white !important;
            font-weight: 500;
          }
          .react-datepicker__day--keyboard-selected {
            background-color: transparent;
            box-shadow: inset 0 0 0 1.5px #0071e3;
          }
          .react-datepicker__day--outside-month {
            color: #86868b;
            opacity: 0.5;
          }
          .react-datepicker__navigation {
            top: 18px;
            width: 24px;
            height: 24px;
          }
          .react-datepicker__navigation--previous {
            left: 16px;
          }
          .react-datepicker__navigation--next {
            right: 16px;
          }
          .react-datepicker__navigation-icon::before {
            border-color: #86868b;
            border-width: 2px 2px 0 0;
            width: 8px;
            height: 8px;
          }
          .react-datepicker__navigation:hover *::before {
            border-color: #1d1d1f;
          }
          .dark .react-datepicker__navigation:hover *::before {
            border-color: white;
          }
          .react-datepicker-popper {
            z-index: 100;
          }
        `}
      </style>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        {/* Overlay */}
        <div 
          className="fixed inset-0 bg-black bg-opacity-25 backdrop-blur-sm transition-opacity"
        />

        {/* Modal */}
        <div className="flex min-h-screen items-center justify-center p-4">
          <div 
            className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-[#121621] p-6 shadow-xl transition-all"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute right-4 top-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#2a3241] transition-colors"
            >
              <XMarkIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>

            {/* Header */}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold text-[#1d1d1f] dark:text-white">
                {language === 'tr' ? 'Kaydı Güncelle' : 'Update Record'}
              </h2>
              <p className="mt-1 text-[#6e6e73] dark:text-[#86868b]">
                {language === 'tr' ? 'Lütfen güncellemek istediğiniz bilgileri düzenleyin' : 'Please edit the information you want to update'}
              </p>
            </div>

            {/* Form */}
            <form 
              className="grid md:grid-cols-2 grid-cols-1 gap-x-6 gap-y-4"
              onSubmit={handleSubmit}
            >
              {/* Sol Kolon */}
              <div className="space-y-4">
                {/* Veli İsmi */}
                <div className="relative">
                  <div className={iconWrapperClasses}>
                    <UsersIcon className={iconClasses} />
                  </div>
                  <input
                    type="text"
                    required
                    value={formData.parent_name}
                    onChange={handleTextChange('parent_name', capitalizeName)}
                    className={inputClasses}
                    placeholder={language === 'tr' ? "Veli İsmi" : "Parent Name"}
                    tabIndex={1}
                    autoComplete="off"
                  />
                </div>

                {/* Telefon Numarası */}
                <div className="relative">
                  <div className={iconWrapperClasses}>
                    <PhoneIcon className={iconClasses} />
                  </div>
                  <input
                    type="tel"
                    required
                    value={formData.parent_phone}
                    onChange={handleTextChange('parent_phone', phoneDigits)}
                    className={inputClasses}
                    placeholder={language === 'tr' ? "Telefon Numarası" : "Phone Number"}
                    tabIndex={2}
                    autoComplete="off"
                  />
                  {showPhoneHint && (
                    <p className="absolute left-1 top-full text-[11px] leading-4 text-[#6e6e73] dark:text-[#86868b]">
                      {language === 'tr' ? 'Telefon numarası 10-15 haneli olmalı' : 'Phone number must be 10-15 digits'}
                    </p>
                  )}
                </div>

                {/* Çocuk Adı */}
                <div className="relative">
                  <div className={iconWrapperClasses}>
                    <FaceSmileIcon className={iconClasses} />
                  </div>
                  <input
                    type="text"
                    required
                    value={formData.student_name}
                    onChange={handleTextChange('student_name', capitalizeName)}
                    className={inputClasses}
                    placeholder={language === 'tr' ? "Öğrenci İsmi" : "Student Name"}
                    tabIndex={3}
                    autoComplete="off"
                  />
                </div>

                {/* Yaş/Aylık */}
                <div className="relative">
                  <div className={iconWrapperClasses}>
                    <CakeIcon className={iconClasses} />
                  </div>
                  <input
                    type="text"
                    required
                    value={formData.student_age}
                    onChange={handleTextChange('student_age', capitalizeWords)}
                    className={inputClasses}
                    placeholder={language === 'tr' ? "Yaş/Aylık - Örn:24 Aylık / 2 Yaş" : "Age/Months - Ex:24 Months / 2 Years"}
                    tabIndex={4}
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Sağ Kolon */}
              <div className="space-y-4">
                {/* Paket Türü */}
                <div className="relative">
                  <div className={iconWrapperClasses}>
                    <CubeIcon className={iconClasses} />
                  </div>
                  <select 
                    required
                    value={formData.package_type}
                    onChange={(e) => setFormData(prev => ({ ...prev, package_type: e.target.value }))}
                    className={`${inputClasses} ${!formData.package_type && 'text-[#86868b]'}`}
                    tabIndex={5}
                    autoComplete="off"
                  >
                    <option value="" disabled className="text-[#86868b] dark:text-[#86868b] bg-white dark:bg-[#121621]">
                      {language === 'tr' ? "İlgilenilen Paket Türü" : "Interested Package Type"}
                    </option>
                    <option value="belirsiz" className="text-[#1d1d1f] dark:text-white bg-white dark:bg-[#121621]">
                      {language === 'tr' ? "Belirsiz" : "Uncertain"}
                    </option>
                    <option value="tek-seferlik" className="text-[#1d1d1f] dark:text-white bg-white dark:bg-[#121621]">
                      {language === 'tr' ? "Tek Seferlik Katılım" : "One Time Participation"}
                    </option>
                    <option value="hafta-1" className="text-[#1d1d1f] dark:text-white bg-white dark:bg-[#121621]">
                      {language === 'tr' ? "Haftada 1 Gün" : "1 Day Per Week"}
                    </option>
                    <option value="hafta-2" className="text-[#1d1d1f] dark:text-white bg-white dark:bg-[#121621]">
                      {language === 'tr' ? "Haftada 2 Gün" : "2 Days Per Week"}
                    </option>
                    <option value="hafta-3" className="text-[#1d1d1f] dark:text-white bg-white dark:bg-[#121621]">
                      {language === 'tr' ? "Haftada 3 Gün" : "3 Days Per Week"}
                    </option>
                    <option value="hafta-4" className="text-[#1d1d1f] dark:text-white bg-white dark:bg-[#121621]">
                      {language === 'tr' ? "Haftada 4 Gün" : "4 Days Per Week"}
                    </option>
                    <option value="3ay-hafta-1" className="text-[#1d1d1f] dark:text-white bg-white dark:bg-[#121621]">
                      {language === 'tr' ? "3 Aylık - 12 Atölye" : "3 Months - 12 Workshops"}
                    </option>
                    <option value="3ay-hafta-2" className="text-[#1d1d1f] dark:text-white bg-white dark:bg-[#121621]">
                      {language === 'tr' ? "3 Aylık - 24 Atölye" : "3 Months - 24 Workshops"}
                    </option>
                  </select>
                </div>

                {/* Aranılan Tarih */}
                <DatePicker
                  selected={formData.contact_date}
                  onChange={(date) => setFormData(prev => ({ ...prev, contact_date: date }))}
                  dateFormat="dd.MM.yyyy"
                  locale={language === 'tr' ? 'tr' : 'en'}
                  customInput={<DateInput />}
                  placeholderText={language === 'tr' ? "Tarih Seçin" : "Select Date"}
                  showPopperArrow={false}
                />

                {/* Durum */}
                <div className="relative">
                  <div className={iconWrapperClasses}>
                    <ClockIcon className={iconClasses} />
                  </div>
                  <select 
                    required
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    className={`${inputClasses} ${!formData.status && 'text-[#86868b]'}`}
                    tabIndex={7}
                    autoComplete="off"
                  >
                    <option value="" disabled className="text-[#86868b] dark:text-[#86868b] bg-white dark:bg-[#121621]">
                      {language === 'tr' ? "Durum" : "Status"}
                    </option>
                    <option value="beklemede" className="text-[#1d1d1f] dark:text-white bg-white dark:bg-[#121621]">
                      {language === 'tr' ? "Beklemede" : "Waiting"}
                    </option>
                    <option value="iletisime-gecildi" className="text-[#1d1d1f] dark:text-white bg-white dark:bg-[#121621]">
                      {language === 'tr' ? "İletişime Geçildi" : "Contacted"}
                    </option>
                  </select>
                </div>

                {/* Notlar */}
                <div className="relative">
                  <div className={iconWrapperClasses}>
                    <PencilSquareIcon className={iconClasses} />
                  </div>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={handleTextChange('notes', upperFirst)}
                    className={inputClasses}
                    placeholder={language === 'tr' ? "Not ekle..." : "Add note..."}
                    tabIndex={8}
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="md:col-span-2 grid grid-cols-2 gap-4 mt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full h-11 bg-gray-100 dark:bg-[#1d1d1f] text-[#1d1d1f] dark:text-white font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-[#161616] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-200 dark:focus:ring-[#2a2a2a] transition-all transform hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50"
                  tabIndex={9}
                  disabled={isLoading}
                >
                  {language === 'tr' ? 'İptal' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="w-full h-11 bg-[#1d1d1f] dark:bg-[#0071e3] text-white font-medium rounded-xl hover:bg-black dark:hover:bg-[#0077ed] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0071e3] transition-all transform hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  tabIndex={10}
                  disabled={!isFormValid || isLoading}
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>{language === 'tr' ? 'Güncelleniyor' : 'Updating'}</span>
                    </>
                  ) : (
                    language === 'tr' ? 'Güncelle' : 'Update'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  )
} 