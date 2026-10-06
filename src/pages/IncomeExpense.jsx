import React, { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllRows } from '../lib/fetchAll'
import { matchesSearch } from '../lib/text'
import { EXPENSE_TYPES, expenseTypeLabel, paymentMethodLabel, paymentStatusLabel, packageShortLabel } from '../lib/labels'
import { useLanguage } from '../context/LanguageContext'
import {
  BanknotesIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ScaleIcon,
  ClockIcon,
  PlusIcon,
  XMarkIcon,
  AdjustmentsHorizontalIcon,
  CheckCircleIcon,
  PencilSquareIcon,
  TrashIcon,
  CalendarDaysIcon,
  ChartPieIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import CreateExpenses from '../components/CreateExpenses'
import UpdateExpensesModal from '../components/UpdateExpensesModal'
import DeleteExpensesModal from '../components/DeleteExpensesModal'
import DatePicker, { registerLocale } from 'react-datepicker'
import { startOfDay, endOfDay, subDays } from 'date-fns'
import { tr } from 'date-fns/locale'
import 'react-datepicker/dist/react-datepicker.css'

// Türkçe lokalizasyonu kaydet
registerLocale('tr', tr)

// Custom DatePicker Styles
const customDatePickerStyles = `
  .react-datepicker {
    font-family: inherit;
    border: none;
    border-radius: 24px;
    background: #fff;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
    padding: 24px;
    margin-top: 8px;
    backdrop-filter: blur(20px);
  }

  .dark .react-datepicker {
    background: #121621;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
  }

  .react-datepicker__close-icon {
    padding-right: 10px;
  }

  .react-datepicker__close-icon::after {
    background-color: transparent !important;
    color: #216ba5;
    height: 25px;
    width: 25px;
    font-size: 25px;
    line-height: 1;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .dark .react-datepicker__close-icon::after {
    color: #0071e3;
  }

  .react-datepicker__header {
    background: transparent;
    border: none;
    padding: 0;
  }

  .react-datepicker__month {
    margin: 0;
    padding: 12px 0;
  }

  .react-datepicker__day-names {
    display: flex;
    justify-content: space-between;
    margin: 16px 0 8px;
    padding: 0 8px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    padding-bottom: 12px;
  }

  .dark .react-datepicker__day-names {
    border-color: rgba(255, 255, 255, 0.1);
  }

  .react-datepicker__day-name {
    color: #86868b;
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
    width: 40px;
    height: 40px;
    line-height: 40px;
    margin: 0;
  }

  .react-datepicker__month-container {
    float: none;
    background: transparent;
  }

  .react-datepicker__week {
    display: flex;
    justify-content: space-between;
    margin: 4px 0;
    padding: 0 8px;
  }

  .react-datepicker__day {
    width: 40px;
    height: 40px;
    line-height: 40px;
    margin: 0;
    border-radius: 50%;
    color: #1d1d1f;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s ease;
    position: relative;
  }

  .dark .react-datepicker__day {
    color: #fff;
  }

  .react-datepicker__day:hover:not(.react-datepicker__day--selected):not(.react-datepicker__day--in-range) {
    background: rgba(0, 113, 227, 0.1);
    border-radius: 50%;
  }

  .dark .react-datepicker__day:hover:not(.react-datepicker__day--selected):not(.react-datepicker__day--in-range) {
    background: rgba(0, 113, 227, 0.2);
  }

  .react-datepicker__day--keyboard-selected {
    background: none;
  }

  .react-datepicker__day--in-range {
    background: #0071e3 !important;
    color: white !important;
    border-radius: 0;
  }

  .dark .react-datepicker__day--in-range {
    background: #0071e3 !important;
    color: white !important;
  }

  .react-datepicker__day--in-selecting-range {
    background: #0071e3 !important;
    color: white !important;
    border-radius: 0;
  }

  .dark .react-datepicker__day--in-selecting-range {
    background: #0071e3 !important;
    color: white !important;
  }

  .react-datepicker__day--selecting-range-start,
  .react-datepicker__day--range-start,
  .react-datepicker__day--range-end,
  .react-datepicker__day--selected {
    background: #0071e3 !important;
    color: white !important;
    border-radius: 50% !important;
    font-weight: 600;
  }

  .react-datepicker__day--range-start {
    border-top-right-radius: 0 !important;
    border-bottom-right-radius: 0 !important;
  }

  .react-datepicker__day--range-end {
    border-top-left-radius: 0 !important;
    border-bottom-left-radius: 0 !important;
  }

  .react-datepicker__day--outside-month {
    color: #86868b;
    opacity: 0.5;
  }

  .dark .react-datepicker__day--outside-month {
    color: #86868b;
    opacity: 0.3;
  }

  .react-datepicker__triangle {
    display: none;
  }

  .ie-range-popper {
    animation: datePickerSlideDown 0.2s ease-out forwards;
    opacity: 0;
    top: 40px !important;
  }

  @media (min-width: 1024px) {
    .ie-range-popper {
      left: -100px !important;
    }
  }

  @media (max-width: 1023px) {
    .ie-range-popper {
      left: 0 !important;
    }
  }

  .ie-range-popper[data-placement^='bottom'] {
    top: 40px !important;
  }

  @media (min-width: 1024px) {
    .ie-range-popper[data-placement^='bottom'] {
      left: -100px !important;
    }
  }

  @media (max-width: 1023px) {
    .ie-range-popper[data-placement^='bottom'] {
      left: 0 !important;
    }
  }

  .ie-range-popper[data-placement^='top'] {
    top: auto !important;
  }

  @media (min-width: 1024px) {
    .ie-range-popper[data-placement^='top'] {
      left: -100px !important;
    }
  }

  @media (max-width: 1023px) {
    .ie-range-popper[data-placement^='top'] {
      left: 0 !important;
    }
  }

  @keyframes datePickerSlideDown {
    from {
      opacity: 0;
      transform: translateY(-16px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .react-datepicker__day--today {
    position: relative;
    font-weight: 600;
    color: #0071e3;
  }

  .dark .react-datepicker__day--today {
    color: #0071e3;
  }

  .react-datepicker__day--today::after {
    content: '';
    position: absolute;
    bottom: 6px;
    left: 50%;
    transform: translateX(-50%);
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #0071e3;
  }
`;

// Skeleton Components
const SummaryCardSkeleton = () => (
  <div className="bg-white dark:bg-[#121621] rounded-2xl border border-[#d2d2d7] dark:border-[#2a3241] overflow-hidden">
    <div className="h-1 w-full bg-gray-200 dark:bg-gray-700" />
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="w-7 h-7 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>
      <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
    </div>
  </div>
)

const TableSkeleton = () => (
  <div className="bg-white dark:bg-[#121621] rounded-2xl border border-[#d2d2d7] dark:border-[#2a3241] p-6">
    <div className="flex items-center justify-between mb-6">
      <div className="space-y-2">
        <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded " />
        <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded " />
      </div>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-gray-200 dark:bg-gray-700 rounded-xl " />
        <div className="h-[38px] w-32 bg-gray-200 dark:bg-gray-700 rounded-xl " />
      </div>
    </div>
    
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full align-middle">
        <div className="overflow-hidden">
          <div className="border-b-2 border-[#d2d2d7] dark:border-[#2a3241] pb-4 mb-4">
            <div className="grid grid-cols-6 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-4 bg-gray-200 dark:bg-gray-700 rounded " />
      ))}
    </div>
          </div>
          <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="w-full h-16 bg-gray-200 dark:bg-gray-700 rounded-xl " />
        ))}
          </div>
        </div>
      </div>
    </div>
  </div>
)

const ChartSkeleton = () => (
  <div className="bg-white dark:bg-[#121621] rounded-2xl border border-[#d2d2d7] dark:border-[#2a3241] p-6">
    <div className="flex items-center justify-between mb-8">
      <div className="space-y-2">
        <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded " />
        <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded " />
      </div>
      <div className="flex items-center gap-4">
        <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded " />
        <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded " />
      </div>
    </div>
    <div className="h-[300px] bg-gray-200 dark:bg-gray-700 rounded-xl " />
    <div className="mt-6 space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gray-200 dark:bg-gray-700 " />
            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded " />
          </div>
          <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded " />
        </div>
      ))}
    </div>
  </div>
)

// Gider kategorilerinin grafik renkleri
const EXPENSE_TYPE_COLORS = {
  kira: '#0071e3',
  elektrik: '#34d399',
  su: '#fbbf24',
  dogalgaz: '#f87171',
  internet: '#a78bfa',
  maas: '#60a5fa',
  malzeme: '#fb923c',
  mutfak: '#4ade80',
  reklam: '#f472b6',
  filament: '#22d3ee',
  diger: '#94a3b8'
}

// Gelir sayılan ödeme türleri
const INCOME_TRANSACTION_TYPES = ['initial_payment', 'extension_payment']

// Gelir tablosunda bir ödeme satırı için okunan alanlar: ödemenin kendisi, ait olduğu kayıt ve
// (uzatma ödemesiyse) bağlı uzatma satırı. Uzatma, ilişki üzerinden tek satır olarak gelir.
// requireRegistration: kayıt üzerinden süzme yapılacaksa (ör. yalnızca aktif öğrenciler) true
const incomeRowFields = (requireRegistration = false) => `
  id,
  amount,
  payment_method,
  payment_status,
  created_at,
  transaction_type,
  registration_id,
  extension_history_id,
  payment_date,
  registrations${requireRegistration ? '!inner' : ''} (
    student_name,
    parent_name,
    package_type,
    package_start_date,
    package_end_date,
    is_active,
    initial_start_date,
    initial_end_date,
    initial_package_type
  ),
  extension_history (
    new_start_date,
    new_end_date,
    new_package_type,
    previous_end_date
  )
`

// Ödeme satırını tablo satırına çevirir (paket ve dönem: ödemenin ait olduğu paket)
const toIncomeRow = (record) => {
  const registration = record.registrations || {}
  const extension = record.extension_history

  let displayStartDate, displayEndDate, displayPackageType

  if (record.transaction_type === 'initial_payment') {
    // İlk kayıt için kaydedilen ilk tarihleri kullan
    displayStartDate = registration.initial_start_date || registration.package_start_date
    displayEndDate = registration.initial_end_date || registration.package_end_date
    displayPackageType = registration.initial_package_type || registration.package_type
  } else if (extension) {
    // Uzatma ödemesi: bağlı uzatma satırının dönemi (eski satırlarda başlangıç ayrıca
    // tutulmuyordu; o zaman dönem, önceki paketin bitişinden başlar)
    displayStartDate = extension.new_start_date || extension.previous_end_date
    displayEndDate = extension.new_end_date
    displayPackageType = extension.new_package_type
  } else {
    // Uzatma satırı kalmamış ödeme: kaydın güncel paketi gösterilir
    displayStartDate = registration.package_start_date
    displayEndDate = registration.package_end_date
    displayPackageType = registration.package_type
  }

  return {
    id: record.id,
    student: registration.student_name || '',
    parent: registration.parent_name || '',
    package: displayPackageType,
    date: displayStartDate,
    end_date: displayEndDate,
    is_active: registration.is_active,
    amount: Number(record.amount) || 0,
    method: record.payment_method,
    status: record.payment_status,
    payment_date: record.payment_date, // bekleyen ödemede yoktur
    transaction_type: record.transaction_type,
    created_at: record.created_at
  }
}

const sumAmounts = (rows) => rows.reduce((total, row) => total + (Number(row.amount) || 0), 0)

const INITIAL_INCOME_FILTERS = {
  paymentMethod: [], // çoklu seçim
  paymentStatus: '',
  activeStatus: '',
  search: ''
}

const INITIAL_EXPENSE_FILTERS = {
  expenseType: '',
  paymentMethod: ''
}

export default function IncomeExpense() {
  const { language } = useLanguage()
  const [isLoading, setIsLoading] = useState(true)
  const [isChartLoading, setIsChartLoading] = useState(true)
  // Yüklenemeyen bölümler: önceki dönemin rakamları yeni tarihlerin altında kalmasın
  const [loadFailed, setLoadFailed] = useState({ period: false, chart: false })
  const [isCreateExpenseModalOpen, setIsCreateExpenseModalOpen] = useState(false)

  // Seçili tarih aralığının verisi: ödenmiş gelir satırları ve giderler.
  // Bekleyen tahsilatlar tarihten bağımsızdır (aktif öğrencilerin ödenmemiş kayıtları).
  const [paidIncomeRows, setPaidIncomeRows] = useState([])
  const [pendingIncomeRows, setPendingIncomeRows] = useState([])
  const [expenseRows, setExpenseRows] = useState([])

  // Grafik verisi için state
  const [chartData, setChartData] = useState([])
  const [chartRange, setChartRange] = useState(6) // Yeni state: default 6 ay

  // Filtreler için state (filtreler tarayıcıda uygulanır; yeniden veri indirilmez)
  const [incomeFilters, setIncomeFilters] = useState(INITIAL_INCOME_FILTERS)
  const [expenseFilters, setExpenseFilters] = useState(INITIAL_EXPENSE_FILTERS)

  const [isIncomeFilterSheetOpen, setIsIncomeFilterSheetOpen] = useState(false)
  const [isExpenseFilterSheetOpen, setIsExpenseFilterSheetOpen] = useState(false)

  // Modal states
  const [selectedExpense, setSelectedExpense] = useState(null)
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  // Tarih aralığı için state
  const [dateRange, setDateRange] = useState([
    new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
  ])

  // Art arda gönderilen isteklerden yalnızca sonuncusunun yanıtı kullanılır
  const periodRequestRef = useRef(0)
  const chartRequestRef = useRef(0)

  // Hızlı tarih seçimi için yardımcı fonksiyonlar
  // (Aralık gün başlarıyla kurulur: "şu an"dan başlayan aralık, günün başına kayıtlı
  // bugünkü ödemeleri dışarıda bırakıyordu ve "Bugün" hep 0 ₺ gelir gösteriyordu.)
  const handleQuickDateSelect = (option) => {
    const today = startOfDay(new Date())
    let start, end

    switch (option) {
      case 'today':
        start = today
        end = today
        break
      case 'last14':
        start = subDays(today, 13) // bugün dahil son 14 gün
        end = today
        break
      case 'thisMonth':
        start = new Date(today.getFullYear(), today.getMonth(), 1)
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
        break
      case 'lastMonth':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        end = new Date(today.getFullYear(), today.getMonth(), 0)
        break
      default:
        return
    }

    setDateRange([start, end])
  }

  // Seçili tarih aralığının verilerini getir (özet kartları, tablolar, gider dağılımı)
  const fetchPeriodData = async () => {
    // Eğer tarih aralığı tam değilse işlemi yapma
    if (!dateRange[0] || !dateRange[1]) return

    const requestId = ++periodRequestRef.current
    setIsLoading(true)

    // Aralık: ilk günün başından son günün sonuna
    const rangeStart = startOfDay(dateRange[0]).toISOString()
    const rangeEnd = endOfDay(dateRange[1]).toISOString()

    try {
      // Sorgular birlikte çalışır; uzun listeler sayfa sayfa okunur (bkz. lib/fetchAll.js).
      const [paidRecords, pendingRecords, expenseRecords] = await Promise.all([
        // 1. Ödenmiş gelirler: ödeme tarihi aralıkta olanlar (sunucuda süzülür)
        fetchAllRows(() => supabase
          .from('financial_records')
          .select(incomeRowFields())
          .in('transaction_type', INCOME_TRANSACTION_TYPES)
          .eq('payment_status', 'odendi')
          .gte('payment_date', rangeStart)
          .lte('payment_date', rangeEnd)
          .order('payment_date', { ascending: false })
          .order('created_at', { ascending: false })
          .order('id', { ascending: true })),
        // 2. Bekleyen tahsilatlar: aktif öğrencilerin ödenmemiş kayıtları (tarihten bağımsız;
        //    ödenmemiş kaydın ödeme tarihi olmaz)
        fetchAllRows(() => supabase
          .from('financial_records')
          .select(incomeRowFields(true))
          .in('transaction_type', INCOME_TRANSACTION_TYPES)
          .eq('payment_status', 'beklemede')
          .eq('registrations.is_active', true)
          .order('created_at', { ascending: false })
          .order('id', { ascending: true })),
        // 3. Giderler: gider tarihi aralıkta olanlar
        fetchAllRows(() => supabase
          .from('expenses')
          .select('*')
          .gte('expense_date', rangeStart)
          .lte('expense_date', rangeEnd)
          .order('expense_date', { ascending: false })
          .order('created_at', { ascending: false })
          .order('id', { ascending: true }))
      ])

      // Bu sırada yeni bir istek gönderildiyse eski yanıt yok sayılır
      if (requestId !== periodRequestRef.current) return

      setPaidIncomeRows(paidRecords.map(toIncomeRow))
      setPendingIncomeRows(pendingRecords.map(toIncomeRow))
      setExpenseRows(expenseRecords.map(record => ({
        id: record.id,
        title: record.description,
        category: record.expense_type,
        date: record.expense_date,
        notes: record.notes || '',
        amount: Number(record.amount) || 0,
        method: record.payment_method
      })))
      setLoadFailed(prev => ({ ...prev, period: false }))
    } catch (error) {
      if (requestId !== periodRequestRef.current) return

      console.error('Gelir/gider verileri getirilirken hata:', error.message)
      // Önceki dönemin rakamları yeni tarihlerin altında görünmesin
      setPaidIncomeRows([])
      setPendingIncomeRows([])
      setExpenseRows([])
      setLoadFailed(prev => ({ ...prev, period: true }))
    } finally {
      if (requestId === periodRequestRef.current) {
        setIsLoading(false)
      }
    }
  }

  // Aylık gelir & gider grafiğinin verilerini getir (son `chartRange` ay)
  const fetchChartData = async () => {
    const requestId = ++chartRequestRef.current
    setIsChartLoading(true)

    try {
      // Grafik tam aylardan oluşur: ilk ay, ayın 1'inden başlar. (Eskiden "bugünden N-1 ay
      // önce, bugünün günü ve saati"nden başlıyordu; ilk ay eksik çıkıyordu.)
      const now = new Date()
      const firstMonth = new Date(now.getFullYear(), now.getMonth() - (chartRange - 1), 1)

      const [incomeRecords, expenseRecords] = await Promise.all([
        // Gelirler - hem ilk kayıt hem uzatma işlemleri; ödeme tarihine göre
        fetchAllRows(() => supabase
          .from('financial_records')
          .select('id, amount, payment_date')
          .in('transaction_type', INCOME_TRANSACTION_TYPES)
          .eq('payment_status', 'odendi')
          .gte('payment_date', firstMonth.toISOString())
          .order('payment_date', { ascending: true })
          .order('id', { ascending: true })),
        // Giderler
        fetchAllRows(() => supabase
          .from('expenses')
          .select('id, amount, expense_date')
          .gte('expense_date', firstMonth.toISOString())
          .order('expense_date', { ascending: true })
          .order('id', { ascending: true }))
      ])

      if (requestId !== chartRequestRef.current) return

      // Ay kutuları: ayın 1'i üzerinden kurulur. (Bugünün tarihinden ay çıkarmak, ayın
      // 29-31'inde bazı ayları iki kez üretip bazılarını atlıyordu.)
      const monthKeyOf = (date) => `${date.getFullYear()}-${date.getMonth() + 1}`
      const monthlyData = {}
      for (let i = chartRange - 1; i >= 0; i--) {
        const month = new Date(now.getFullYear(), now.getMonth() - i, 1)
        monthlyData[monthKeyOf(month)] = { month, gelir: 0, gider: 0 }
      }

      // Gelirleri ekle - ödeme tarihine göre gruplanır
      incomeRecords.forEach(record => {
        const bucket = monthlyData[monthKeyOf(new Date(record.payment_date))]
        if (bucket) bucket.gelir += Number(record.amount) || 0
      })

      // Giderleri ekle
      expenseRecords.forEach(record => {
        const bucket = monthlyData[monthKeyOf(new Date(record.expense_date))]
        if (bucket) bucket.gider += Number(record.amount) || 0
      })

      setChartData(Object.values(monthlyData))
      setLoadFailed(prev => ({ ...prev, chart: false }))
    } catch (error) {
      if (requestId !== chartRequestRef.current) return

      console.error('Grafik verileri getirilirken hata:', error.message)
      setChartData([])
      setLoadFailed(prev => ({ ...prev, chart: true }))
    } finally {
      if (requestId === chartRequestRef.current) {
        setIsChartLoading(false)
      }
    }
  }

  // Tüm verileri getir (gider eklendi/düzenlendi/silindiğinde ve "Tekrar dene"de)
  const fetchAllData = () => {
    fetchPeriodData()
    fetchChartData()
  }

  // Tarih aralığı değişince dönem verisi yeniden yüklenir
  useEffect(() => {
    // Eğer dateRange'in her iki değeri de varsa (başlangıç ve bitiş) veriyi getir
    if (dateRange[0] && dateRange[1]) {
      fetchPeriodData()
    }
  }, [dateRange])

  // Grafik aralığı değişince yalnızca grafik yeniden yüklenir
  useEffect(() => {
    fetchChartData()
  }, [chartRange])

  // --- Filtreler ve toplamlar: hepsi aynı satırlardan, tek yerde hesaplanır ---

  // "Bekleyen Tahsilatlar" görünümü: tablo bekleyen kayıtları listeler
  const isPendingView = incomeFilters.paymentStatus === 'beklemede'

  // Ödeme yöntemi ve öğrenci durumu filtreleri
  const matchesIncomeFilters = (item) => {
    const methodMatch = !incomeFilters.paymentMethod.length || incomeFilters.paymentMethod.includes(item.method)
    const activeStatusMatch = !incomeFilters.activeStatus ||
      (incomeFilters.activeStatus === 'active' ? Boolean(item.is_active) : !item.is_active)
    return methodMatch && activeStatusMatch
  }

  // Gelir kartı: aralıktaki ödenmiş gelir (yöntem / öğrenci durumu filtreleriyle).
  // Arama kutusu yalnızca tabloyu süzer, kartları değiştirmez.
  const filteredPaidIncome = useMemo(
    () => paidIncomeRows.filter(matchesIncomeFilters),
    [paidIncomeRows, incomeFilters.paymentMethod, incomeFilters.activeStatus]
  )

  // Gelir tablosu: varsayılan olarak ödenmiş kayıtlar; bekleyenler görünümünde bekleyen kayıtlar
  const incomeTableRows = useMemo(() => {
    const rows = isPendingView ? pendingIncomeRows.filter(matchesIncomeFilters) : filteredPaidIncome
    const search = incomeFilters.search.trim()
    if (!search) return rows
    return rows.filter(item => matchesSearch(item.student, search) || matchesSearch(item.parent, search))
  }, [isPendingView, pendingIncomeRows, filteredPaidIncome, incomeFilters.paymentMethod, incomeFilters.activeStatus, incomeFilters.search])

  const expenseTableRows = useMemo(
    () => expenseRows.filter(item => (
      (!expenseFilters.paymentMethod || item.method === expenseFilters.paymentMethod) &&
      (!expenseFilters.expenseType || item.category === expenseFilters.expenseType)
    )),
    [expenseRows, expenseFilters.paymentMethod, expenseFilters.expenseType]
  )

  const hasIncomeCardFilter = incomeFilters.paymentMethod.length > 0 || Boolean(incomeFilters.activeStatus)
  const hasExpenseFilter = Boolean(expenseFilters.expenseType || expenseFilters.paymentMethod)

  // Kartlar: Net Kazanç her zaman Gelir kartı eksi Gider kartıdır
  const incomeTotal = useMemo(() => sumAmounts(filteredPaidIncome), [filteredPaidIncome])
  const expenseTotal = useMemo(() => sumAmounts(expenseTableRows), [expenseTableRows])
  const netIncome = incomeTotal - expenseTotal
  const pendingCount = pendingIncomeRows.length

  // Gider dağılımı (kategorilere göre, tutara göre büyükten küçüğe): aralıktaki tüm giderler
  const expenseDistribution = useMemo(() => {
    const totals = {}
    expenseRows.forEach(item => {
      if (!totals[item.category]) {
        totals[item.category] = {
          name: item.category,
          value: 0,
          color: EXPENSE_TYPE_COLORS[item.category] || EXPENSE_TYPE_COLORS.diger
        }
      }
      totals[item.category].value += item.amount
    })
    return Object.values(totals).sort((a, b) => b.value - a.value)
  }, [expenseRows])

  // Grafikte ay adları arayüz diliyle yazılır
  const chartRows = useMemo(
    () => chartData.map(row => ({
      name: row.month.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', { month: 'long' }),
      gelir: row.gelir,
      gider: row.gider
    })),
    [chartData, language]
  )

  // Para formatı
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 2, // Değiştirildi: 0 -> 2
      maximumFractionDigits: 2  // Değiştirildi: 0 -> 2
    }).format(amount)
  }

  // Tooltip için para formatı
  const formatTooltipValue = (value) => {
    return formatCurrency(value)
  }

  // Grafik ekseni için kısa para yazımı ("360.000 ₺"); tam yazım eksene sığmayıp kesiliyordu
  const formatAxisValue = (value) => {
    return `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(value)} ₺`
  }

  // Handle update
  const handleUpdate = () => {
    fetchAllData()
  }

  // Handle delete
  const handleDelete = () => {
    fetchAllData()
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between h-auto lg:h-16 px-6 border-b border-[#d2d2d7] dark:border-[#2a3241] py-4 lg:py-0 gap-4 lg:gap-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-medium text-[#1d1d1f] dark:text-white">
            {language === 'tr' ? 'Gelir/Gider' : 'Income/Expense'}
          </h1>
        </div>

        {/* Date Range Picker ve Quick Selection Buttons */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3 w-full lg:w-auto">
          {/* Quick Selection Buttons */}
          <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0">
            <button
              onClick={() => handleQuickDateSelect('today')}
              className="h-9 px-4 rounded-lg text-sm font-medium bg-white dark:bg-[#121621] text-[#1d1d1f] dark:text-white border border-[#d2d2d7] dark:border-[#2a3241] hover:border-[#0071e3] dark:hover:border-[#0071e3] transition-colors whitespace-nowrap"
            >
              {language === 'tr' ? 'Bugün' : 'Today'}
            </button>
            <button
              onClick={() => handleQuickDateSelect('last14')}
              className="h-9 px-4 rounded-lg text-sm font-medium bg-white dark:bg-[#121621] text-[#1d1d1f] dark:text-white border border-[#d2d2d7] dark:border-[#2a3241] hover:border-[#0071e3] dark:hover:border-[#0071e3] transition-colors whitespace-nowrap"
            >
              {language === 'tr' ? 'Son 14 Gün' : 'Last 14 Days'}
            </button>
            <button
              onClick={() => handleQuickDateSelect('lastMonth')}
              className="h-9 px-4 rounded-lg text-sm font-medium bg-white dark:bg-[#121621] text-[#1d1d1f] dark:text-white border border-[#d2d2d7] dark:border-[#2a3241] hover:border-[#0071e3] dark:hover:border-[#0071e3] transition-colors whitespace-nowrap"
            >
              {language === 'tr' ? 'Geçen Ay' : 'Last Month'}
            </button>
            <button
              onClick={() => handleQuickDateSelect('thisMonth')}
              className="h-9 px-4 rounded-lg text-sm font-medium bg-white dark:bg-[#121621] text-[#1d1d1f] dark:text-white border border-[#d2d2d7] dark:border-[#2a3241] hover:border-[#0071e3] dark:hover:border-[#0071e3] transition-colors whitespace-nowrap"
            >
              {language === 'tr' ? 'Bu Ay' : 'This Month'}
            </button>
          </div>

          {/* Date Range Picker */}
          <div className="relative w-full lg:w-auto">
            <style>{customDatePickerStyles}</style>
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <CalendarDaysIcon className="w-5 h-5 text-[#86868b]" />
            </div>
            <DatePicker
              selectsRange={true}
              startDate={dateRange[0]}
              endDate={dateRange[1]}
              onChange={(update) => setDateRange(update)}
              dateFormat="dd.MM.yyyy"
              locale={language === 'tr' ? 'tr' : 'en'}
              className="h-10 pl-4 pr-4 rounded-lg text-sm font-medium bg-white dark:bg-[#121621] text-[#1d1d1f] dark:text-white border border-[#d2d2d7] dark:border-[#2a3241] hover:border-[#0071e3] dark:hover:border-[#0071e3] transition-all cursor-pointer w-full lg:w-[210px] focus:outline-none focus:ring-2 focus:ring-[#0071e3] focus:ring-opacity-50 focus:border-[#0071e3]"
              placeholderText={language === 'tr' ? 'Tarih Aralığı Seçin' : 'Select Date Range'}
              showPopperArrow={false}
              popperClassName="ie-range-popper"
              renderCustomHeader={({
                date,
                decreaseMonth,
                increaseMonth,
                prevMonthButtonDisabled,
                nextMonthButtonDisabled
              }) => (
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={decreaseMonth}
                    disabled={prevMonthButtonDisabled}
                    type="button"
                    className="p-2 rounded-xl hover:bg-[#f5f5f7] dark:hover:bg-[#2a3241] transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    <svg className="w-5 h-5 text-[#1d1d1f] dark:text-white opacity-75 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white tracking-[-0.01em]">
                    {date.toLocaleString(language === 'tr' ? 'tr' : 'en', { 
                      month: 'long',
                      year: 'numeric'
                    }).split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                  </div>
                  <button
                    onClick={increaseMonth}
                    disabled={nextMonthButtonDisabled}
                    type="button"
                    className="p-2 rounded-xl hover:bg-[#f5f5f7] dark:hover:bg-[#2a3241] transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    <svg className="w-5 h-5 text-[#1d1d1f] dark:text-white opacity-75 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
            />
          </div>
        </div>
      </div>

      {/* Income Filter Sheet */}
      <div className={`
        fixed right-0 top-0 h-full w-[400px] bg-white dark:bg-[#121621] shadow-xl z-50 transform transition-transform duration-300
        ${isIncomeFilterSheetOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="h-full flex flex-col">
          {/* Sheet Header */}
          <div className="flex items-center justify-between px-6 h-16 border-b border-[#d2d2d7] dark:border-[#2a3241] shrink-0">
            <h2 className="text-lg font-medium text-[#1d1d1f] dark:text-white">
              {language === 'tr' ? 'Gelir Filtreleri' : 'Income Filters'}
            </h2>
            <button
              onClick={() => setIsIncomeFilterSheetOpen(false)}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#2a3241] transition-colors"
            >
              <XMarkIcon className="w-5 h-5 text-[#424245] dark:text-[#86868b]" />
            </button>
          </div>

          {/* Sheet Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Öğrenci Durumu Filtresi */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-[#1d1d1f] dark:text-white">
                {language === 'tr' ? 'Öğrenci Durumu' : 'Student Status'}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setIncomeFilters(prev => ({ ...prev, activeStatus: prev.activeStatus === 'active' ? '' : 'active' }))}
                  className={`
                    h-9 px-4 rounded-lg text-sm font-medium transition-colors flex-1 whitespace-nowrap
                    ${incomeFilters.activeStatus === 'active'
                      ? 'bg-[#0f766e] dark:bg-[#34d399] text-white'
                      : 'bg-white dark:bg-[#121621] text-[#1d1d1f] dark:text-white border border-[#d2d2d7] dark:border-[#2a3241] hover:border-[#0f766e] dark:hover:border-[#34d399]'
                    }
                  `}
                >
                  {language === 'tr' ? 'Aktif' : 'Active'}
                </button>
                <button
                  onClick={() => setIncomeFilters(prev => ({ ...prev, activeStatus: prev.activeStatus === 'inactive' ? '' : 'inactive' }))}
                  className={`
                    h-9 px-4 rounded-lg text-sm font-medium transition-colors flex-1 whitespace-nowrap
                    ${incomeFilters.activeStatus === 'inactive'
                      ? 'bg-[#be123c] dark:bg-[#ef4444] text-white'
                      : 'bg-white dark:bg-[#121621] text-[#1d1d1f] dark:text-white border border-[#d2d2d7] dark:border-[#2a3241] hover:border-[#be123c] dark:hover:border-[#ef4444]'
                    }
                  `}
                >
                  {language === 'tr' ? 'Pasif' : 'Inactive'}
                </button>
              </div>
            </div>

            {/* Ödeme Yöntemi Filtresi */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-[#1d1d1f] dark:text-white">
                {language === 'tr' ? 'Ödeme Yöntemi' : 'Payment Method'}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setIncomeFilters(prev => {
                      const newPaymentMethod = [...prev.paymentMethod];
                      // Eğer zaten seçiliyse kaldır, değilse ekle (toggle)
                      if (newPaymentMethod.includes('banka')) {
                        return { ...prev, paymentMethod: newPaymentMethod.filter(m => m !== 'banka') };
                      } else {
                        return { ...prev, paymentMethod: [...newPaymentMethod, 'banka'] };
                      }
                    });
                  }}
                  className={`
                    h-9 px-4 rounded-lg text-sm font-medium transition-colors flex-1 whitespace-nowrap
                    ${incomeFilters.paymentMethod.includes('banka')
                      ? 'bg-[#121621] dark:bg-[#0071e3] text-white'
                      : 'bg-white dark:bg-[#121621] text-[#1d1d1f] dark:text-white border border-[#d2d2d7] dark:border-[#2a3241] hover:border-[#0071e3] dark:hover:border-[#0071e3]'
                    }
                  `}
                >
                  {language === 'tr' ? 'Banka' : 'Bank'}
                </button>
                <button
                  onClick={() => {
                    setIncomeFilters(prev => {
                      const newPaymentMethod = [...prev.paymentMethod];
                      // Eğer zaten seçiliyse kaldır, değilse ekle (toggle)
                      if (newPaymentMethod.includes('nakit')) {
                        return { ...prev, paymentMethod: newPaymentMethod.filter(m => m !== 'nakit') };
                      } else {
                        return { ...prev, paymentMethod: [...newPaymentMethod, 'nakit'] };
                      }
                    });
                  }}
                  className={`
                    h-9 px-4 rounded-lg text-sm font-medium transition-colors flex-1 whitespace-nowrap
                    ${incomeFilters.paymentMethod.includes('nakit')
                      ? 'bg-[#121621] dark:bg-[#0071e3] text-white'
                      : 'bg-white dark:bg-[#121621] text-[#1d1d1f] dark:text-white border border-[#d2d2d7] dark:border-[#2a3241] hover:border-[#0071e3] dark:hover:border-[#0071e3]'
                    }
                  `}
                >
                  {language === 'tr' ? 'Nakit' : 'Cash'}
                </button>
                <button
                  onClick={() => {
                    setIncomeFilters(prev => {
                      const newPaymentMethod = [...prev.paymentMethod];
                      // Eğer zaten seçiliyse kaldır, değilse ekle (toggle)
                      if (newPaymentMethod.includes('kart')) {
                        return { ...prev, paymentMethod: newPaymentMethod.filter(m => m !== 'kart') };
                      } else {
                        return { ...prev, paymentMethod: [...newPaymentMethod, 'kart'] };
                      }
                    });
                  }}
                  className={`
                    h-9 px-4 rounded-lg text-sm font-medium transition-colors flex-1 whitespace-nowrap
                    ${incomeFilters.paymentMethod.includes('kart')
                      ? 'bg-[#121621] dark:bg-[#0071e3] text-white'
                      : 'bg-white dark:bg-[#121621] text-[#1d1d1f] dark:text-white border border-[#d2d2d7] dark:border-[#2a3241] hover:border-[#0071e3] dark:hover:border-[#0071e3]'
                    }
                  `}
                >
                  {language === 'tr' ? 'Kredi Kartı' : 'Credit Card'}
                </button>
              </div>
            </div>

            {/* Ödeme Durumu Filtresi */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-[#1d1d1f] dark:text-white">
                {language === 'tr' ? 'Ödeme Durumu' : 'Payment Status'}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setIncomeFilters(prev => ({ ...prev, paymentStatus: prev.paymentStatus === 'odendi' ? '' : 'odendi' }))}
                  className={`
                    h-9 px-4 rounded-lg text-sm font-medium transition-colors flex-1 whitespace-nowrap
                    ${incomeFilters.paymentStatus === 'odendi'
                      ? 'bg-[#121621] dark:bg-[#0071e3] text-white'
                      : 'bg-white dark:bg-[#121621] text-[#1d1d1f] dark:text-white border border-[#d2d2d7] dark:border-[#2a3241] hover:border-[#0071e3] dark:hover:border-[#0071e3]'
                    }
                  `}
                >
                  {language === 'tr' ? 'Ödendi' : 'Paid'}
                </button>
                <button
                  onClick={() => setIncomeFilters(prev => ({ ...prev, paymentStatus: prev.paymentStatus === 'beklemede' ? '' : 'beklemede' }))}
                  className={`
                    h-9 px-4 rounded-lg text-sm font-medium transition-colors flex-1 whitespace-nowrap
                    ${incomeFilters.paymentStatus === 'beklemede'
                      ? 'bg-[#121621] dark:bg-[#0071e3] text-white'
                      : 'bg-white dark:bg-[#121621] text-[#1d1d1f] dark:text-white border border-[#d2d2d7] dark:border-[#2a3241] hover:border-[#0071e3] dark:hover:border-[#0071e3]'
                    }
                  `}
                >
                  {language === 'tr' ? 'Beklemede' : 'Pending'}
                </button>
              </div>
            </div>
          </div>

          {/* Sheet Footer */}
          <div className="px-6 py-4 border-t border-[#d2d2d7] dark:border-[#2a3241] shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setIncomeFilters(INITIAL_INCOME_FILTERS)
                  setIsIncomeFilterSheetOpen(false)
                }}
                className="flex-1 h-10 bg-gray-100 dark:bg-[#1d1d1f] text-[#1d1d1f] dark:text-white font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-[#2a3241] focus:outline-none transition-colors"
              >
                {language === 'tr' ? 'Filtreleri Temizle' : 'Clear Filters'}
              </button>
              <button
                onClick={() => setIsIncomeFilterSheetOpen(false)}
                className="flex-1 h-10 bg-[#1d1d1f] dark:bg-[#0071e3] text-white font-medium rounded-xl hover:bg-black dark:hover:bg-[#0077ed] focus:outline-none transition-colors"
              >
                {language === 'tr' ? 'Uygula' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Expense Filter Sheet */}
      <div className={`
        fixed right-0 top-0 h-full w-[400px] bg-white dark:bg-[#121621] shadow-xl z-50 transform transition-transform duration-300
        ${isExpenseFilterSheetOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="h-full flex flex-col">
          {/* Sheet Header */}
          <div className="flex items-center justify-between px-6 h-16 border-b border-[#d2d2d7] dark:border-[#2a3241] shrink-0">
            <h2 className="text-lg font-medium text-[#1d1d1f] dark:text-white">
              {language === 'tr' ? 'Gider Filtreleri' : 'Expense Filters'}
            </h2>
            <button
              onClick={() => setIsExpenseFilterSheetOpen(false)}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#2a3241] transition-colors"
            >
              <XMarkIcon className="w-5 h-5 text-[#424245] dark:text-[#86868b]" />
            </button>
          </div>

          {/* Sheet Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Gider Türü Filtresi */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-[#1d1d1f] dark:text-white">
                {language === 'tr' ? 'Gider Türü' : 'Expense Type'}
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {EXPENSE_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => setExpenseFilters(prev => ({ ...prev, expenseType: prev.expenseType === type ? '' : type }))}
                    className={`
                      h-9 px-4 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
                      ${expenseFilters.expenseType === type
                        ? 'bg-[#121621] dark:bg-[#0071e3] text-white'
                        : 'bg-white dark:bg-[#121621] text-[#1d1d1f] dark:text-white border border-[#d2d2d7] dark:border-[#2a3241] hover:border-[#0071e3] dark:hover:border-[#0071e3]'
                      }
                    `}
                  >
                    {expenseTypeLabel(type, language)}
                  </button>
                ))}
              </div>
            </div>

            {/* Ödeme Yöntemi Filtresi */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-[#1d1d1f] dark:text-white">
                {language === 'tr' ? 'Ödeme Yöntemi' : 'Payment Method'}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setExpenseFilters(prev => ({ ...prev, paymentMethod: prev.paymentMethod === 'banka' ? '' : 'banka' }))}
                  className={`
                    h-9 px-4 rounded-lg text-sm font-medium transition-colors flex-1 whitespace-nowrap
                    ${expenseFilters.paymentMethod === 'banka'
                      ? 'bg-[#121621] dark:bg-[#0071e3] text-white'
                      : 'bg-white dark:bg-[#121621] text-[#1d1d1f] dark:text-white border border-[#d2d2d7] dark:border-[#2a3241] hover:border-[#0071e3] dark:hover:border-[#0071e3]'
                    }
                  `}
                >
                  {language === 'tr' ? 'Banka' : 'Bank'}
                </button>
                <button
                  onClick={() => setExpenseFilters(prev => ({ ...prev, paymentMethod: prev.paymentMethod === 'nakit' ? '' : 'nakit' }))}
                  className={`
                    h-9 px-4 rounded-lg text-sm font-medium transition-colors flex-1 whitespace-nowrap
                    ${expenseFilters.paymentMethod === 'nakit'
                      ? 'bg-[#121621] dark:bg-[#0071e3] text-white'
                      : 'bg-white dark:bg-[#121621] text-[#1d1d1f] dark:text-white border border-[#d2d2d7] dark:border-[#2a3241] hover:border-[#0071e3] dark:hover:border-[#0071e3]'
                    }
                  `}
                >
                  {language === 'tr' ? 'Nakit' : 'Cash'}
                </button>
                <button
                  onClick={() => setExpenseFilters(prev => ({ ...prev, paymentMethod: prev.paymentMethod === 'kart' ? '' : 'kart' }))}
                  className={`
                    h-9 px-4 rounded-lg text-sm font-medium transition-colors flex-1 whitespace-nowrap
                    ${expenseFilters.paymentMethod === 'kart'
                      ? 'bg-[#121621] dark:bg-[#0071e3] text-white'
                      : 'bg-white dark:bg-[#121621] text-[#1d1d1f] dark:text-white border border-[#d2d2d7] dark:border-[#2a3241] hover:border-[#0071e3] dark:hover:border-[#0071e3]'
                    }
                  `}
                >
                  {language === 'tr' ? 'Kredi Kartı' : 'Credit Card'}
                </button>
              </div>
            </div>
          </div>

          {/* Sheet Footer */}
          <div className="px-6 py-4 border-t border-[#d2d2d7] dark:border-[#2a3241] shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setExpenseFilters(INITIAL_EXPENSE_FILTERS)
                  setIsExpenseFilterSheetOpen(false)
                }}
                className="flex-1 h-10 bg-gray-100 dark:bg-[#1d1d1f] text-[#1d1d1f] dark:text-white font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-[#2a3241] focus:outline-none transition-colors"
              >
                {language === 'tr' ? 'Filtreleri Temizle' : 'Clear Filters'}
              </button>
              <button
                onClick={() => setIsExpenseFilterSheetOpen(false)}
                className="flex-1 h-10 bg-[#1d1d1f] dark:bg-[#0071e3] text-white font-medium rounded-xl hover:bg-black dark:hover:bg-[#0077ed] focus:outline-none transition-colors"
              >
                {language === 'tr' ? 'Uygula' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Overlays */}
      {(isIncomeFilterSheetOpen || isExpenseFilterSheetOpen) && (
        <div
          className="fixed inset-0 bg-black/25 backdrop-blur-sm z-40"
          onClick={() => {
            setIsIncomeFilterSheetOpen(false)
            setIsExpenseFilterSheetOpen(false)
          }}
        />
      )}

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Veriler yüklenemediyse: eski rakamları göstermek yerine açıkça söyle */}
        {(loadFailed.period || loadFailed.chart) && !isLoading && !isChartLoading && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[#d2d2d7] dark:border-[#2a3241] bg-white dark:bg-[#121621] px-5 py-4">
            <div className="flex items-center gap-3">
              <ExclamationTriangleIcon className="w-5 h-5 shrink-0 text-[#d4a014] dark:text-[#fbbf24]" />
              <p className="text-sm text-[#1d1d1f] dark:text-white">
                {language === 'tr'
                  ? 'Veriler yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.'
                  : 'The data could not be loaded. Check your connection and try again.'}
              </p>
            </div>
            <button
              onClick={fetchAllData}
              className="h-9 px-4 rounded-lg text-sm font-medium bg-[#1d1d1f] dark:bg-[#0071e3] text-white hover:bg-black dark:hover:bg-[#0077ed] transition-colors whitespace-nowrap"
            >
              {language === 'tr' ? 'Tekrar Dene' : 'Try Again'}
            </button>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {isLoading ? (
            <>
              <SummaryCardSkeleton />
              <SummaryCardSkeleton />
              <SummaryCardSkeleton />
              <SummaryCardSkeleton />
            </>
          ) : (
            <>
              {/* Aylık Gelir - Filtreleme bilgisini çoklu seçime göre güncelliyoruz */}
              <div className="bg-white dark:bg-[#121621] rounded-2xl border border-[#d2d2d7] dark:border-[#2a3241] overflow-hidden group hover:border-[#0071e3] dark:hover:border-[#0071e3] hover:shadow-lg dark:hover:shadow-[#0071e3]/10 transition-all duration-200">
                <div className="h-1 w-full bg-[#0071e3]" />
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[#6e6e73] dark:text-[#86868b] text-sm font-medium">
                      {language === 'tr' ? 'Gelir' : 'Income'}
                      {incomeFilters.paymentMethod.length > 0 && (
                        <span className="ml-1 text-xs">
                          ({incomeFilters.paymentMethod.map(method => paymentMethodLabel(method, language)).join(', ')})
                        </span>
                      )}
                      {incomeFilters.activeStatus && (
                        <span className="ml-1 text-xs">
                          ({incomeFilters.activeStatus === 'active'
                            ? (language === 'tr' ? 'Aktif' : 'Active')
                            : (language === 'tr' ? 'Pasif' : 'Inactive')})
                        </span>
                      )}
                    </p>
                    <div className="w-7 h-7 bg-[#0071e3]/10 dark:bg-[#0071e3]/20 rounded-lg flex items-center justify-center">
                      <ArrowTrendingUpIcon className="w-4 h-4 text-[#0071e3]" />
                    </div>
                  </div>
                  <div className="flex items-end gap-1">
                    <h3 className="text-2xl font-semibold text-[#1d1d1f] dark:text-white">
                      {formatCurrency(incomeTotal)}
                    </h3>
                  </div>
                </div>
              </div>

              {/* Aylık Gider - Artık filtrelenebilir */}
              <div className="bg-white dark:bg-[#121621] rounded-2xl border border-[#d2d2d7] dark:border-[#2a3241] overflow-hidden group hover:border-[#0071e3] dark:hover:border-[#0071e3] hover:shadow-lg dark:hover:shadow-[#0071e3]/10 transition-all duration-200">
                <div className="h-1 w-full bg-[#ef4444]" />
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[#6e6e73] dark:text-[#86868b] text-sm font-medium">
                      {language === 'tr' ? 'Gider' : 'Expense'}
                      {expenseFilters.paymentMethod && (
                        <span className="ml-1 text-xs">
                          ({paymentMethodLabel(expenseFilters.paymentMethod, language)})
                        </span>
                      )}
                      {expenseFilters.expenseType && (
                        <span className="ml-1 text-xs">
                          ({expenseTypeLabel(expenseFilters.expenseType, language)})
                        </span>
                      )}
                    </p>
                    <div className="w-7 h-7 bg-[#ef4444]/10 dark:bg-[#ef4444]/20 rounded-lg flex items-center justify-center">
                      <ArrowTrendingDownIcon className="w-4 h-4 text-[#ef4444]" />
                    </div>
                  </div>
                  <div className="flex items-end gap-1">
                    <h3 className="text-2xl font-semibold text-[#1d1d1f] dark:text-white">
                      {formatCurrency(expenseTotal)}
                    </h3>
                  </div>
                </div>
              </div>

              {/* Net Kazanç - Artık filtrelere göre hesaplanıyor */}
              <div className="bg-white dark:bg-[#121621] rounded-2xl border border-[#d2d2d7] dark:border-[#2a3241] overflow-hidden group hover:border-[#0071e3] dark:hover:border-[#0071e3] hover:shadow-lg dark:hover:shadow-[#0071e3]/10 transition-all duration-200">
                <div className="h-1 w-full bg-[#34d399]" />
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[#6e6e73] dark:text-[#86868b] text-sm font-medium">
                      {language === 'tr' ? 'Net Kazanç' : 'Net Income'}
                      {(hasIncomeCardFilter || hasExpenseFilter) && (
                        <span className="ml-1 text-xs">
                          ({language === 'tr' ? 'Filtrelenmiş' : 'Filtered'})
                        </span>
                      )}
                    </p>
                    <div className="w-7 h-7 bg-[#34d399]/10 dark:bg-[#34d399]/20 rounded-lg flex items-center justify-center">
                      <ScaleIcon className="w-4 h-4 text-[#34d399]" />
                    </div>
                  </div>
                  <div className="flex items-end gap-1">
                    <h3 className="text-2xl font-semibold text-[#1d1d1f] dark:text-white">
                      {formatCurrency(netIncome)}
                    </h3>
                  </div>
                </div>
              </div>

              {/* Bekleyen Tahsilatlar: aktif öğrencilerin ödenmemiş kayıtları. Karta basınca aşağıdaki
                  tablo bu kayıtları listeler; yeniden basınca ödenmiş gelirlere döner. */}
              <div
                onClick={() => setIncomeFilters(prev => ({ ...prev, paymentStatus: prev.paymentStatus === 'beklemede' ? '' : 'beklemede' }))}
                className={`bg-white dark:bg-[#121621] rounded-2xl border overflow-hidden group hover:border-[#0071e3] dark:hover:border-[#0071e3] hover:shadow-lg dark:hover:shadow-[#0071e3]/10 transition-all duration-200 cursor-pointer ${isPendingView ? 'border-[#fbbf24] dark:border-[#fbbf24]' : 'border-[#d2d2d7] dark:border-[#2a3241]'}`}
              >
                <div className="h-1 w-full bg-[#fbbf24]" />
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[#6e6e73] dark:text-[#86868b] text-sm font-medium">
                      {language === 'tr' ? 'Bekleyen Tahsilatlar' : 'Pending Payments'}
                    </p>
                    <div className="w-7 h-7 bg-[#fbbf24]/10 dark:bg-[#fbbf24]/20 rounded-lg flex items-center justify-center">
                      <ClockIcon className="w-4 h-4 text-[#fbbf24]" />
                    </div>
                  </div>
                  <div className="flex items-end gap-1">
                    <h3 className="text-2xl font-semibold text-[#1d1d1f] dark:text-white">
                      {pendingCount}
                    </h3>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Income Table */}
        {isLoading ? (
          <TableSkeleton />
        ) : (
          <div className="bg-white dark:bg-[#121621] rounded-2xl border border-[#d2d2d7] dark:border-[#2a3241] overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-[#f5f5f7] dark:border-[#2a3241]">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 lg:gap-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold text-[#1d1d1f] dark:text-white">
                      {isPendingView
                        ? (language === 'tr' ? 'Bekleyen Tahsilatlar' : 'Pending Payments')
                        : (language === 'tr' ? 'Gelir Detayları' : 'Income Details')}
                    </h2>
                    <span className="text-sm font-medium text-[#424245] dark:text-[#86868b]">
                      ({incomeTableRows.length})
                    </span>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  {/* Search Input */}
                  <div className="relative flex-1 sm:flex-none">
                    <input
                      type="search"
                      placeholder={language === 'tr' ? 'Öğrenci veya veli ara...' : 'Search student or parent...'}
                      value={incomeFilters.search}
                      onChange={(e) => setIncomeFilters(prev => ({ ...prev, search: e.target.value }))}
                      className="h-9 pl-9 pr-4 rounded-xl text-sm font-medium bg-white dark:bg-[#121621] text-[#1d1d1f] dark:text-white border border-[#d2d2d7] dark:border-[#2a3241] hover:border-[#0071e3] dark:hover:border-[#0071e3] focus:border-[#0071e3] dark:focus:border-[#0071e3] focus:bg-white dark:focus:bg-[#121621] focus:outline-none focus:ring-2 focus:ring-[#0071e3] focus:ring-opacity-20 transition-all w-full sm:w-[250px]"
                    />
                    <svg className="w-4 h-4 text-[#86868b] absolute left-3 top-1/2 -translate-y-1/2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                    </svg>
                  </div>
                  <button
                    onClick={() => setIsIncomeFilterSheetOpen(true)}
                    className="h-9 w-full sm:w-9 flex items-center justify-center rounded-xl border border-[#d2d2d7] dark:border-[#2a3241] hover:border-[#0071e3] dark:hover:border-[#0071e3] transition-colors relative group"
                    title={language === 'tr' ? 'Filtre' : 'Filter'}
                  >
                    <AdjustmentsHorizontalIcon className="w-5 h-5 text-[#424245] dark:text-[#86868b]" />
                    {(incomeFilters.paymentMethod.length > 0 ||
                      incomeFilters.paymentStatus ||
                      incomeFilters.activeStatus) && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#0071e3] rounded-full ring-2 ring-white dark:ring-[#121621] " />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              {incomeTableRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <div className="w-16 h-16 mb-4 rounded-full bg-[#f5f5f7] dark:bg-[#1d1d1f] flex items-center justify-center">
                    <BanknotesIcon className="w-8 h-8 text-[#86868b]" />
                  </div>
                  <h3 className="text-lg font-medium text-[#1d1d1f] dark:text-white mb-2">
                    {isPendingView
                      ? (language === 'tr' ? 'Bekleyen tahsilat yok' : 'No pending payments')
                      : (language === 'tr' ? 'Gelir kaydı bulunamadı' : 'No income records found')}
                  </h3>
                  <p className="text-sm text-[#6e6e73] dark:text-[#86868b] text-center max-w-sm">
                    {incomeFilters.search.trim() || hasIncomeCardFilter
                      ? (language === 'tr'
                        ? 'Arama ya da filtrelere uygun kayıt bulunmamaktadır.'
                        : 'No records match the search or filters.')
                      : isPendingView
                        ? (language === 'tr'
                          ? 'Aktif öğrencilerin ödenmemiş kaydı bulunmamaktadır.'
                          : 'Active students have no unpaid records.')
                        : (language === 'tr'
                          ? 'Seçilen tarih aralığında herhangi bir gelir kaydı bulunmamaktadır.'
                          : 'There are no income records for the selected date range.')}
                  </p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-[#d2d2d7] dark:border-[#2a3241]">
                      <th className="py-4 px-6 text-left bg-[#f5f5f7]/50 dark:bg-[#161922]">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium uppercase tracking-wider text-[#6e6e73] dark:text-[#86868b]">
                            {language === 'tr' ? 'Öğrenci' : 'Student'}
                          </span>
                          <span className="text-[10px] font-medium uppercase tracking-wider text-[#6e6e73] dark:text-[#86868b] opacity-75">
                            {language === 'tr' ? 'Veli' : 'Parent'}
                          </span>
                        </div>
                      </th>
                      <th className="py-4 px-6 text-left bg-[#f5f5f7]/50 dark:bg-[#161922]">
                        <span className="text-xs font-medium uppercase tracking-wider text-[#6e6e73] dark:text-[#86868b]">
                          {language === 'tr' ? 'Paket' : 'Package'}
                        </span>
                      </th>
                      <th className="py-4 px-6 text-left bg-[#f5f5f7]/50 dark:bg-[#161922]">
                        <span className="text-xs font-medium uppercase tracking-wider text-[#6e6e73] dark:text-[#86868b]">
                          {language === 'tr' ? 'Başlangıç-Bitiş' : 'Start-End'}
                        </span>
                      </th>
                      <th className="py-4 px-6 text-left bg-[#f5f5f7]/50 dark:bg-[#161922]">
                        <span className="text-xs font-medium uppercase tracking-wider text-[#6e6e73] dark:text-[#86868b]">
                          {language === 'tr' ? 'Ödeme Günü' : 'Payment Date'}
                        </span>
                      </th>
                      <th className="py-4 px-6 text-center bg-[#f5f5f7]/50 dark:bg-[#161922]">
                        <span className="text-xs font-medium uppercase tracking-wider text-[#6e6e73] dark:text-[#86868b]">
                          {language === 'tr' ? 'Durum' : 'Status'}
                        </span>
                      </th>
                      <th className="py-4 px-6 text-right bg-[#f5f5f7]/50 dark:bg-[#161922]">
                        <span className="text-xs font-medium uppercase tracking-wider text-[#6e6e73] dark:text-[#86868b]">
                          {language === 'tr' ? 'Tutar' : 'Amount'}
                        </span>
                      </th>
                      <th className="py-4 px-6 text-left bg-[#f5f5f7]/50 dark:bg-[#161922]">
                        <span className="text-xs font-medium uppercase tracking-wider text-[#6e6e73] dark:text-[#86868b]">
                          {language === 'tr' ? 'Yöntem' : 'Method'}
                        </span>
                      </th>
                      <th className="py-4 px-6 text-left bg-[#f5f5f7]/50 dark:bg-[#161922]">
                        <span className="text-xs font-medium uppercase tracking-wider text-[#6e6e73] dark:text-[#86868b]">
                          {language === 'tr' ? 'Ödeme Durumu' : 'Payment Status'}
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {incomeTableRows.map((item, index) => (
                      <tr 
                        key={item.id}
                        className={`
                          group transition-all duration-200 ease-in-out cursor-default
                          hover:bg-gradient-to-r hover:from-[#69b0f8]/10 hover:via-[#34d399]/10 hover:to-[#f5f5f7]
                          dark:hover:from-[#0071e3]/10 dark:hover:via-[#34d399]/10 dark:hover:to-transparent
                          hover:shadow-[0_4px_20px_rgba(0,113,227,0.1)]
                          dark:hover:shadow-[0_0_20px_rgba(0,113,227,0.10)]
                          hover:transform hover:-translate-y-[1px]
                          ${index % 2 === 0 ? 'bg-white dark:bg-[#121621]' : 'bg-[#f5f5f7]/30 dark:bg-[#161922]/30'}
                        `}
                      >
                        <td className="py-4 px-6">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-[#1d1d1f] dark:text-white">
                              {item.student}
                            </span>
                            <span className="text-xs text-[#6e6e73] dark:text-[#86868b]">
                              {item.parent}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#0071e3]/5 to-[#34d399]/5 dark:from-[#0071e3]/10 dark:to-[#34d399]/10 text-[#0071e3] group-hover:from-[#0071e3]/10 group-hover:to-[#34d399]/10 dark:group-hover:from-[#0071e3]/20 dark:group-hover:to-[#34d399]/20 transition-all">
                            {packageShortLabel(item.package, language)}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex flex-col">
                            <span className="text-sm text-[#424245] dark:text-[#86868b]">
                              {new Date(item.date).toLocaleDateString('tr-TR')} - {item.end_date ? new Date(item.end_date).toLocaleDateString('tr-TR') : new Date(item.date).toLocaleDateString('tr-TR')}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex flex-col">
                            <span className="text-sm text-[#424245] dark:text-[#86868b]">
                              {item.payment_date ? new Date(item.payment_date).toLocaleDateString('tr-TR') : '—'}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex justify-center">
                            <span className={`
                              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                              ${item.is_active 
                                ? 'bg-[#34d399]/20 text-[#0f766e] border border-[#0f766e] dark:bg-[#34d399]/10 dark:text-[#34d399] dark:border-[#34d399]' 
                                : 'bg-[#ef4444]/5 text-[#be123c] border border-[#be123c] dark:bg-[#ef4444]/10 dark:text-[#ef4444] dark:border-[#ef4444]'
                              }
                            `}>
                                {item.is_active ? (
                                  <>
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#0f766e] dark:bg-[#34d399] " />
                                    {language === 'tr' ? 'Aktif' : 'Active'}
                                  </>
                                ) : (
                                  <>
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#be123c] dark:bg-[#ef4444]" />
                                    {language === 'tr' ? 'Pasif' : 'Inactive'}
                                  </>
                                )}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <span className="text-sm font-semibold bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] bg-clip-text text-transparent">
                            {formatCurrency(item.amount)}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-[#f5f5f7] dark:bg-[#1d1d1f] text-[#424245] dark:text-white border border-[#d2d2d7] dark:border-[#2a3241] group-hover:bg-white dark:group-hover:bg-[#121621] transition-colors">
                            {paymentMethodLabel(item.method, language)}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${
                            item.status === 'odendi'
                              ? 'bg-[#34d399]/5 text-[#2c9c7a] border border-[#2c9c7a] dark:text-[#34d399] dark:border-[#34d399]'
                              : 'bg-[#fbbf24]/5 text-[#d4a014] border-[#d4a014] dark:text-[#fbbf24] dark:border-[#fbbf24]'
                          } group-hover:bg-opacity-20 dark:group-hover:bg-opacity-20 transition-colors`}>
                            {item.status === 'odendi' ? (
                              <>
                                <CheckCircleIcon className="w-4 h-4" />
                                <span>{paymentStatusLabel('odendi', language)}</span>
                              </>
                            ) : (
                              <>
                                <ClockIcon className="w-4 h-4" />
                                <span>{paymentStatusLabel('beklemede', language)}</span>
                              </>
                            )}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Expense Table and Pie Chart Container */}
        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <TableSkeleton />
            </div>
            <div>
              <ChartSkeleton />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 lg:items-start gap-6">
            {/* Expense Table */}
            <div className="lg:col-span-2 bg-white dark:bg-[#121621] rounded-2xl border border-[#d2d2d7] dark:border-[#2a3241] overflow-hidden">
              <div className="p-6 border-b border-[#f5f5f7] dark:border-[#2a3241]">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 lg:gap-0">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-semibold text-[#1d1d1f] dark:text-white">
                        {language === 'tr' ? 'Gider Detayları' : 'Expense Details'}
                      </h2>
                      <span className="text-sm font-medium text-[#424245] dark:text-[#86868b]">
                        ({expenseTableRows.length})
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <button
                      onClick={() => setIsExpenseFilterSheetOpen(true)}
                      className="h-9 w-full sm:w-9 flex items-center justify-center rounded-xl border border-[#d2d2d7] dark:border-[#2a3241] hover:border-[#0071e3] dark:hover:border-[#0071e3] transition-colors relative group"
                    >
                      <AdjustmentsHorizontalIcon className="w-5 h-5 text-[#424245] dark:text-[#86868b]" />
                      {hasExpenseFilter && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#0071e3] rounded-full ring-2 ring-white dark:ring-[#121621] " />
                      )}
                    </button>
                    <button
                      onClick={() => setIsCreateExpenseModalOpen(true)}
                      className="h-9 w-full sm:w-auto px-4 rounded-xl bg-[#1d1d1f] dark:bg-[#0071e3] text-white text-sm font-medium hover:bg-black dark:hover:bg-[#0077ed] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0071e3] transition-all transform hover:scale-[1.01] active:scale-[0.98] flex items-center justify-center sm:justify-start gap-2"
                    >
                      <PlusIcon className="w-4 h-4" />
                      <span>{language === 'tr' ? 'Gider Ekle' : 'Add Expense'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                {expenseTableRows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4">
                    <div className="w-16 h-16 mb-4 rounded-full bg-[#f5f5f7] dark:bg-[#1d1d1f] flex items-center justify-center">
                      <ArrowTrendingDownIcon className="w-8 h-8 text-[#86868b]" />
                    </div>
                    <h3 className="text-lg font-medium text-[#1d1d1f] dark:text-white mb-2">
                      {language === 'tr' ? 'Gider kaydı bulunamadı' : 'No expense records found'}
                    </h3>
                    <p className="text-sm text-[#6e6e73] dark:text-[#86868b] text-center max-w-sm">
                      {hasExpenseFilter
                        ? (language === 'tr'
                          ? 'Seçili filtrelere uygun gider kaydı bulunmamaktadır.'
                          : 'No expense records match the selected filters.')
                        : (language === 'tr'
                          ? 'Seçilen tarih aralığında herhangi bir gider kaydı bulunmamaktadır.'
                          : 'There are no expense records for the selected date range.')}
                    </p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-[#d2d2d7] dark:border-[#2a3241]">
                        <th className="py-4 px-4 text-left bg-[#f5f5f7]/50 dark:bg-[#161922]">
                          <span className="text-xs font-medium uppercase tracking-wider text-[#6e6e73] dark:text-[#86868b]">
                            {language === 'tr' ? 'Başlık' : 'Title'}
                          </span>
                        </th>
                        <th className="py-4 px-4 text-left bg-[#f5f5f7]/50 dark:bg-[#161922]">
                          <span className="text-xs font-medium uppercase tracking-wider text-[#6e6e73] dark:text-[#86868b]">
                            {language === 'tr' ? 'Kategori' : 'Category'}
                          </span>
                        </th>
                        <th className="py-4 px-4 text-left bg-[#f5f5f7]/50 dark:bg-[#161922]">
                          <span className="text-xs font-medium uppercase tracking-wider text-[#6e6e73] dark:text-[#86868b]">
                            {language === 'tr' ? 'Tarih' : 'Date'}
                          </span>
                        </th>
                        <th className="py-4 px-4 text-right bg-[#f5f5f7]/50 dark:bg-[#161922]">
                          <span className="text-xs font-medium uppercase tracking-wider text-[#6e6e73] dark:text-[#86868b]">
                            {language === 'tr' ? 'Tutar' : 'Amount'}
                          </span>
                        </th>
                        <th className="py-4 px-4 text-left bg-[#f5f5f7]/50 dark:bg-[#161922]">
                          <span className="text-xs font-medium uppercase tracking-wider text-[#6e6e73] dark:text-[#86868b]">
                            {language === 'tr' ? 'Yöntem' : 'Method'}
                          </span>
                        </th>
                        <th className="py-4 px-4 text-left bg-[#f5f5f7]/50 dark:bg-[#161922]">
                          <span className="text-xs font-medium uppercase tracking-wider text-[#6e6e73] dark:text-[#86868b]">
                            {language === 'tr' ? 'Not' : 'Note'}
                          </span>
                        </th>
                        <th className="py-4 px-4 text-right bg-[#fafafb] dark:bg-[#161922] w-[104px] sticky right-0">
                          <span className="text-xs font-medium uppercase tracking-wider text-[#6e6e73] dark:text-[#86868b]">
                            {language === 'tr' ? 'İşlemler' : 'Actions'}
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenseTableRows.map((item, index) => {
                        // Sabit kategori renkleri
                        const categoryColors = {
                          'kira': { bg: 'from-[#0071e3]/5 to-[#34d399]/5', text: 'text-[#0071e3]' },
                          'elektrik': { bg: 'from-[#f59e0b]/5 to-[#f97316]/5', text: 'text-[#f97316]' },
                          'su': { bg: 'from-[#8b5cf6]/5 to-[#6366f1]/5', text: 'text-[#6366f1]' },
                          'dogalgaz': { bg: 'from-[#ec4899]/5 to-[#d946ef]/5', text: 'text-[#d946ef]' },
                          'internet': { bg: 'from-[#10b981]/5 to-[#34d399]/5', text: 'text-[#10b981]' },
                          'maas': { bg: 'from-[#3b82f6]/5 to-[#60a5fa]/5', text: 'text-[#3b82f6]' },
                          'malzeme': { bg: 'from-[#f43f5e]/5 to-[#fb7185]/5', text: 'text-[#f43f5e]' },
                          'mutfak': { bg: 'from-[#14b8a6]/5 to-[#2dd4bf]/5', text: 'text-[#14b8a6]' },
                          'reklam': { bg: 'from-[#f472b6]/5 to-[#ec4899]/5', text: 'text-[#ec4899]' },
                          'filament': { bg: 'from-[#22d3ee]/5 to-[#06b6d4]/5', text: 'text-[#06b6d4]' },
                          'diger': { bg: 'from-[#6b7280]/5 to-[#9ca3af]/5', text: 'text-[#6b7280]' }
                        };

                        const color = categoryColors[item.category] || categoryColors['diger'];

                        return (
                          <tr 
                            key={item.id}
                            className={`
                          group transition-all duration-200 ease-in-out cursor-default
                          hover:bg-gradient-to-r hover:from-[#69b0f8]/10 hover:via-[#34d399]/10 hover:to-[#f5f5f7]
                          dark:hover:from-[#0071e3]/10 dark:hover:via-[#34d399]/10 dark:hover:to-transparent
                          hover:shadow-[0_4px_20px_rgba(0,113,227,0.1)]
                          dark:hover:shadow-[0_0_20px_rgba(0,113,227,0.10)]
                          hover:transform hover:-translate-y-[1px]
                          ${index % 2 === 0 ? 'bg-white dark:bg-[#121621]' : 'bg-[#f5f5f7]/30 dark:bg-[#161922]/30'}
                            `}
                          >
                            <td className="py-4 px-4">
                              <span className="text-sm font-medium text-[#1d1d1f] dark:text-white">
                                {item.title}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r ${color.bg} dark:from-opacity-10 dark:to-opacity-10 ${color.text} transition-all`}>
                                {expenseTypeLabel(item.category, language)}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <span className="text-sm text-[#424245] dark:text-[#86868b]">
                                {new Date(item.date).toLocaleDateString('tr-TR')}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <span className="text-sm font-semibold bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] bg-clip-text text-transparent">
                                {formatCurrency(item.amount)}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-[#f5f5f7] dark:bg-[#1d1d1f] text-[#424245] dark:text-white border border-[#d2d2d7] dark:border-[#2a3241] group-hover:bg-white dark:group-hover:bg-[#121621] transition-colors">
                                {paymentMethodLabel(item.method, language)}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <span className="text-sm text-[#6e6e73] dark:text-[#86868b]">
                                  {item.notes && item.notes.length > 20 ? `${item.notes.substring(0, 20)}...` : item.notes}
                              </span>
                            </td>
                            <td className={`py-4 px-4 sticky right-0 ${index % 2 === 0 ? 'bg-white dark:bg-[#121621]' : 'bg-[#fcfcfd] dark:bg-[#131722]'}`}>
                              {/* Satır içi iki düğme (yukarı açılan menü, kaydırılan listenin en üst
                                  satırında kutunun dışına taşıp kesiliyordu) */}
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedExpense(item)
                                    setIsUpdateModalOpen(true)
                                  }}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#d2d2d7] dark:border-[#2a3241] text-[#424245] dark:text-[#86868b] hover:text-[#0071e3] hover:border-[#0071e3] dark:hover:text-[#0071e3] dark:hover:border-[#0071e3] transition-colors"
                                  title={language === 'tr' ? 'Düzenle' : 'Edit'}
                                >
                                  <PencilSquareIcon className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedExpense(item)
                                    setIsDeleteModalOpen(true)
                                  }}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#d2d2d7] dark:border-[#2a3241] text-[#424245] dark:text-[#86868b] hover:text-red-600 hover:border-red-600 dark:hover:text-red-500 dark:hover:border-red-500 transition-colors"
                                  title={language === 'tr' ? 'Sil' : 'Delete'}
                                >
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Expense Distribution Pie Chart - Takes up 1/3 */}
            <div className="bg-white dark:bg-[#121621] rounded-2xl border border-[#d2d2d7] dark:border-[#2a3241] p-6">
              <div className="space-y-1 mb-6">
                <h2 className="text-[15px] font-medium text-[#1d1d1f] dark:text-white">
                  {language === 'tr' ? 'Gider Dağılımı' : 'Expense Distribution'}
                </h2>
                <p className="text-sm text-[#6e6e73] dark:text-[#86868b]">
                  {language === 'tr' ? 'Kategorilere Göre' : 'By Category'}
                </p>
              </div>
              
              <div className="h-[300px] w-full">
                {expenseDistribution.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center">
                    <div className="w-16 h-16 mb-4 rounded-full bg-[#f5f5f7] dark:bg-[#1d1d1f] flex items-center justify-center">
                      <ChartPieIcon className="w-8 h-8 text-[#86868b]" />
                    </div>
                    <h3 className="text-lg font-medium text-[#1d1d1f] dark:text-white mb-2">
                      {language === 'tr' ? 'Gider dağılımı bulunamadı' : 'No expense distribution found'}
                    </h3>
                    <p className="text-sm text-[#6e6e73] dark:text-[#86868b] text-center max-w-sm">
                      {language === 'tr' 
                        ? 'Seçilen tarih aralığında herhangi bir gider dağılımı bulunmamaktadır.' 
                        : 'There is no expense distribution for the selected date range.'}
                    </p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={100}
                        fill="#8884d8"
                        paddingAngle={3}
                        dataKey="value"
                        startAngle={90}
                        endAngle={-270}
                      >
                        {/* Renkler dilimlerle aynı (tutara göre sıralı) diziden üretilir */}
                        {expenseDistribution.map((entry) => (
                          <Cell
                            key={entry.name}  
                            fill={entry.color}
                            stroke="none"
                            style={{
                              filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.1))',
                            }}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ 
                          backgroundColor: 'rgba(29, 29, 31, 0.95)',
                          border: 'none',
                          borderRadius: '12px',
                          boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)',
                          padding: '12px 16px',
                          backdropFilter: 'blur(12px)',
                        }}
                        itemStyle={{ 
                          color: '#ffffff', 
                          fontSize: '14px', 
                          padding: '4px 0',
                          fontWeight: '500',
                        }}
                        formatter={(value, name) => [
                          formatCurrency(value),
                          expenseTypeLabel(name, language)
                        ]}
                        labelStyle={{ 
                          color: 'white', 
                          fontWeight: '600', 
                          fontSize: '16px', 
                          marginBottom: '8px',
                          textTransform: 'capitalize'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Legend */}
              {expenseDistribution.length > 0 && (
                <div className="mt-6 space-y-2">
                  {expenseDistribution.map((item) => (
                      <div key={item.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-sm text-[#1d1d1f] dark:text-white">
                            {expenseTypeLabel(item.name, language)}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-[#424245] dark:text-[#86868b]">
                          {formatCurrency(item.value)}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Chart */}
        {isChartLoading ? (
          <ChartSkeleton />
        ) : (
          <div className="bg-white dark:bg-[#121621] rounded-2xl border border-[#d2d2d7] dark:border-[#2a3241] p-6">
            <div className="flex items-center justify-between mb-8">
              <div className="space-y-1">
                <h2 className="text-[15px] font-medium text-[#1d1d1f] dark:text-white">
                  {language === 'tr' ? 'Gelir & Gider Grafiği' : 'Income & Expense Chart'}
                </h2>
                <p className="text-sm text-[#6e6e73] dark:text-[#86868b]">
                  {language === 'tr' ? `Son ${chartRange} Ay` : `Last ${chartRange} Months`}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#0071e3]" />
                  <span className="text-sm text-[#1d1d1f] dark:text-white">
                    {language === 'tr' ? 'Gelir' : 'Income'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#ef4444]" />
                  <span className="text-sm text-[#1d1d1f] dark:text-white">
                    {language === 'tr' ? 'Gider' : 'Expense'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartRows}
                  margin={{
                    top: 5,
                    right: 10,
                    left: 10,
                    bottom: 5,
                  }}
                >
                  <defs>
                    <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0071e3" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#0071e3" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="name" 
                    stroke="#86868b"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis
                    stroke="#86868b"
                    fontSize={12}
                    tickFormatter={formatAxisValue}
                    tickLine={false}
                    axisLine={false}
                    width={84}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#121621',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                      padding: '12px'
                    }}
                    itemStyle={{ color: '#f5f5f7', fontSize: '12px', padding: '4px 0' }}
                    formatter={(value, name) => [
                      formatTooltipValue(value),
                      name === 'gelir' ? (language === 'tr' ? 'Gelir' : 'Income') :
                      name === 'gider' ? (language === 'tr' ? 'Gider' : 'Expense') : name
                    ]}
                    labelStyle={{ color: 'white', fontWeight: '500', fontSize: '14px', marginBottom: '8px' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="gelir" 
                    stroke="#0071e3" 
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 6, fill: '#0071e3' }}
                    fill="url(#incomeGradient)"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="gider" 
                    stroke="#ef4444" 
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 6, fill: '#ef4444' }}
                    fill="url(#expenseGradient)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Chart Range Selection Buttons */}
            <div className="flex items-center justify-center gap-2 mt-6 pt-6 border-t border-[#d2d2d7] dark:border-[#2a3241]">
              <button
                onClick={() => setChartRange(3)}
                className={`
                  h-9 px-4 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
                  ${chartRange === 3
                    ? 'bg-[#1d1d1f] dark:bg-[#0071e3] text-white'
                    : 'bg-white dark:bg-[#121621] text-[#1d1d1f] dark:text-white border border-[#d2d2d7] dark:border-[#2a3241] hover:border-[#0071e3] dark:hover:border-[#0071e3]'
                  }
                `}
              >
                {language === 'tr' ? 'Son 3 Ay' : 'Last 3 Months'}
              </button>
              <button
                onClick={() => setChartRange(6)}
                className={`
                  h-9 px-4 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
                  ${chartRange === 6
                    ? 'bg-[#1d1d1f] dark:bg-[#0071e3] text-white'
                    : 'bg-white dark:bg-[#121621] text-[#1d1d1f] dark:text-white border border-[#d2d2d7] dark:border-[#2a3241] hover:border-[#0071e3] dark:hover:border-[#0071e3]'
                  }
                `}
              >
                {language === 'tr' ? 'Son 6 Ay' : 'Last 6 Months'}
              </button>
              <button
                onClick={() => setChartRange(12)}
                className={`
                  h-9 px-4 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
                  ${chartRange === 12
                    ? 'bg-[#1d1d1f] dark:bg-[#0071e3] text-white'
                    : 'bg-white dark:bg-[#121621] text-[#1d1d1f] dark:text-white border border-[#d2d2d7] dark:border-[#2a3241] hover:border-[#0071e3] dark:hover:border-[#0071e3]'
                  }
                `}
              >
                {language === 'tr' ? 'Son 12 Ay' : 'Last 12 Months'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Expense Modal */}
      <CreateExpenses
        isOpen={isCreateExpenseModalOpen}
        visibleRange={dateRange}
        onClose={() => setIsCreateExpenseModalOpen(false)}
        onSuccess={() => {
          fetchAllData()
        }}
      />

      {/* Update Modal */}
      <UpdateExpensesModal
        isOpen={isUpdateModalOpen}
        onClose={() => {
          setIsUpdateModalOpen(false)
          setSelectedExpense(null)
        }}
        expense={selectedExpense}
        onUpdate={handleUpdate}
      />

      {/* Delete Modal */}
      <DeleteExpensesModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false)
          setSelectedExpense(null)
        }}
        expense={selectedExpense}
        onDelete={handleDelete}
      />
    </div>
  )
} 