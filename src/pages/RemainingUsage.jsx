import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../lib/supabase';
import { fetchLessonUsageMap } from '../lib/lessonUsage';
import { matchesSearch } from '../lib/text';
import { isAttendanceOverdue } from '../lib/attendance';
import Toast from '../components/ui/Toast';
import { format } from 'date-fns';
import { tr, enUS } from 'date-fns/locale';
import { MagnifyingGlassIcon, AdjustmentsHorizontalIcon, XMarkIcon, ChevronLeftIcon } from '@heroicons/react/24/outline';

// Filtre sayfasındaki paket türleri
const PACKAGE_FILTERS = [
  { value: 'hafta-1', tr: 'Haftada 1', en: '1 Day/Week' },
  { value: 'hafta-2', tr: 'Haftada 2', en: '2 Days/Week' },
  { value: 'hafta-3', tr: 'Haftada 3', en: '3 Days/Week' },
  { value: 'hafta-4', tr: 'Haftada 4', en: '4 Days/Week' },
  { value: '3ay-hafta-1', tr: '3 Ay - 12 Atölye', en: '3 Mo - 12 Workshops' },
  { value: '3ay-hafta-2', tr: '3 Ay - 24 Atölye', en: '3 Mo - 24 Workshops' },
  { value: 'tek-seferlik', tr: 'Tek Seferlik', en: 'One Time' },
  { value: 'ucretsiz', tr: 'Ücretsiz', en: 'Free' }
];

// Ders kartındaki yoklama düğmeleri
const STATUS_BUTTONS = [
  {
    status: 'attended',
    tr: 'Katıldı',
    en: 'Joined',
    active: 'bg-emerald-400/10 text-emerald-700 ring-1 ring-emerald-500/20 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20 hover:bg-emerald-400/30 dark:hover:bg-emerald-400/30',
    idle: 'bg-emerald-400/5 text-emerald-700/30 ring-1 ring-emerald-500/10 dark:bg-emerald-400/5 dark:text-emerald-300/30 dark:ring-emerald-400/10 hover:bg-emerald-400/20 dark:hover:bg-emerald-400/20 hover:text-emerald-700 dark:hover:text-emerald-300'
  },
  {
    status: 'no_show',
    tr: 'Gelmedi',
    en: 'Absent',
    active: 'bg-red-400/10 text-red-700 ring-1 ring-red-500/20 dark:bg-red-400/10 dark:text-red-300 dark:ring-red-400/20 hover:bg-red-400/30 dark:hover:bg-red-400/30',
    idle: 'bg-red-400/5 text-red-700/30 ring-1 ring-red-500/10 dark:bg-red-400/5 dark:text-red-300/30 dark:ring-red-400/10 hover:bg-red-400/20 dark:hover:bg-red-400/20 hover:text-red-700 dark:hover:text-red-300'
  },
  {
    status: 'postponed',
    tr: 'Ertelendi',
    en: 'Delayed',
    active: 'bg-amber-400/10 text-amber-700 ring-1 ring-amber-500/20 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20 hover:bg-amber-400/30 dark:hover:bg-amber-400/30',
    idle: 'bg-amber-400/5 text-amber-700/30 ring-1 ring-amber-500/10 dark:bg-amber-400/5 dark:text-amber-300/30 dark:ring-amber-400/10 hover:bg-amber-400/20 dark:hover:bg-amber-400/20 hover:text-amber-700 dark:hover:text-amber-300'
  },
  {
    status: 'makeup',
    tr: 'Telafi',
    en: 'Makeup',
    active: 'bg-blue-400/10 text-blue-700 ring-1 ring-blue-500/20 dark:bg-blue-400/10 dark:text-blue-300 dark:ring-blue-400/20 hover:bg-blue-400/30 dark:hover:bg-blue-400/30',
    idle: 'bg-blue-400/5 text-blue-700/30 ring-1 ring-blue-500/10 dark:bg-blue-400/5 dark:text-blue-300/30 dark:ring-blue-400/10 hover:bg-blue-400/20 dark:hover:bg-blue-400/20 hover:text-blue-700 dark:hover:text-blue-300'
  }
];

// Liste satırı: kayıt + güncel paket dönemindeki ders kullanımı.
// Liste ve detay paneli aynı satırı kullanır; ikisi birbirinden farklı sayı gösteremez.
const toStudentRow = (registration, usage) => ({
  registration_id: registration.id,
  student_name: registration.student_name,
  parent_name: registration.parent_name,
  package_type: registration.package_type,
  package_start_date: registration.package_start_date,
  package_end_date: registration.package_end_date,
  payment_status: registration.payment_status,
  is_active: registration.is_active,
  is_free: usage.isFree,
  remaining_lessons: usage.remaining,
  carried_lessons: usage.carried,
  attended_lessons: usage.attended,
  no_show_lessons: usage.noShow,
  makeup_completed: usage.makeup,
  postponed_lessons: usage.postponed,
  // Günü geçtiği halde yoklaması işaretlenmemiş dersler (ücretsiz katılımda ders hakkı izlenmez)
  unmarked_past: usage.isFree ? 0 : usage.unmarkedPast,
  // Tek öğrencinin kullanımını yeniden hesaplayabilmek için kaydın kendisi
  registration
});

const RemainingUsage = () => {
  const { language } = useLanguage();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  // Liste yüklenemediyse "kayıt yok" yerine "yüklenemedi" gösterilir
  const [loadFailed, setLoadFailed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [packageFilter, setPackageFilter] = useState('all');
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [showDetailView, setShowDetailView] = useState(false);
  const [studentLessons, setStudentLessons] = useState([]);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [lessonsFailed, setLessonsFailed] = useState(false);
  // Kaydı süren ders satırları: aynı satıra ikinci dokunuş yeni istek göndermez
  const [updatingLessonIds, setUpdatingLessonIds] = useState(() => new Set());
  const inFlightLessonsRef = useRef(new Set());
  const [visibleLessonsCount, setVisibleLessonsCount] = useState(10);
  const [toast, setToast] = useState({ message: '', type: 'success', isVisible: false });

  // Geç gelen yanıtın günceli ezmemesi için istek sayaçları
  const listRequestRef = useRef(0);
  const lessonsRequestRef = useRef(0);
  const usageRequestRef = useRef({});

  // Detay paneli her zaman listedeki güncel satırı gösterir
  const selectedStudent = selectedStudentId
    ? students.find(student => student.registration_id === selectedStudentId) || null
    : null;

  const showToast = (message, type = 'success') => {
    setToast({ message, type, isVisible: true });
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    if (!selectedStudentId) return;

    setVisibleLessonsCount(10); // Reset visible lessons when selecting a new student
    fetchStudentLessons(selectedStudentId);
  }, [selectedStudentId]);

  // Liste yenilendiğinde seçili öğrenci artık listede yoksa (başka cihazdan arşivlenmiş) panel kapanır
  useEffect(() => {
    if (selectedStudentId && !loading && !selectedStudent) {
      handleCloseDetail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, loading]);

  const fetchStudents = async () => {
    const requestId = ++listRequestRef.current;

    try {
      setLoading(true);

      // First, fetch registrations that are active
      const { data: registrationsData, error: registrationsError } = await supabase
        .from('registrations')
        .select('*')
        .eq('is_active', true)
        .order('student_name');

      if (registrationsError) throw registrationsError;

      // Ders kullanımı ortak util'den: kullanılan = katıldı + gelmedi,
      // sayım güncel paket döneminden itibaren (bkz. src/lib/lessonUsage.js)
      const registrations = registrationsData || [];
      const usageMap = await fetchLessonUsageMap(registrations);

      // Bu sırada yeni bir istek gönderildiyse eski yanıt yok sayılır
      if (requestId !== listRequestRef.current) return;

      setStudents(registrations.map(registration => toStudentRow(registration, usageMap[registration.id])));
      setLoadFailed(false);
    } catch (error) {
      if (requestId !== listRequestRef.current) return;

      console.error('Error fetching students:', error);
      setStudents([]);
      setLoadFailed(true);
    } finally {
      if (requestId === listRequestRef.current) {
        setLoading(false);
      }
    }
  };

  // Yalnızca bir öğrencinin kalan dersini yeniden hesaplar (yoklama değişince liste baştan yüklenmez)
  const refreshStudentUsage = async (registration) => {
    const requestId = (usageRequestRef.current[registration.id] || 0) + 1;
    usageRequestRef.current[registration.id] = requestId;

    const usageMap = await fetchLessonUsageMap([registration]);
    const usage = usageMap[registration.id];

    // Aynı öğrenci için daha yeni bir hesap başladıysa bu sonuç yok sayılır
    if (!usage || usageRequestRef.current[registration.id] !== requestId) return;

    setStudents(prev => prev.map(student => (
      student.registration_id === registration.id ? toStudentRow(student.registration, usage) : student
    )));
  };

  const fetchStudentLessons = async (registrationId) => {
    const requestId = ++lessonsRequestRef.current;

    try {
      // Önceki öğrencinin dersleri yeni öğrencinin adı altında görünmesin
      setStudentLessons([]);
      setLessonsFailed(false);
      setLoadingLessons(true);

      const { data, error } = await supabase
        .from('event_participants')
        .select('id, status, is_makeup, makeup_notes, postponed_notes, cancellation_reason, events(id, event_date, event_type, custom_description)')
        .eq('registration_id', registrationId);

      // Bu sırada başka bir öğrenci açıldıysa ya da panel kapandıysa yanıt yok sayılır
      if (requestId !== lessonsRequestRef.current) return;
      if (error) throw error;

      const sortedData = (data || [])
        .filter(lesson => lesson.events)
        .sort((a, b) => new Date(b.events.event_date) - new Date(a.events.event_date));

      setStudentLessons(sortedData);
    } catch (error) {
      if (requestId !== lessonsRequestRef.current) return;

      console.error('Error fetching student lessons:', error);
      setStudentLessons([]);
      setLessonsFailed(true);
    } finally {
      if (requestId === lessonsRequestRef.current) {
        setLoadingLessons(false);
      }
    }
  };

  const updateLessonStatus = async (lesson, newStatus) => {
    // Aynı duruma yeniden dokunmak istek göndermez; kaydı süren satır kilitlidir
    if (!selectedStudent || lesson.status === newStatus) return;
    if (inFlightLessonsRef.current.has(lesson.id)) return;

    const registration = selectedStudent.registration;
    const previousStatus = lesson.status;
    const setLessonStatus = (status) => {
      setStudentLessons(prev => prev.map(item => (item.id === lesson.id ? { ...item, status } : item)));
    };

    inFlightLessonsRef.current.add(lesson.id);
    setUpdatingLessonIds(new Set(inFlightLessonsRef.current));
    setLessonStatus(newStatus); // Sonuç beklenmeden ekranda gösterilir; kayıt başarısız olursa geri alınır

    try {
      const { data, error } = await supabase
        .from('event_participants')
        .update({ status: newStatus })
        .eq('id', lesson.id)
        .select('id');

      if (error) throw error;
      // Hata dönmeden hiçbir satır değişmediyse (ders başka cihazdan silinmiş ya da yetki yok) kayıt yapılmamıştır
      if (!data || data.length === 0) throw new Error('no_rows_updated');
    } catch (error) {
      console.error('Error updating lesson status:', error);
      setLessonStatus(previousStatus);
      showToast(
        language === 'tr'
          ? 'Durum kaydedilemedi. Bağlantınızı kontrol edip tekrar deneyin.'
          : 'The status could not be saved. Check your connection and try again.',
        'error'
      );
      return;
    } finally {
      inFlightLessonsRef.current.delete(lesson.id);
      setUpdatingLessonIds(new Set(inFlightLessonsRef.current));
    }

    // Kayıt yapıldı; öğrencinin kalan dersi yeniden hesaplanır
    try {
      await refreshStudentUsage(registration);
    } catch (error) {
      console.error('Error refreshing lesson usage:', error);
      showToast(
        language === 'tr'
          ? 'Durum kaydedildi ama kalan ders sayısı yenilenemedi. Sayfayı yenileyin.'
          : 'The status was saved but the remaining lessons could not be refreshed. Reload the page.',
        'warning'
      );
    }
  };

  const handleDetailClick = (student) => {
    setSelectedStudentId(student.registration_id);
    setShowDetailView(true);
  };

  const handleCloseDetail = () => {
    lessonsRequestRef.current += 1; // Bekleyen ders yanıtı kapalı panele yazılmasın
    setShowDetailView(false);
    setSelectedStudentId(null);
    setStudentLessons([]);
    setLessonsFailed(false);
    setLoadingLessons(false);
    setVisibleLessonsCount(10); // Reset visible lessons count
  };

  const handleFilterClick = () => {
    if (showDetailView) {
      handleCloseDetail();
    }
    setIsFilterSheetOpen(true);
  };

  const handleLoadMore = () => {
    setVisibleLessonsCount(prev => prev + 10);
  };

  const filteredStudents = students.filter(student => {
    // Türkçe'ye duyarlı arama: "irem" yazınca "İrem" bulunur, sondaki boşluk yok sayılır
    const matchesText = matchesSearch(student.student_name, searchTerm) ||
      matchesSearch(student.parent_name, searchTerm);
    const matchesPackage = packageFilter === 'all' || student.package_type === packageFilter;

    return matchesText && matchesPackage;
  });

  const isFiltered = searchTerm.trim() !== '' || packageFilter !== 'all';

  // Format date with the correct locale
  const formatDate = (date, formatStr) => {
    return format(new Date(date), formatStr || 'dd.MM.yyyy', { locale: language === 'tr' ? tr : enUS });
  };

  // Translate package type
  const translatePackageType = (type) => {
    if (language === 'tr') {
      return type === 'ucretsiz' ? 'Ücretsiz Katılım'
        : type === '3ay-hafta-1' ? '3 Aylık - 12 Atölye'
        : type === '3ay-hafta-2' ? '3 Aylık - 24 Atölye'
        : type === 'hafta-1' ? 'Haftada 1'
        : type === 'hafta-2' ? 'Haftada 2'
        : type === 'hafta-3' ? 'Haftada 3'
        : type === 'hafta-4' ? 'Haftada 4'
        : 'Tek Seferlik';
    } else {
      return type === 'ucretsiz' ? 'Free Participation'
        : type === '3ay-hafta-1' ? '3 Months - 12 Workshops'
        : type === '3ay-hafta-2' ? '3 Months - 24 Workshops'
        : type === 'hafta-1' ? '1 Day/Week'
        : type === 'hafta-2' ? '2 Days/Week'
        : type === 'hafta-3' ? '3 Days/Week'
        : type === 'hafta-4' ? '4 Days/Week'
        : 'One Time';
    }
  };

  // Translate payment status
  const translatePaymentStatus = (status) => {
    if (language === 'tr') {
      return status === 'ucretsiz' ? 'Ücretsiz' : status === 'odendi' ? 'Ödendi' : 'Beklemede';
    } else {
      return status === 'ucretsiz' ? 'Free' : status === 'odendi' ? 'Paid' : 'Pending';
    }
  };

  // Translate lesson status
  const translateLessonStatus = (status) => {
    if (language === 'tr') {
      return status === 'scheduled' ? 'Planlandı' :
        status === 'attended' ? 'Katıldı' :
        status === 'no_show' ? 'Gelmedi' :
        status === 'cancelled' ? 'İptal Edildi' :
        status === 'makeup' ? 'Telafi Dersi' :
        status === 'postponed' ? 'Ertelendi' : '';
    } else {
      return status === 'scheduled' ? 'Scheduled' :
        status === 'attended' ? 'Joined' :
        status === 'no_show' ? 'Absent' :
        status === 'cancelled' ? 'Cancelled' :
        status === 'makeup' ? 'Makeup' :
        status === 'postponed' ? 'Delayed' : '';
    }
  };

  // Dar ekranda yalnızca Öğrenci, Kalan Ders ve Detay sütunları gösterilir; diğer dört sütun
  // sığdığı genişlikte görünür. Detay paneli açıkken tablo daraldığı için eşik daha yüksektir.
  // (Yedi sütun birden sığmadığında "Kalan Ders" ve "Detay" yana kaydırmanın arkasında kalıyordu.)
  const secondaryColumn = showDetailView ? 'hidden min-[1700px]:table-cell' : 'hidden md:table-cell';
  const secondaryCaption = showDetailView ? 'min-[1700px]:hidden' : 'md:hidden';
  const headerCell = 'py-4 px-3 sm:px-6 bg-[#f5f5f7]/50 dark:bg-[#161922]';
  const bodyCell = 'px-3 sm:px-6 py-4 whitespace-nowrap';
  const headerLabel = 'text-xs font-medium uppercase tracking-wider text-[#6e6e73] dark:text-[#86868b]';
  const shimmer = <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent" />;

  const packageStart = selectedStudent && !selectedStudent.is_free && selectedStudent.package_start_date
    ? new Date(selectedStudent.package_start_date)
    : null;
  const visibleLessons = studentLessons.slice(0, visibleLessonsCount);
  // Güncel paketten önceki ilk ders: üstüne "Önceki paketler" ayırıcısı konur
  const firstOlderLessonId = packageStart
    ? (visibleLessons.find(lesson => new Date(lesson.events.event_date) < packageStart)?.id ?? null)
    : null;

  return (
    <div className={`flex flex-col ${showDetailView ? 'lg:mr-96' : ''} transition-all duration-300`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between h-auto sm:h-16 px-6 border-b border-[#d2d2d7] dark:border-[#2a3241] py-4 sm:py-0 gap-4 sm:gap-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-medium text-[#1d1d1f] dark:text-white">
            {language === 'tr' ? 'Kalan Kullanım' : 'Remaining Usage'}
            <span className="ml-2 text-sm font-normal text-[#6e6e73] dark:text-[#86868b]">
              ({filteredStudents.length})
            </span>
          </h1>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
          {/* Arama */}
          <div className="relative w-full sm:w-64">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#86868b]" />
            <input
              type="text"
              placeholder={language === 'tr' ? "Öğrenci veya veli ismi ara" : "Search student or parent name"}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 sm:h-8 pl-9 pr-4 rounded-lg text-sm border border-[#d2d2d7] dark:border-[#2a3241] bg-white/80 dark:bg-[#121621] text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:ring-0 focus:border-[#0071e3] dark:focus:border-[#0071e3] transition-colors"
            />
          </div>

          {/* Filtre Butonu */}
          <button
            onClick={handleFilterClick}
            aria-label={language === 'tr' ? 'Filtreler' : 'Filters'}
            className="h-10 sm:h-8 px-3 bg-white dark:bg-[#121621] text-[#424245] dark:text-[#86868b] text-sm font-medium rounded-lg border border-[#d2d2d7] dark:border-[#2a3241] hover:border-[#0071e3] dark:hover:border-[#0071e3] focus:outline-none transition-colors flex items-center justify-center gap-2 relative"
          >
            <AdjustmentsHorizontalIcon className="w-4 h-4" />
            {packageFilter !== 'all' && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#0071e3] rounded-full ring-2 ring-white dark:ring-[#121621]" />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Tablo */}
        <div className="bg-white dark:bg-[#161b2c] rounded-2xl shadow-lg overflow-hidden border border-[#d2d2d7] dark:border-[#2a3241]">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-[#d2d2d7] dark:border-[#2a3241]">
                  <th className={`${headerCell} text-left`}>
                    <div className="flex flex-col">
                      <span className={headerLabel}>
                        {language === 'tr' ? 'Öğrenci' : 'Student'}
                      </span>
                      <span className="text-[10px] font-medium uppercase tracking-wider text-[#6e6e73] dark:text-[#86868b] opacity-75">
                        {language === 'tr' ? 'Veli' : 'Parent'}
                      </span>
                    </div>
                  </th>
                  <th className={`${headerCell} text-left ${secondaryColumn}`}>
                    <span className={headerLabel}>
                      {language === 'tr' ? 'Paket Türü' : 'Package Type'}
                    </span>
                  </th>
                  <th className={`${headerCell} text-left ${secondaryColumn}`}>
                    <span className={headerLabel}>
                      {language === 'tr' ? 'Paket Başlangıcı' : 'Start Date'}
                    </span>
                  </th>
                  <th className={`${headerCell} text-left ${secondaryColumn}`}>
                    <span className={headerLabel}>
                      {language === 'tr' ? 'Bitiş Tarihi' : 'End Date'}
                    </span>
                  </th>
                  <th className={`${headerCell} text-center`}>
                    <span className={headerLabel}>
                      {language === 'tr' ? 'Kalan Ders' : 'Remaining'}
                    </span>
                  </th>
                  <th className={`${headerCell} text-center ${secondaryColumn}`}>
                    <span className={headerLabel}>
                      {language === 'tr' ? 'Ödeme Durumu' : 'Payment Status'}
                    </span>
                  </th>
                  <th className={`${headerCell} text-right w-[100px]`}>
                    <span className={headerLabel}>
                      {language === 'tr' ? 'İşlemler' : 'Actions'}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d2d2d7] dark:divide-[#2a3241]">
                {loading ? (
                  // Skeleton Loading
                  [...Array(5)].map((_, index) => (
                    <tr key={index}>
                      <td className={bodyCell}>
                        <div className="flex flex-col gap-2">
                          <div className="h-4 bg-[#f5f5f7] dark:bg-[#2a3241] rounded-md w-32 relative overflow-hidden">
                            {shimmer}
                          </div>
                          <div className="h-3 bg-[#f5f5f7] dark:bg-[#2a3241] rounded-md w-24 relative overflow-hidden">
                            {shimmer}
                          </div>
                        </div>
                      </td>
                      <td className={`${bodyCell} ${secondaryColumn}`}>
                        <div className="h-7 bg-[#f5f5f7] dark:bg-[#2a3241] rounded-lg w-24 relative overflow-hidden">
                          {shimmer}
                        </div>
                      </td>
                      <td className={`${bodyCell} ${secondaryColumn}`}>
                        <div className="h-4 bg-[#f5f5f7] dark:bg-[#2a3241] rounded-md w-24 relative overflow-hidden">
                          {shimmer}
                        </div>
                      </td>
                      <td className={`${bodyCell} ${secondaryColumn}`}>
                        <div className="h-4 bg-[#f5f5f7] dark:bg-[#2a3241] rounded-md w-24 relative overflow-hidden">
                          {shimmer}
                        </div>
                      </td>
                      <td className={bodyCell}>
                        <div className="flex justify-center">
                          <div className="h-6 bg-[#f5f5f7] dark:bg-[#2a3241] rounded-full w-8 relative overflow-hidden">
                            {shimmer}
                          </div>
                        </div>
                      </td>
                      <td className={`${bodyCell} ${secondaryColumn}`}>
                        <div className="flex justify-center">
                          <div className="h-6 bg-[#f5f5f7] dark:bg-[#2a3241] rounded-full w-20 relative overflow-hidden">
                            {shimmer}
                          </div>
                        </div>
                      </td>
                      <td className={bodyCell}>
                        <div className="flex justify-end">
                          <div className="h-8 bg-[#f5f5f7] dark:bg-[#2a3241] rounded-lg w-16 relative overflow-hidden">
                            {shimmer}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : loadFailed ? (
                  // Yükleme hatası: "kayıt yok" sanılmasın
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <p className="text-[#1d1d1f] dark:text-white font-medium mb-1">
                          {language === 'tr' ? 'Liste Yüklenemedi' : 'The List Could Not Be Loaded'}
                        </p>
                        <p className="text-sm text-[#6e6e73] dark:text-[#86868b]">
                          {language === 'tr' ? 'Bağlantınızı kontrol edip tekrar deneyin.' : 'Check your connection and try again.'}
                        </p>
                        <button
                          onClick={() => fetchStudents()}
                          className="mt-4 h-10 sm:h-8 px-4 bg-[#1d1d1f] dark:bg-[#0071e3] text-white text-sm font-medium rounded-lg hover:bg-black dark:hover:bg-[#0077ed] focus:outline-none transition-colors"
                        >
                          {language === 'tr' ? 'Tekrar Dene' : 'Try Again'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-[#f5f5f7] dark:bg-[#2a3241] rounded-full flex items-center justify-center mb-3">
                          <MagnifyingGlassIcon className="w-8 h-8 text-[#6e6e73] dark:text-[#86868b]" />
                        </div>
                        <p className="text-[#1d1d1f] dark:text-white font-medium mb-1">
                          {language === 'tr' ? 'Kayıt Bulunamadı' : 'No Records Found'}
                        </p>
                        <p className="text-sm text-[#6e6e73] dark:text-[#86868b]">
                          {isFiltered
                            ? (language === 'tr' ? 'Arama ya da filtreye uygun kayıt bulunamadı.' : 'No records match your search or filter.')
                            : (language === 'tr' ? 'Henüz kayıt eklenmemiş.' : 'No records have been added yet.')}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student) => (
                    <tr
                      key={student.registration_id}
                      // Detay paneli açık olan öğrencinin satırı vurgulanır
                      className={`group ${
                        showDetailView && selectedStudentId === student.registration_id
                          ? 'bg-[#0071e3]/[0.07] dark:bg-[#0071e3]/10 shadow-[inset_3px_0_0_0_#0071e3]'
                          : 'hover:bg-[#f5f5f7] dark:hover:bg-[#161922]'
                      }`}
                    >
                      <td className={bodyCell}>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-[#1d1d1f] dark:text-white">
                            {student.student_name}
                          </span>
                          <span className="text-xs text-[#6e6e73] dark:text-[#86868b]">
                            {student.parent_name}
                          </span>
                          {/* Paket sütunu gizlendiğinde paket adı ismin altında görünür */}
                          <span className={`${secondaryCaption} mt-0.5 text-[11px] text-[#0071e3]`}>
                            {translatePackageType(student.package_type)}
                          </span>
                        </div>
                      </td>
                      <td className={`${bodyCell} ${secondaryColumn}`}>
                        <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#0071e3]/5 to-[#34d399]/5 dark:from-[#0071e3]/10 dark:to-[#34d399]/10 text-[#0071e3] group-hover:from-[#0071e3]/10 group-hover:to-[#34d399]/10 dark:group-hover:from-[#0071e3]/20 dark:group-hover:to-[#34d399]/20 transition-all">
                          {translatePackageType(student.package_type)}
                        </span>
                      </td>
                      <td className={`${bodyCell} ${secondaryColumn}`}>
                        <span className="text-sm text-[#424245] dark:text-[#86868b]">
                          {formatDate(student.package_start_date)}
                        </span>
                      </td>
                      <td className={`${bodyCell} ${secondaryColumn}`}>
                        <span className="text-sm text-[#424245] dark:text-[#86868b]">
                          {student.is_free
                            ? (language === 'tr' ? 'Süresiz' : 'Unlimited')
                            : formatDate(student.package_end_date)}
                        </span>
                      </td>
                      <td className={`${bodyCell} text-center`}>
                        <span className="inline-flex items-center justify-center gap-1.5">
                          <span className={`inline-flex items-center justify-center min-w-[2rem] px-3 py-1.5 rounded-lg text-xs font-medium ring-1 ring-inset ${
                            student.is_free
                              ? 'bg-gray-400/10 text-gray-700 ring-gray-500/20 dark:bg-gray-400/10 dark:text-gray-300 dark:ring-gray-400/20'
                              : student.remaining_lessons <= 0
                              ? 'bg-red-400/10 text-red-700 ring-red-500/20 dark:bg-red-400/10 dark:text-red-300 dark:ring-red-400/20'
                              : student.remaining_lessons <= 2
                              ? 'bg-amber-400/10 text-amber-700 ring-amber-500/20 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20'
                              : 'bg-emerald-400/10 text-emerald-700 ring-emerald-500/20 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20'
                          }`}>
                            {student.is_free
                              ? (language === 'tr' ? 'Ücretsiz' : 'Free')
                              : student.remaining_lessons}
                          </span>
                          {/* Geçmiş bir dersin yoklaması işaretlenmemişse kalan ders olduğundan fazla görünür */}
                          {student.unmarked_past > 0 && (
                            <span
                              className="w-2 h-2 rounded-full bg-amber-400 shrink-0"
                              title={language === 'tr'
                                ? `${student.unmarked_past} geçmiş dersin yoklaması işaretlenmemiş`
                                : `Attendance not marked for ${student.unmarked_past} past lesson${student.unmarked_past === 1 ? '' : 's'}`}
                            />
                          )}
                        </span>
                      </td>
                      <td className={`${bodyCell} text-center ${secondaryColumn}`}>
                        <span className={`inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-medium ring-1 ring-inset ${
                          student.payment_status === 'ucretsiz'
                            ? 'bg-gray-400/10 text-gray-700 ring-gray-500/20 dark:bg-gray-400/10 dark:text-gray-300 dark:ring-gray-400/20'
                            : student.payment_status === 'odendi'
                            ? 'bg-emerald-400/10 text-emerald-700 ring-emerald-500/20 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20'
                            : 'bg-amber-400/10 text-amber-700 ring-amber-500/20 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20'
                        }`}>
                          {translatePaymentStatus(student.payment_status)}
                        </span>
                      </td>
                      <td className={`${bodyCell} text-right`}>
                        <button
                          onClick={() => handleDetailClick(student)}
                          className="inline-flex items-center justify-center h-8 px-4 text-xs font-medium rounded-lg bg-white dark:bg-[#121621] text-[#1d1d1f] dark:text-white border border-[#d2d2d7] dark:border-[#2a3241] hover:bg-[#1d1d1f] dark:hover:bg-[#0071e3] hover:text-white dark:hover:text-white hover:border-[#1d1d1f] dark:hover:border-[#0071e3] focus:outline-none transition-all duration-200"
                        >
                          {language === 'tr' ? 'Detay' : 'Details'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Filter Sheet */}
      <div className={`
        fixed inset-y-0 right-0 w-full sm:w-96 bg-white dark:bg-[#121621] shadow-xl transform transition-transform duration-300 ease-in-out z-50
        ${isFilterSheetOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="h-full flex flex-col">
          {/* Sheet Header */}
          <div className="flex items-center justify-between px-6 h-16 border-b border-[#d2d2d7] dark:border-[#2a3241] shrink-0">
            <h2 className="text-lg font-medium text-[#1d1d1f] dark:text-white">
              {language === 'tr' ? 'Filtreler' : 'Filters'}
            </h2>
            <button
              onClick={() => setIsFilterSheetOpen(false)}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#2a3241]"
            >
              <XMarkIcon className="w-5 h-5 text-[#424245] dark:text-[#86868b]" />
            </button>
          </div>

          {/* Sheet Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Paket Türü */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-[#1d1d1f] dark:text-white">
                {language === 'tr' ? 'Paket Türü' : 'Package Type'}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {PACKAGE_FILTERS.map(option => (
                  <button
                    key={option.value}
                    // Seçili filtreye yeniden dokunmak filtreyi kaldırır
                    onClick={() => setPackageFilter(packageFilter === option.value ? 'all' : option.value)}
                    className={`
                      h-9 px-4 rounded-lg text-sm font-medium
                      ${packageFilter === option.value
                        ? 'bg-[#1d1d1f] dark:bg-[#0071e3] text-white'
                        : 'bg-white dark:bg-[#1d1d1f] text-[#1d1d1f] dark:text-white border border-[#d2d2d7] dark:border-[#2a3241] hover:border-[#0071e3] dark:hover:border-[#0071e3]'
                      }
                    `}
                  >
                    {language === 'tr' ? option.tr : option.en}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Sheet Footer */}
          <div className="px-6 py-4 border-t border-[#d2d2d7] dark:border-[#2a3241] shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setPackageFilter('all');
                  setIsFilterSheetOpen(false);
                }}
                className="flex-1 h-10 bg-gray-100 dark:bg-[#1d1d1f] text-[#1d1d1f] dark:text-white font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-[#2a3241] focus:outline-none"
              >
                {language === 'tr' ? 'Filtreleri Temizle' : 'Clear Filters'}
              </button>
              <button
                onClick={() => setIsFilterSheetOpen(false)}
                className="flex-1 h-10 bg-[#1d1d1f] dark:bg-[#0071e3] text-white font-medium rounded-xl hover:bg-black dark:hover:bg-[#0077ed] focus:outline-none "
              >
                {language === 'tr' ? 'Uygula' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Overlay */}
      {isFilterSheetOpen && (
        <div
          className="fixed inset-0 bg-black/25 backdrop-blur-sm z-40"
          onClick={() => setIsFilterSheetOpen(false)}
        />
      )}

      {/* Detail Panel */}
      <div className={`
        fixed inset-y-0 right-0 w-full lg:w-96 bg-white dark:bg-[#121621] shadow-xl transform transition-transform duration-300 ease-in-out z-50
        border-l border-[#d2d2d7] dark:border-[#2a3241]
        ${showDetailView ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="h-full flex flex-col">
          {/* Panel Header */}
          <div className="flex items-center gap-3 px-6 h-16 border-b border-[#d2d2d7] dark:border-[#2a3241] shrink-0">
            <button
              onClick={handleCloseDetail}
              className="lg:hidden p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#2a3241]"
            >
              <ChevronLeftIcon className="w-5 h-5 text-[#424245] dark:text-[#86868b]" />
            </button>
            <h2 className="text-lg font-medium text-[#1d1d1f] dark:text-white">
              {language === 'tr' ? 'Öğrenci Detayı' : 'Student Details'}
            </h2>
            <button
              onClick={handleCloseDetail}
              className="hidden lg:block ml-auto p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#2a3241]"
            >
              <XMarkIcon className="w-5 h-5 text-[#424245] dark:text-[#86868b]" />
            </button>
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {selectedStudent && (
              <div className="space-y-6">
                {/* Temel Bilgiler */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-[#1d1d1f] dark:text-white uppercase tracking-wider">
                    {language === 'tr' ? 'Temel Bilgiler' : 'Basic Information'}
                  </h3>
                  <div className="grid grid-cols-1 gap-4 bg-[#f5f5f7] dark:bg-[#161922] p-4 rounded-xl">
                    <div>
                      <label className="block text-xs text-[#6e6e73] dark:text-[#86868b] uppercase tracking-wider mb-1">
                        {language === 'tr' ? 'Öğrenci Adı' : 'Student Name'}
                      </label>
                      <span className="block text-sm font-medium text-[#1d1d1f] dark:text-white">
                        {selectedStudent.student_name}
                      </span>
                    </div>
                    <div>
                      <label className="block text-xs text-[#6e6e73] dark:text-[#86868b] uppercase tracking-wider mb-1">
                        {language === 'tr' ? 'Veli Adı' : 'Parent Name'}
                      </label>
                      <span className="block text-sm font-medium text-[#1d1d1f] dark:text-white">
                        {selectedStudent.parent_name}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Paket Bilgileri */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-[#1d1d1f] dark:text-white uppercase tracking-wider">
                    {language === 'tr' ? 'Paket Bilgileri' : 'Package Information'}
                  </h3>
                  <div className="grid grid-cols-1 gap-4 bg-[#f5f5f7] dark:bg-[#161922] p-4 rounded-xl">
                    <div>
                      <label className="block text-xs text-[#6e6e73] dark:text-[#86868b] uppercase tracking-wider mb-1">
                        {language === 'tr' ? 'Paket Türü' : 'Package Type'}
                      </label>
                      <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#0071e3]/5 to-[#34d399]/5 dark:from-[#0071e3]/10 dark:to-[#34d399]/10 text-[#0071e3]">
                        {translatePackageType(selectedStudent.package_type)}
                      </span>
                    </div>
                    <div>
                      <label className="block text-xs text-[#6e6e73] dark:text-[#86868b] uppercase tracking-wider mb-1">
                        {language === 'tr' ? 'Başlangıç Tarihi' : 'Start Date'}
                      </label>
                      <span className="block text-sm font-medium text-[#1d1d1f] dark:text-white">
                        {formatDate(selectedStudent.package_start_date)}
                      </span>
                    </div>
                    <div>
                      <label className="block text-xs text-[#6e6e73] dark:text-[#86868b] uppercase tracking-wider mb-1">
                        {language === 'tr' ? 'Bitiş Tarihi' : 'End Date'}
                      </label>
                      <span className="block text-sm font-medium text-[#1d1d1f] dark:text-white">
                        {selectedStudent.is_free
                          ? (language === 'tr' ? 'Süresiz' : 'Unlimited')
                          : formatDate(selectedStudent.package_end_date)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Kullanım Durumu — ders listesinin üstünde: sayılar güncel pakete aittir */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-[#1d1d1f] dark:text-white uppercase tracking-wider">
                      {language === 'tr' ? 'Kullanım Durumu' : 'Usage Status'}
                    </h3>
                    {packageStart && (
                      <p className="mt-1 text-[11px] text-[#6e6e73] dark:text-[#86868b]">
                        {language === 'tr'
                          ? `Güncel paket (${formatDate(packageStart)} tarihinden itibaren)`
                          : `Current package (since ${formatDate(packageStart)})`}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#f5f5f7] dark:bg-[#161922] p-4 rounded-xl flex items-center">
                      <div>
                      <label className="block text-xs text-[#6e6e73] dark:text-[#86868b] uppercase tracking-wider mb-1">
                        {language === 'tr' ? 'Kalan Ders' : 'Remaining Lessons'}
                      </label>
                      <span className={`font-medium ${
                          selectedStudent.is_free
                          ? 'text-base text-gray-700 dark:text-gray-300'
                            : selectedStudent.remaining_lessons <= 0
                          ? 'text-2xl text-red-700 dark:text-red-400'
                            : selectedStudent.remaining_lessons <= 2
                          ? 'text-2xl text-amber-700 dark:text-amber-400'
                          : 'text-2xl text-emerald-700 dark:text-emerald-400'
                      }`}>
                          {selectedStudent.is_free
                            ? (language === 'tr' ? 'Ücretsiz' : 'Free')
                            : selectedStudent.remaining_lessons}
                      </span>
                      {!selectedStudent.is_free && selectedStudent.carried_lessons > 0 && (
                        <p className="mt-1 text-[11px] text-[#6e6e73] dark:text-[#86868b]">
                          {language === 'tr'
                            ? `${selectedStudent.carried_lessons} ders önceki paketten devretti`
                            : `${selectedStudent.carried_lessons} carried over from the previous package`}
                        </p>
                      )}
                    </div>
                    </div>
                    <div className="bg-[#f5f5f7] dark:bg-[#161922] p-4 rounded-xl flex items-center">
                      <div>
                          <label className="block text-xs text-[#6e6e73] dark:text-[#86868b] uppercase tracking-wider mb-1">
                            {language === 'tr' ? 'Ödeme Durumu' : 'Payment Status'}
                          </label>
                        <span className={`inline-flex w-auto items-center px-3 py-1.5 rounded-lg text-xs font-medium ${
                          selectedStudent.payment_status === 'ucretsiz'
                              ? 'bg-gray-400/10 text-gray-700 ring-1 ring-gray-500/20 dark:bg-gray-400/10 dark:text-gray-300 dark:ring-gray-400/20'
                              : selectedStudent.payment_status === 'odendi'
                              ? 'bg-emerald-400/10 text-emerald-700 ring-1 ring-emerald-500/20 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20'
                              : 'bg-amber-400/10 text-amber-700 ring-1 ring-amber-500/20 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20'
                          }`}>
                          {translatePaymentStatus(selectedStudent.payment_status)}
                          </span>
                      </div>
                    </div>
                  </div>
                  {selectedStudent.unmarked_past > 0 && (
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      {language === 'tr'
                        ? `${selectedStudent.unmarked_past} geçmiş dersin yoklaması işaretlenmemiş; işaretlenene kadar kalan dersten düşmez.`
                        : `Attendance is not marked for ${selectedStudent.unmarked_past} past lesson${selectedStudent.unmarked_past === 1 ? '' : 's'}; they are not deducted until marked.`}
                    </p>
                  )}
                </div>

                {/* Katıldığı Dersler */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-[#1d1d1f] dark:text-white uppercase tracking-wider">
                      {language === 'tr' ? 'Dersler' : 'Lessons'}
                    </h3>
                  </div>

                  {loadingLessons ? (
                    // Loading state
                    <div className="space-y-2">
                      {[...Array(3)].map((_, index) => (
                        <div key={index} className="bg-[#f5f5f7] dark:bg-[#161922] p-4 rounded-xl">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1 w-1/2">
                              <div className="h-4 bg-[#e5e5ea] dark:bg-[#2a3241] rounded-md w-32 relative overflow-hidden">
                                {shimmer}
                              </div>
                              <div className="h-3 bg-[#e5e5ea] dark:bg-[#2a3241] rounded-md w-24 relative overflow-hidden">
                                {shimmer}
                              </div>
                            </div>
                            <div className="h-7 bg-[#e5e5ea] dark:bg-[#2a3241] rounded-lg w-20 relative overflow-hidden">
                              {shimmer}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : lessonsFailed ? (
                    // Dersler yüklenemediyse "ders yok" sanılmasın
                    <div className="bg-[#f5f5f7] dark:bg-[#161922] p-6 rounded-xl text-center">
                      <p className="text-[#1d1d1f] dark:text-white font-medium">
                        {language === 'tr' ? 'Dersler yüklenemedi' : 'The lessons could not be loaded'}
                      </p>
                      <button
                        onClick={() => fetchStudentLessons(selectedStudent.registration_id)}
                        className="mt-3 h-8 px-4 bg-[#1d1d1f] dark:bg-[#0071e3] text-white text-xs font-medium rounded-lg hover:bg-black dark:hover:bg-[#0077ed] focus:outline-none transition-colors"
                      >
                        {language === 'tr' ? 'Tekrar Dene' : 'Try Again'}
                      </button>
                    </div>
                  ) : studentLessons.length === 0 ? (
                    <div className="bg-[#f5f5f7] dark:bg-[#161922] p-6 rounded-xl text-center">
                      <p className="text-[#1d1d1f] dark:text-white font-medium">
                        {language === 'tr' ? 'Henüz ders kaydı yok' : 'No lessons recorded yet'}
                      </p>
                      <p className="text-sm text-[#6e6e73] dark:text-[#86868b] mt-1">
                        {language === 'tr' ? 'Bu öğrenci için ders planlaması yapılmamış.' : 'No lessons scheduled for this student'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {visibleLessons.map((lesson) => {
                        const isUpdating = updatingLessonIds.has(lesson.id);
                        // Günü geçmiş ama hâlâ "planlandı" duran ders: yoklaması unutulmuş
                        const isUnmarked = isAttendanceOverdue(lesson.status, lesson.events.event_date);

                        return (
                          <React.Fragment key={lesson.id}>
                            {lesson.id === firstOlderLessonId && (
                              <div className="flex items-center gap-3 pt-2">
                                <span className="text-[11px] font-medium uppercase tracking-wider text-[#6e6e73] dark:text-[#86868b]">
                                  {language === 'tr' ? 'Önceki paketler' : 'Earlier packages'}
                                </span>
                                <span className="flex-1 h-px bg-[#d2d2d7] dark:bg-[#2a3241]"></span>
                              </div>
                            )}
                            <div className="bg-[#f5f5f7] dark:bg-[#161922] rounded-xl overflow-hidden">
                              {/* Üst kısım - Ders bilgileri ve statü */}
                              <div className="p-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <span className="block text-sm font-medium text-[#1d1d1f] dark:text-white">
                                      {lesson.events.event_type === 'ingilizce'
                                        ? language === 'tr' ? 'İngilizce Oyun Dersi' : 'English Game Class'
                                        : lesson.events.event_type === 'duyusal'
                                        ? language === 'tr' ? 'Duyusal Gelişim Dersi' : 'Sensory Development Class'
                                        : lesson.events.custom_description || (language === 'tr' ? 'Özel Ders' : 'Custom Class')}
                                      {lesson.is_makeup && (language === 'tr' ? ' (Telafi)' : ' (Makeup)')}
                                    </span>
                                    <span className="text-xs text-[#6e6e73] dark:text-[#86868b] mt-1">
                                      {formatDate(lesson.events.event_date, 'dd MMMM yyyy, HH:mm')}
                                    </span>

                                    {/* Ek notlar */}
                                    {lesson.cancellation_reason && (
                                      <span className="block text-xs text-red-500 mt-1">
                                        {language === 'tr' ? 'İptal sebebi:' : 'Cancellation reason:'} {lesson.cancellation_reason}
                                      </span>
                                    )}
                                    {lesson.makeup_notes && (
                                      <span className="block text-xs text-blue-500 mt-1">
                                        {language === 'tr' ? 'Telafi notu:' : 'Makeup note:'} {lesson.makeup_notes}
                                      </span>
                                    )}
                                    {lesson.postponed_notes && (
                                      <span className="block text-xs text-amber-500 mt-1">
                                        {language === 'tr' ? 'Erteleme notu:' : 'Postponement note:'} {lesson.postponed_notes}
                                      </span>
                                    )}
                                  </div>

                                  <div>
                                    {/* Durum etiketi */}
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium
                                      ${isUnmarked ? 'bg-amber-400/10 text-amber-700 dark:text-amber-300 ring-1 ring-inset ring-amber-500/20 dark:ring-amber-400/20' :
                                        lesson.status === 'scheduled' ? 'bg-[#0071e3]/10 text-[#0071e3] ring-1 ring-inset ring-[#0071e3]/20' :
                                        lesson.status === 'attended' ? 'bg-emerald-400/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-inset ring-emerald-500/20 dark:ring-emerald-400/20' :
                                        lesson.status === 'no_show' ? 'bg-red-400/10 text-red-700 dark:text-red-300 ring-1 ring-inset ring-red-500/20 dark:ring-red-400/20' :
                                        lesson.status === 'cancelled' ? 'bg-gray-400/10 text-gray-700 dark:text-gray-300 ring-1 ring-inset ring-gray-500/20 dark:ring-gray-400/20' :
                                        lesson.status === 'makeup' ? 'bg-blue-400/10 text-blue-700 dark:text-blue-300 ring-1 ring-inset ring-blue-500/20 dark:ring-blue-400/20' :
                                        lesson.status === 'postponed' ? 'bg-amber-400/10 text-amber-700 dark:text-amber-300 ring-1 ring-inset ring-amber-500/20 dark:ring-amber-400/20' :
                                        'bg-gray-400/10 text-gray-700'
                                      }`}>
                                      {isUnmarked
                                        ? (language === 'tr' ? 'İşaretlenmedi' : 'Not marked')
                                        : translateLessonStatus(lesson.status)}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Border */}
                              <hr className="border-[#d2d2d7] dark:border-[#2a3241]" />

                              {/* Alt kısım - Butonlar (Her zaman göster) */}
                              <div className="p-3 bg-[#f5f5f7]/50 dark:bg-[#161922]/70 flex items-center justify-between gap-2">
                                {STATUS_BUTTONS.map(button => (
                                  <button
                                    key={button.status}
                                    onClick={() => updateLessonStatus(lesson, button.status)}
                                    disabled={isUpdating}
                                    className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg ${
                                      lesson.status === button.status ? button.active : button.idle
                                    } transition-colors disabled:opacity-50 disabled:cursor-wait`}
                                  >
                                    {language === 'tr' ? button.tr : button.en}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </React.Fragment>
                        );
                      })}

                      {/* Load More Button */}
                      {visibleLessonsCount < studentLessons.length && (
                        <div className="flex justify-center pt-4">
                          <button
                            onClick={handleLoadMore}
                            className="px-6 py-3 bg-[#f5f5f7] dark:bg-[#161922] text-[#1d1d1f] dark:text-white border border-[#d2d2d7] dark:border-[#2a3241] rounded-xl hover:bg-[#e5e5ea] dark:hover:bg-[#1a1f2e] focus:outline-none focus:ring-2 focus:ring-[#0071e3] focus:ring-offset-2 dark:focus:ring-offset-[#121621] transition-all duration-200 flex items-center gap-2"
                          >
                            <span className="text-sm font-medium">
                              {language === 'tr' ? 'Daha Fazla Yükle' : 'Load More'}
                            </span>
                            <span className="text-xs text-[#6e6e73] dark:text-[#86868b] bg-[#e5e5ea] dark:bg-[#2a3241] px-2 py-1 rounded-full">
                              +{Math.min(10, studentLessons.length - visibleLessonsCount)}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* İstatistikler */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-[#1d1d1f] dark:text-white uppercase tracking-wider">
                      {language === 'tr' ? 'İstatistikler' : 'Statistics'}
                    </h3>
                    {packageStart && (
                      <p className="mt-1 text-[11px] text-[#6e6e73] dark:text-[#86868b]">
                        {language === 'tr' ? 'Yalnızca güncel paket' : 'Current package only'}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#f5f5f7] dark:bg-[#161922] p-4 rounded-xl">
                      <label className="block text-[10px] text-[#6e6e73] dark:text-[#86868b] uppercase tracking-wider mb-1">
                        {language === 'tr' ? 'Katıldığı Dersler' : 'Attended Lessons'}
                      </label>
                      <span className="text-2xl font-medium text-[#1d1d1f] dark:text-white">
                        {selectedStudent.attended_lessons || 0}
                      </span>
                    </div>
                    <div className="bg-[#f5f5f7] dark:bg-[#161922] p-4 rounded-xl">
                      <label className="block text-[10px] text-[#6e6e73] dark:text-[#86868b] uppercase tracking-wider mb-1">
                        {language === 'tr' ? 'Gelmeyen' : 'Absents'}
                      </label>
                      <span className="text-2xl font-medium text-[#1d1d1f] dark:text-white">
                        {selectedStudent.no_show_lessons || 0}
                      </span>
                    </div>
                    <div className="bg-[#f5f5f7] dark:bg-[#161922] p-4 rounded-xl">
                      <label className="block text-[10px] text-[#6e6e73] dark:text-[#86868b] uppercase tracking-wider mb-1">
                        {language === 'tr' ? 'Telafi Dersleri' : 'Makeup Lessons'}
                      </label>
                      <span className="text-2xl font-medium text-[#1d1d1f] dark:text-white">
                        {selectedStudent.makeup_completed || 0}
                      </span>
                    </div>
                    <div className="bg-[#f5f5f7] dark:bg-[#161922] p-4 rounded-xl">
                      <label className="block text-[10px] text-[#6e6e73] dark:text-[#86868b] uppercase tracking-wider mb-1">
                        {language === 'tr' ? 'Ertelenen Dersler' : 'Postponed Lessons'}
                      </label>
                      <span className="text-2xl font-medium text-[#1d1d1f] dark:text-white">
                        {selectedStudent.postponed_lessons || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Overlay */}
      {showDetailView && (
        <div
          className="lg:hidden fixed inset-0 bg-black/25 backdrop-blur-sm z-40"
          onClick={handleCloseDetail}
        />
      )}

      {/* Toast */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
      />
    </div>
  );
};

export default RemainingUsage;
