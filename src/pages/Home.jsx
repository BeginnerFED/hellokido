import React, { useState, useEffect, useRef } from 'react';
import { FiClock, FiUsers, FiInfo, FiPackage } from 'react-icons/fi';
import { FaWhatsapp, FaLiraSign, FaCheck } from 'react-icons/fa';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../lib/supabase';
import { fetchLessonUsageMap } from '../lib/lessonUsage';
import { whatsAppLink } from '../lib/phone';
import { localDateKey } from '../lib/dates';
import { holdsSeat } from '../lib/attendance';
import Toast from '../components/ui/Toast';
import UnmarkedLessons from '../components/UnmarkedLessons';
import { format, startOfDay, addDays, differenceInCalendarDays } from 'date-fns';
import { tr, enUS } from 'date-fns/locale';
import Masonry from 'react-masonry-css';
import {
  ArrowPathIcon,
  CalendarDaysIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

// Hatırlatma gönderildi işaretleri bu tarayıcıda tutulur: { katılımcıId: dersin günü }.
// İşaret derse bağlıdır (tıklanan güne değil) ve dersin günü geçince silinir.
const SENT_REMINDERS_KEY = 'sentWhatsAppReminders';

const loadSentReminders = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(SENT_REMINDERS_KEY) || '{}');
    const today = localDateKey();
    const kept = {};
    for (const [participantId, lessonDay] of Object.entries(stored || {})) {
      if (typeof lessonDay === 'string' && lessonDay >= today) kept[participantId] = lessonDay;
    }
    localStorage.setItem(SENT_REMINDERS_KEY, JSON.stringify(kept));
    localStorage.removeItem('sentWhatsAppMessages'); // eski biçim (tıklanan güne göre tutuluyordu)
    return kept;
  } catch {
    // Depolama kullanılamıyor ya da içerik bozuk: işaretsiz başla, sayfa açılsın
    return {};
  }
};

// Yanıt gelmeyen istek 15 sn sonra hata sayılır; bağlantı koptuğunda ekran sonsuza dek
// "yükleniyor" ya da "kaydedildi" gibi görünmesin.
const REQUEST_TIMEOUT_MS = 15000;

const withTimeout = async (buildQuery) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await buildQuery(controller.signal);
  } finally {
    clearTimeout(timer);
  }
};

// Bir günün aktif derslerini katılımcıları ve kayıt bilgileriyle getirir
// (iki istek: dersler + katılımcılar, ardından kayıtlar)
const fetchEventsOfDay = async (dayStart) => {
  const { data: events, error: eventsError } = await withTimeout(signal => supabase
    .from('events')
    .select('*, event_participants(*)') // katılımcılar: TÜM STATÜLER
    .gte('event_date', dayStart.toISOString())
    .lt('event_date', addDays(dayStart, 1).toISOString())
    .eq('is_active', true)
    .order('event_date', { ascending: true })
    .order('created_at', { referencedTable: 'event_participants', ascending: true })
    .abortSignal(signal));

  if (eventsError) throw eventsError;

  const registrationIds = [...new Set(
    events.flatMap(event => event.event_participants.map(participant => participant.registration_id))
  )];

  let registrations = [];
  if (registrationIds.length > 0) {
    const { data, error: registrationsError } = await withTimeout(signal => supabase
      .from('registrations')
      .select('id, student_name, student_age, parent_name, parent_phone, package_type, package_start_date')
      .in('id', registrationIds)
      .abortSignal(signal));

    if (registrationsError) throw registrationsError;
    registrations = data;
  }

  const registrationById = new Map(registrations.map(registration => [registration.id, registration]));

  return events.map(({ event_participants: participants, ...event }) => ({
    ...event,
    participants: participants
      // Yapı önceki ile uyumlu olması için kayıt bilgisi "registrations" alanında durur
      .map(participant => ({ ...participant, registrations: registrationById.get(participant.registration_id) }))
      // Kaydı bulunamayan katılımcı çizilemez (tüm sayfa boş kalırdı)
      .filter(participant => participant.registrations)
  }));
};

// Liste yüklenemediğinde "kayıt yok" demek yerine gösterilen kart
const LoadFailed = ({ language, onRetry }) => (
  <div className="text-center py-12 bg-white dark:bg-[#121621] rounded-xl border border-[#d2d2d7] dark:border-[#2a3241]">
    <ExclamationTriangleIcon className="w-12 h-12 mx-auto text-[#86868b] mb-4" />
    <h3 className="text-lg font-medium text-[#1d1d1f] dark:text-white mb-1">
      {language === 'en' ? 'Could not load' : 'Veriler yüklenemedi'}
    </h3>
    <p className="text-sm text-[#6e6e73] dark:text-[#86868b] max-w-md mx-auto">
      {language === 'en' ? 'Check your connection and try again.' : 'Bağlantınızı kontrol edip tekrar deneyin.'}
    </p>
    <button
      onClick={onRetry}
      className="mt-4 text-sm font-medium text-[#0071e3] hover:text-[#0077ED]"
    >
      {language === 'en' ? 'Try again' : 'Tekrar dene'}
    </button>
  </div>
);

const Home = () => {
  const { language } = useLanguage();
  const [tomorrowEvents, setTomorrowEvents] = useState([]);
  const [todayEvents, setTodayEvents] = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [expiringSoonPackages, setExpiringSoonPackages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingToday, setIsLoadingToday] = useState(true);
  const [isLoadingPayments, setIsLoadingPayments] = useState(true);
  const [isLoadingPackages, setIsLoadingPackages] = useState(true);
  // Yüklenemeyen bölümler: "ders yok" / "bekleyen ödeme yok" gibi yanlış bir bilgi yerine hata gösterilir
  const [loadFailed, setLoadFailed] = useState({ tomorrow: false, today: false, payments: false, packages: false });
  const [sentMessages, setSentMessages] = useState(loadSentReminders);
  // Kaydı süren yoklamalar (her çocuk kendi isteği bitene kadar kilitli kalır)
  const inFlightLessonsRef = useRef(new Set());
  const [updatingLessonIds, setUpdatingLessonIds] = useState(() => new Set());
  const [lessonUsage, setLessonUsage] = useState({}); // registration_id -> kalan ders bilgisi
  // Gün değişince "yoklaması işaretlenmemiş dersler" bölümü de yenilenir
  const [unmarkedRefreshKey, setUnmarkedRefreshKey] = useState(0);
  const [toast, setToast] = useState({ isVisible: false, message: '', type: 'error' });

  const showToast = (message, type = 'error') => setToast({ isVisible: true, message, type });

  const markLoadFailed = (section, failed) => setLoadFailed(prev => ({ ...prev, [section]: failed }));

  // Mesaj durumunu kontrol et
  const isMessageSent = (participantId) => Boolean(sentMessages[participantId]);

  // Hatırlatma gönderildi olarak işaretle (bağlantı yeni sekmede WhatsApp'ı açmaya devam eder)
  const markReminderSent = (participantId, eventDate) => {
    setSentMessages(prev => {
      const next = { ...prev, [participantId]: localDateKey(new Date(eventDate)) };
      try {
        localStorage.setItem(SENT_REMINDERS_KEY, JSON.stringify(next));
      } catch {
        // Depolama kullanılamıyor: işaret yalnızca bu oturumda görünür
      }
      return next;
    });
  };

  // Yarınki dersleri ve katılımcıları çeken fonksiyon
  const fetchTomorrowEvents = async () => {
    setIsLoading(true);

    try {
      const events = await fetchEventsOfDay(addDays(startOfDay(new Date()), 1));
      setTomorrowEvents(events);
      markLoadFailed('tomorrow', false);
      await refreshLessonUsageForEvents(events);
    } catch (error) {
      console.error('Yarınki dersler çekilirken hata oluştu:', error);
      setTomorrowEvents([]);
      markLoadFailed('tomorrow', true);
    } finally {
      setIsLoading(false);
    }
  };

  // Bugünkü dersleri ve katılımcıları çeken fonksiyon
  const fetchTodayEvents = async () => {
    setIsLoadingToday(true);

    try {
      const events = await fetchEventsOfDay(startOfDay(new Date()));
      setTodayEvents(events);
      markLoadFailed('today', false);
      await refreshLessonUsageForEvents(events);
    } catch (error) {
      console.error('Bugünkü dersler çekilirken hata oluştu:', error);
      setTodayEvents([]);
      markLoadFailed('today', true);
    } finally {
      setIsLoadingToday(false);
    }
  };

  // Ödemesi bekleyen kayıtları çeken fonksiyon
  const fetchPendingPayments = async () => {
    setIsLoadingPayments(true);

    try {
      // Ödemesi beklemede olan aktif kayıtları çek (arşivlenen kayıt listelerden çıkar)
      const { data, error } = await withTimeout(signal => supabase
        .from('registrations')
        .select('*')
        .eq('payment_status', 'beklemede')
        .eq('is_active', true)
        .neq('package_type', 'ucretsiz') // Ücretsiz katılımlarda ödeme beklenmez
        .order('created_at', { ascending: false })
        .abortSignal(signal));

      if (error) throw error;

      setPendingPayments(data || []);
      markLoadFailed('payments', false);
    } catch (error) {
      console.error('Bekleyen ödemeler çekilirken hata oluştu:', error);
      setPendingPayments([]);
      markLoadFailed('payments', true);
    } finally {
      setIsLoadingPayments(false);
    }
  };

  // Paketi biten ya da yakında bitecek aktif kayıtları çeken fonksiyon
  const fetchExpiringSoonPackages = async () => {
    setIsLoadingPackages(true);

    try {
      // Bitiş tarihi en geç 7 gün sonra olan paketler. Alt sınır yok: paketi bitmiş ama
      // yenilenmemiş öğrenci, paket yenilenene ya da kayıt arşivlenene kadar listede kalır
      // (yenilemeler çoğunlukla bitiş tarihinden sonra giriliyor). Bitiş günü, günün başı
      // olarak saklandığı için pencere gün sınırlarıyla kurulur; son gün de listede görünür.
      const windowEnd = addDays(startOfDay(new Date()), 7);

      const { data, error } = await withTimeout(signal => supabase
        .from('registrations')
        .select('*')
        .eq('is_active', true)
        .neq('package_type', 'ucretsiz') // Ücretsiz katılımda paket bitiş tarihi uygulanmaz
        .lte('package_end_date', windowEnd.toISOString())
        .order('package_end_date', { ascending: true })
        .abortSignal(signal));

      if (error) throw error;

      setExpiringSoonPackages(data || []);
      markLoadFailed('packages', false);
    } catch (error) {
      console.error('Bitiş tarihi yaklaşan paketler çekilirken hata oluştu:', error);
      setExpiringSoonPackages([]);
      markLoadFailed('packages', true);
    } finally {
      setIsLoadingPackages(false);
    }
  };

  // Etkinliklerdeki benzersiz kayıtlar için kalan ders haritasını günceller (tek toplu sorgu)
  const refreshLessonUsageForEvents = async (eventsWithParticipants) => {
    try {
      const uniqueRegistrations = [];
      const seenIds = new Set();
      eventsWithParticipants.forEach(event => {
        event.participants.forEach(participant => {
          const registration = participant.registrations;
          if (registration && registration.id && !seenIds.has(registration.id)) {
            seenIds.add(registration.id);
            uniqueRegistrations.push(registration);
          }
        });
      });

      if (uniqueRegistrations.length === 0) return;

      const usageMap = await fetchLessonUsageMap(uniqueRegistrations);
      setLessonUsage(prev => ({ ...prev, ...usageMap }));
    } catch (error) {
      // Rozet gösterilemese de ders listeleri çalışmaya devam etmeli
      console.error('Kalan ders bilgisi getirilirken hata oluştu:', error);
    }
  };

  // Kalan ders rozeti (kullanılan = katıldı + gelmedi, güncel paket dönemi — bkz. src/lib/lessonUsage.js)
  const renderRemainingBadge = (participant) => {
    const usage = lessonUsage[participant.registration_id];
    if (!usage) return null;

    // Ücretsiz katılımda kota yok — eşik kontrollerinden ÖNCE (null <= 0 true döner)
    if (usage.isFree) {
      return (
        <span className="inline-flex items-center w-fit mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 ring-inset bg-gray-400/10 text-gray-700 ring-gray-500/20 dark:bg-gray-400/10 dark:text-gray-300 dark:ring-gray-400/20">
          {language === 'en' ? 'Free' : 'Ücretsiz'}
        </span>
      );
    }

    const colorClass = usage.remaining <= 0
      ? 'bg-red-400/10 text-red-700 ring-red-500/20 dark:bg-red-400/10 dark:text-red-300 dark:ring-red-400/20'
      : usage.remaining <= 2
        ? 'bg-amber-400/10 text-amber-700 ring-amber-500/20 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20'
        : 'bg-emerald-400/10 text-emerald-700 ring-emerald-500/20 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20';

    return (
      <span className={`inline-flex items-center w-fit mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 ring-inset ${colorClass}`}>
        {language === 'en'
          ? `${usage.remaining} lesson${usage.remaining === 1 ? '' : 's'} left`
          : `${usage.remaining} ders kaldı`}
      </span>
    );
  };

  // Geçmiş bir dersin yoklaması işaretlenince o öğrencinin kalan ders rozeti yenilenir
  const refreshUsageOf = async (registration) => {
    try {
      const usageMap = await fetchLessonUsageMap([registration]);
      setLessonUsage(prev => ({ ...prev, ...usageMap }));
    } catch (error) {
      // Yoklama kaydedildi; yalnızca rozet yenilenemedi
      console.error('Kalan ders bilgisi getirilirken hata oluştu:', error);
    }
  };

  // Bugünkü listede bir katılımcının statüsünü değiştirir
  const setParticipantStatus = (lessonId, status) => {
    setTodayEvents(prevEvents => prevEvents.map(event => ({
      ...event,
      participants: event.participants.map(participant => (
        participant.id === lessonId ? { ...participant, status } : participant
      ))
    })));
  };

  // Ders statüsünü güncelleyen fonksiyon
  const updateLessonStatus = async (participant, newStatus) => {
    const lessonId = participant.id;
    const previousStatus = participant.status;

    // Aynı statüye yeniden dokunmak ya da kayıt sürerken ikinci dokunuş istek göndermez
    if (previousStatus === newStatus || inFlightLessonsRef.current.has(lessonId)) return;

    inFlightLessonsRef.current.add(lessonId);
    setUpdatingLessonIds(new Set(inFlightLessonsRef.current));

    // Optimistik UI güncellemesi - API çağrısından önce UI'ı güncelle
    // Bu sayede sayfa yeniden yüklenmeyecek ve kullanıcı aynı yerde kalacak
    setParticipantStatus(lessonId, newStatus);

    try {
      const { data, error } = await withTimeout(signal => supabase
        .from('event_participants')
        .update({ status: newStatus })
        .eq('id', lessonId)
        .select('id')
        .abortSignal(signal));

      if (error) throw error;
      // Hata yok ama güncellenen satır da yok: katılımcı bu sırada dersten çıkarılmış
      if (!data || data.length === 0) throw new Error('no_rows_updated');
    } catch (error) {
      console.error('Ders statüsü güncellenirken hata oluştu:', error);

      // Kaydedilmedi: ekrandaki işaret geri alınır ve kullanıcıya söylenir
      setParticipantStatus(lessonId, previousStatus);
      showToast(language === 'en'
        ? 'Could not save. Check your connection and try again.'
        : 'Kaydedilemedi. Bağlantınızı kontrol edip tekrar deneyin.');
      if (error.message === 'no_rows_updated') fetchTodayEvents();

      inFlightLessonsRef.current.delete(lessonId);
      setUpdatingLessonIds(new Set(inFlightLessonsRef.current));
      return;
    }

    try {
      if (participant.registrations) {
        // Katıldı/Gelmedi kalan dersi etkiler — sadece bu kaydın kullanımını yenile
        // (delta yerine hedefli refetch: kota aşımındaki 0'a sabitleme delta ile yanlış sonuç verir)
        const usageMap = await fetchLessonUsageMap([participant.registrations]);
        setLessonUsage(prev => ({ ...prev, ...usageMap }));
      }
    } catch (error) {
      // Statü kaydedildi; yalnızca rozet yenilenemedi
      console.error('Kalan ders bilgisi getirilirken hata oluştu:', error);
    } finally {
      inFlightLessonsRef.current.delete(lessonId);
      setUpdatingLessonIds(new Set(inFlightLessonsRef.current));
    }
  };

  useEffect(() => {
    const loadAll = () => {
      fetchTomorrowEvents();
      fetchTodayEvents();
      fetchPendingPayments();
      fetchExpiringSoonPackages();
    };

    loadAll();

    // Sekme gece açık kaldıysa ya da ertesi gün yeniden açıldıysa listeler yeni güne göre
    // yenilenir; yoksa "Yarınki Dersler" başlığı altında dünün listesi kalıyordu.
    let loadedDay = localDateKey();
    const refreshIfDayChanged = () => {
      if (document.visibilityState !== 'visible') return;
      const today = localDateKey();
      if (today === loadedDay) return;

      loadedDay = today;
      setSentMessages(loadSentReminders());
      setUnmarkedRefreshKey(key => key + 1);
      loadAll();
    };

    document.addEventListener('visibilitychange', refreshIfDayChanged);
    window.addEventListener('focus', refreshIfDayChanged);
    const timer = setInterval(refreshIfDayChanged, 60 * 1000);

    return () => {
      document.removeEventListener('visibilitychange', refreshIfDayChanged);
      window.removeEventListener('focus', refreshIfDayChanged);
      clearInterval(timer);
    };
  }, []);

  // Hatırlatma metninde tarihin yanına yazılan gün: dersin gününden hesaplanır
  const reminderDayLabel = (eventDate) => {
    const dayOffset = differenceInCalendarDays(new Date(eventDate), new Date());
    if (dayOffset === 1) return ' (Yarın)';
    if (dayOffset === 0) return ' (Bugün)';
    return '';
  };

  // Format date based on selected language
  const formatDate = (date, formatStr) => {
    return format(date, formatStr, { locale: language === 'tr' ? tr : enUS });
  };

  // Etkinlik türüne göre renkler
  const eventTypeColors = {
    'ingilizce': 'bg-[#0071e3]/10 text-[#0071e3] ring-1 ring-[#0071e3]/20',
    'duyusal': 'bg-[#ac39ff]/10 text-[#ac39ff] ring-1 ring-[#ac39ff]/20',
    'ozel': 'bg-[#ff9500]/10 text-[#ff9500] ring-1 ring-[#ff9500]/20'
  };

  // Velilere giden hatırlatma metni her zaman Türkçedir (yönetim ekranının dilinden bağımsız)
  const eventTypeLabelsTr = {
    'ingilizce': 'İngilizce',
    'duyusal': 'Duyusal',
    'ozel': 'Özel Etkinlik'
  };

  // Etkinlik türüne göre ikonlar
  const eventTypeIcons = {
    'ingilizce': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"></path></svg>,
    'duyusal': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>,
    'ozel': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"></path></svg>
  };

  // Yarın için tarih formatını hazırla
  const tomorrowDateString = formatDate(
    new Date(new Date().setDate(new Date().getDate() + 1)),
    'd MMMM EEEE'
  );

  // Bugün için tarih formatını hazırla
  const todayDateString = formatDate(new Date(), 'd MMMM EEEE');

  // Masonry breakpoints
  const breakpointColumns = {
    default: 4,
    1536: 3,
    1280: 2,
    768: 1,
    640: 1
  };

  // Duruma göre renk ve etiket tanımlamaları ekleyelim
  const statusColors = {
    'scheduled': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-300 dark:border-blue-800/50',
    'attended': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border border-green-300 dark:border-green-800/50',
    'no_show': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border border-red-300 dark:border-red-800/50',
    'cancelled': 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300 border border-gray-300 dark:border-gray-800/50',
    'makeup': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-300 dark:border-purple-800/50',
    'postponed': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-300 dark:border-amber-800/50'
  };

  const statusLabels = {
    'scheduled': { tr: 'Planlandı', en: 'Scheduled' },
    'attended': { tr: 'Katıldı', en: 'Joined' },
    'no_show': { tr: 'Gelmedi', en: 'Absent' },
    'cancelled': { tr: 'İptal', en: 'Canceled' },
    'makeup': { tr: 'Telafi', en: 'Makeup' },
    'postponed': { tr: 'Ertelendi', en: 'Delayed' }
  };

  return (
    <div>
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
      />

      {/* Header */}
      <div className="flex items-center justify-between h-auto sm:h-16 px-6 border-b border-[#d2d2d7] dark:border-[#2a3241] py-4 sm:py-0 gap-4 sm:gap-0">
        <div>
          <h1 className="text-xl font-medium text-[#1d1d1f] dark:text-white">
            {language === 'en' ? 'Home' : 'Anasayfa'}
          </h1>
        </div>
        <div className="flex items-center">
          <div className="text-sm text-[#6e6e73] dark:text-[#86868b]">
            {language === 'en' ? 'Today: ' : 'Bugün: '}
            <span className="font-semibold text-[#1d1d1f] dark:text-white">
              {formatDate(new Date(), 'd MMMM yyyy')}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Yarınki Dersler Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#0071e3]/10 border border-[#0071e3]/20 flex items-center justify-center self-start sm:self-center">
              <CalendarDaysIcon className="h-4 w-4 text-[#0071e3]" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center">
              <h2 className="text-lg font-semibold text-[#1d1d1f] dark:text-white">
                {language === 'en' ? 'Tomorrow\'s Lessons' : 'Yarınki Dersler'}
              </h2>
              <span className="text-sm text-[#6e6e73] dark:text-[#86868b] capitalize sm:ml-2">
                ({tomorrowDateString})
              </span>
            </div>
          </div>
          <button
            onClick={fetchTomorrowEvents}
            className="flex items-center gap-1.5 text-[#0071e3] hover:text-[#0077ED] text-sm font-medium"
          >
            <ArrowPathIcon className="h-4 w-4" />
            <span>{language === 'en' ? 'Refresh' : 'Yenile'}</span>
          </button>
        </div>

        {isLoading ? (
          // Loading State
          <Masonry
            breakpointCols={breakpointColumns}
            className="flex -ml-6 w-auto"
            columnClassName="pl-6"
          >
            {[...Array(4)].map((_, index) => (
              <div
                key={index}
                className="mb-6 bg-white dark:bg-[#121621] rounded-xl p-5 border border-[#d2d2d7] dark:border-[#2a3241] relative overflow-hidden"
              >
                {/* Kart Başlığı */}
                <div className="flex items-start justify-between pb-4 border-b border-[#d2d2d7] dark:border-[#2a3241]">
                  <div>
                    <div className="h-[18px] bg-[#f5f5f7] dark:bg-[#2a3241] rounded-md w-32 relative overflow-hidden">
                      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent" />
                    </div>
                    <div className="h-[16px] bg-[#f5f5f7] dark:bg-[#2a3241] rounded-md w-20 mt-1.5 relative overflow-hidden">
                      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent" />
                    </div>
                  </div>
                  <div className="h-[26px] bg-[#f5f5f7] dark:bg-[#2a3241] rounded-lg w-24 relative overflow-hidden">
                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent" />
                  </div>
                </div>

                {/* Placeholder İçerik */}
                <div className="mt-4 space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex gap-2">
                      <div className="w-5 h-5 rounded-full bg-[#f5f5f7] dark:bg-[#2a3241] relative overflow-hidden">
                        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent" />
                      </div>
                      <div className="flex-1 h-5 bg-[#f5f5f7] dark:bg-[#2a3241] rounded-md relative overflow-hidden">
                        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </Masonry>
        ) : loadFailed.tomorrow ? (
          <LoadFailed language={language} onRetry={fetchTomorrowEvents} />
        ) : tomorrowEvents.length === 0 ? (
          // Boş State
          <div className="text-center py-12 bg-white dark:bg-[#121621] rounded-xl border border-[#d2d2d7] dark:border-[#2a3241]">
            <CalendarDaysIcon className="w-12 h-12 mx-auto text-[#86868b] mb-4" />
            <h3 className="text-lg font-medium text-[#1d1d1f] dark:text-white mb-1">
              {language === 'en' ? 'No lessons for tomorrow' : 'Yarın için ders bulunmuyor'}
            </h3>
            <p className="text-sm text-[#6e6e73] dark:text-[#86868b] max-w-md mx-auto">
              {language === 'en'
                ? 'There are no lessons scheduled for tomorrow. You can add new lessons from the Calendar page.'
                : 'Yarın için planlanmış herhangi bir ders bulunmuyor. Takvim sayfasından yeni ders ekleyebilirsiniz.'}
            </p>
          </div>
        ) : (
          // Dersler
          <Masonry
            breakpointCols={breakpointColumns}
            className="flex -ml-6 w-auto"
            columnClassName="pl-6"
          >
            {tomorrowEvents.map((event) => (
              <div
                key={event.id}
                className="mb-6 group bg-white dark:bg-[#121621] rounded-xl border border-[#d2d2d7] dark:border-[#2a3241] hover:border-[#0071e3] dark:hover:border-[#0071e3] hover:shadow-lg dark:hover:shadow-[#0071e3]/10 transition-all duration-200 relative overflow-hidden"
              >
                <div className="p-5">
                  {/* Kart Başlığı */}
                  <div className="flex items-start justify-between pb-4 border-b border-[#d2d2d7] dark:border-[#2a3241]">
                    <div>
                      <h3 className="text-[15px] font-medium text-[#1d1d1f] dark:text-white flex items-center gap-2">
                        {formatDate(new Date(event.event_date), 'HH:mm')}
                        <span className="text-[#6e6e73] dark:text-[#86868b]">|</span>
                        {event.age_group}
                      </h3>
                      <p className="text-[13px] text-[#6e6e73] dark:text-[#86868b] mt-0.5">
                        {language === 'en' ? 'Capacity: ' : 'Kapasite: '}
                        {event.participants.filter(p => holdsSeat(p.status)).length}/6
                      </p>
                    </div>
                    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium ${eventTypeColors[event.event_type]}`}>
                      {eventTypeIcons[event.event_type]}
                    </div>
                  </div>

                  {/* Açıklama (varsa) */}
                  {event.custom_description && (
                    <div className="mt-4 mb-4 text-[13px] text-[#424245] dark:text-[#86868b] bg-[#f5f5f7] dark:bg-[#1c1c1e]/40 p-3 rounded-lg">
                      <div className="flex gap-2">
                        <FiInfo className="w-[18px] h-[18px] shrink-0 text-[#0071e3]" />
                        <p>{event.custom_description}</p>
                      </div>
                    </div>
                  )}

                  {/* Katılımcılar */}
                  <div className="mt-4">
                    <h4 className="text-[13px] font-medium text-[#1d1d1f] dark:text-white flex items-center gap-1.5 mb-3">
                      <FiUsers className="w-4 h-4 text-[#0071e3]" />
                      {language === 'en' ? 'Participants' : 'Katılımcılar'}
                    </h4>

                    {event.participants.length === 0 ? (
                      <p className="text-[13px] text-[#6e6e73] dark:text-[#86868b] italic">
                        {language === 'en' ? 'No participants yet' : 'Henüz katılımcı yok'}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {event.participants.map((participant) => (
                          <div
                            key={participant.id}
                            className="p-3 bg-[#f5f5f7] dark:bg-[#1c1c1e]/40 rounded-lg"
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-[#0071e3]/10 flex items-center justify-center text-[#0071e3] text-xs font-medium">
                                    {participant.registrations.student_name.charAt(0)}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="text-[13px] font-medium text-[#1d1d1f] dark:text-white">
                                        {participant.registrations.student_name}
                                        <span className="ml-1.5 text-[11px] text-[#6e6e73] dark:text-[#86868b] font-normal">
                                          ({participant.registrations.student_age})
                                        </span>
                                      </p>
                                    </div>
                                    <p className="text-[11px] text-[#6e6e73] dark:text-[#86868b]">
                                      {language === 'en' ? 'Parent: ' : 'Veli: '}{participant.registrations.parent_name}
                                    </p>
                                    {renderRemainingBadge(participant)}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {/* Statü Etiketi */}
                                <span className={`text-[10px] px-2 py-0.5 rounded-full flex items-center justify-center ${statusColors[participant.status] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'}`}>
                                  {statusLabels[participant.status]?.[language] || participant.status}
                                </span>

                                {/* WhatsApp butonu - sadece scheduled durumdaki öğrenciler için gösterilsin */}
                                {participant.status === 'scheduled' && whatsAppLink(participant.registrations.parent_phone) && (
                                  <a
                                    href={whatsAppLink(participant.registrations.parent_phone, `Merhaba ${participant.registrations.parent_name} Hanım
Çocuğunuzun etkinliğimizde bize katılacak olmasından büyük mutluluk duyuyoruz! İşte rezervasyonunuzla ilgili detaylar:
* Etkinlik Tarihi: ${format(new Date(event.event_date), 'd MMMM yyyy', { locale: tr })}${reminderDayLabel(event.event_date)}
* Saat: ${format(new Date(event.event_date), 'HH:mm', { locale: tr })} 
* Etkinlik: ${eventTypeLabelsTr[event.event_type]} 
* Yer: Ritim İstanbul B blok Kat:1 Ofis 237
* Adres: https://maps.app.goo.gl/rb2m4migY24gA8GMA
* Süre: 75-90 dk
Etkinlik sırasında çocuklarınızı güvende tutmak için gerekli tüm önlemleri aldık. Lütfen çocuğunuzun rahat kıyafetlerle gelmesini sağlayın ve yanlarına bir su şişesi ve küçük bir atıştırmalık getirmeyi unutmayın. Yedek kıyafet yada aktivite önlüğü getirmenizi tavsiye ederiz.
Rezervasyonunuzun iptali için lütfen bir gün önceden bizi bilgilendiriniz. Rezervasyonunuza saatinde gelmenizi rica ederiz. 
Eğer herhangi bir sorunuz varsa, lütfen bize ulaşmaktan çekinmeyin.
Sizleri ve çocuğunuzu atölyemizde görmek için sabırsızlanıyoruz!
Sevgilerle,
HelloKido Oyun Atölyesi`)}
                                    onClick={() => markReminderSent(participant.id, event.event_date)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-8 h-8 rounded-full bg-[#f5f5f7] dark:bg-[#2a3241] hover:bg-[#e5e5e5] dark:hover:bg-[#3a4251] flex items-center justify-center text-[#34c759] border border-[#d2d2d7] dark:border-[#2a3241] transition-colors relative"
                                    title={language === 'en' ? 'Send Reminder via WhatsApp' : 'WhatsApp\'tan Hatırlatma Mesajı Gönder'}
                                  >
                                    <FaWhatsapp className="w-4 h-4" />
                                    {isMessageSent(participant.id) && (
                                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-white dark:bg-[#2a3241] rounded-full flex items-center justify-center border border-[#d2d2d7] dark:border-[#1c1c1e]">
                                        <FaCheck className="w-2 h-2 text-[#34c759]" />
                                      </div>
                                    )}
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </Masonry>
        )}

        {/* Bugünkü Dersler Header */}
        <div className="flex items-center justify-between mb-6 mt-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#ff9500]/10 border border-[#ff9500]/20 flex items-center justify-center self-start sm:self-center">
              <FiClock className="h-4 w-4 text-[#ff9500]" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center">
              <h2 className="text-lg font-semibold text-[#1d1d1f] dark:text-white">
                {language === 'en' ? 'Today\'s Lessons' : 'Bugünkü Dersler'}
              </h2>
              <span className="text-sm text-[#6e6e73] dark:text-[#86868b] capitalize sm:ml-2">
                ({todayDateString})
              </span>
            </div>
          </div>
          <button
            onClick={fetchTodayEvents}
            className="flex items-center gap-1.5 text-[#ff9500] hover:text-[#ffA520] text-sm font-medium"
          >
            <ArrowPathIcon className="h-4 w-4" />
            <span>{language === 'en' ? 'Refresh' : 'Yenile'}</span>
          </button>
        </div>

        {isLoadingToday ? (
          // Loading State
          <Masonry
            breakpointCols={breakpointColumns}
            className="flex -ml-6 w-auto"
            columnClassName="pl-6"
          >
            {[...Array(2)].map((_, index) => (
              <div
                key={index}
                className="mb-6 bg-white dark:bg-[#121621] rounded-xl p-5 border border-[#d2d2d7] dark:border-[#2a3241] relative overflow-hidden"
              >
                {/* Kart Başlığı */}
                <div className="flex items-start justify-between pb-4 border-b border-[#d2d2d7] dark:border-[#2a3241]">
                  <div>
                    <div className="h-[18px] bg-[#f5f5f7] dark:bg-[#2a3241] rounded-md w-32 relative overflow-hidden">
                      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent" />
                    </div>
                    <div className="h-[16px] bg-[#f5f5f7] dark:bg-[#2a3241] rounded-md w-20 mt-1.5 relative overflow-hidden">
                      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent" />
                    </div>
                  </div>
                  <div className="h-[26px] bg-[#f5f5f7] dark:bg-[#2a3241] rounded-lg w-24 relative overflow-hidden">
                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent" />
                  </div>
                </div>

                {/* Placeholder İçerik */}
                <div className="mt-4 space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex gap-2">
                      <div className="w-5 h-5 rounded-full bg-[#f5f5f7] dark:bg-[#2a3241] relative overflow-hidden">
                        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent" />
                      </div>
                      <div className="flex-1 h-5 bg-[#f5f5f7] dark:bg-[#2a3241] rounded-md relative overflow-hidden">
                        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </Masonry>
        ) : loadFailed.today ? (
          <LoadFailed language={language} onRetry={fetchTodayEvents} />
        ) : todayEvents.length === 0 ? (
          // Boş State
          <div className="text-center py-12 bg-white dark:bg-[#121621] rounded-xl border border-[#d2d2d7] dark:border-[#2a3241]">
            <FiClock className="w-12 h-12 mx-auto text-[#86868b] mb-4" />
            <h3 className="text-lg font-medium text-[#1d1d1f] dark:text-white mb-1">
              {language === 'en' ? 'No lessons for today' : 'Bugün için ders bulunmuyor'}
            </h3>
            <p className="text-sm text-[#6e6e73] dark:text-[#86868b] max-w-md mx-auto">
              {language === 'en'
                ? 'There are no lessons scheduled for today. You can add new lessons from the Calendar page.'
                : 'Bugün için planlanmış herhangi bir ders bulunmuyor. Takvim sayfasından yeni ders ekleyebilirsiniz.'}
            </p>
          </div>
        ) : (
          // Dersler
          <Masonry
            breakpointCols={breakpointColumns}
            className="flex -ml-6 w-auto"
            columnClassName="pl-6"
          >
            {todayEvents.map((event) => (
              <div
                key={event.id}
                className="mb-6 group bg-white dark:bg-[#121621] rounded-xl border border-[#d2d2d7] dark:border-[#2a3241] hover:border-[#ff9500] dark:hover:border-[#ff9500] hover:shadow-lg dark:hover:shadow-[#ff9500]/10 transition-all duration-200 relative overflow-hidden"
              >
                <div className="p-5">
                  {/* Kart Başlığı */}
                  <div className="flex items-start justify-between pb-4 border-b border-[#d2d2d7] dark:border-[#2a3241]">
                    <div>
                      <h3 className="text-[15px] font-medium text-[#1d1d1f] dark:text-white flex items-center gap-2">
                        {formatDate(new Date(event.event_date), 'HH:mm')}
                        <span className="text-[#6e6e73] dark:text-[#86868b]">|</span>
                        {event.age_group}
                      </h3>
                      <p className="text-[13px] text-[#6e6e73] dark:text-[#86868b] mt-0.5">
                        {language === 'en' ? 'Capacity: ' : 'Kapasite: '}
                        {event.participants.filter(p => holdsSeat(p.status)).length}/6
                      </p>
                    </div>
                    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium ${eventTypeColors[event.event_type]}`}>
                      {eventTypeIcons[event.event_type]}
                    </div>
                  </div>

                  {/* Açıklama (varsa) */}
                  {event.custom_description && (
                    <div className="mt-4 mb-4 text-[13px] text-[#424245] dark:text-[#86868b] bg-[#f5f5f7] dark:bg-[#1c1c1e]/40 p-3 rounded-lg">
                      <div className="flex gap-2">
                        <FiInfo className="w-[18px] h-[18px] shrink-0 text-[#ff9500]" />
                        <p>{event.custom_description}</p>
                      </div>
                    </div>
                  )}

                  {/* Katılımcılar */}
                  <div className="mt-4">
                    <h4 className="text-[13px] font-medium text-[#1d1d1f] dark:text-white flex items-center gap-1.5 mb-3">
                      <FiUsers className="w-4 h-4 text-[#ff9500]" />
                      {language === 'en' ? 'Participants' : 'Katılımcılar'}
                    </h4>

                    {event.participants.length === 0 ? (
                      <p className="text-[13px] text-[#6e6e73] dark:text-[#86868b] italic">
                        {language === 'en' ? 'No participants yet' : 'Henüz katılımcı yok'}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {event.participants.map((participant) => (
                          <div
                            key={participant.id}
                            className="p-3 bg-[#f5f5f7] dark:bg-[#1c1c1e]/40 rounded-lg"
                          >
                            <div className="flex flex-col">
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-full bg-[#ff9500]/10 flex items-center justify-center text-[#ff9500] text-xs font-medium">
                                      {participant.registrations.student_name.charAt(0)}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <p className="text-[13px] font-medium text-[#1d1d1f] dark:text-white">
                                          {participant.registrations.student_name}
                                          <span className="ml-1.5 text-[11px] text-[#6e6e73] dark:text-[#86868b] font-normal">
                                            ({participant.registrations.student_age})
                                          </span>
                                        </p>
                                      </div>
                                      <p className="text-[11px] text-[#6e6e73] dark:text-[#86868b]">
                                        {language === 'en' ? 'Parent: ' : 'Veli: '}{participant.registrations.parent_name}
                                      </p>
                                      {renderRemainingBadge(participant)}
                                    </div>
                                  </div>
                                </div>
                                {/* Statü Etiketi - Sağ Üst Köşeye Taşındı */}
                                <span className={`text-[10px] px-2 py-0.5 rounded-full flex items-center justify-center ${statusColors[participant.status] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'}`}>
                                  {statusLabels[participant.status]?.[language] || participant.status}
                                </span>
                              </div>

                              {/* Statü Butonları - Planlandı butonu kaldırıldı */}
                              <div className="grid grid-cols-2 sm:flex sm:flex-row items-center justify-center gap-2 mt-1 w-full">
                                <button
                                  onClick={() => updateLessonStatus(participant, 'attended')}
                                  disabled={updatingLessonIds.has(participant.id)}
                                  className={`flex-1 px-3 py-1 text-[11px] font-medium rounded-full border transition disabled:opacity-50 disabled:cursor-wait ${participant.status === 'attended'
                                      ? 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/50'
                                      : 'bg-white text-gray-700 border-gray-300 hover:bg-green-50 hover:text-green-700 hover:border-green-300 dark:bg-[#1c1c1e]/40 dark:text-gray-300 dark:border-gray-700'
                                    }`}
                                >
                                  {language === 'en' ? 'Joined' : 'Katıldı'}
                                </button>
                                <button
                                  onClick={() => updateLessonStatus(participant, 'no_show')}
                                  disabled={updatingLessonIds.has(participant.id)}
                                  className={`flex-1 px-3 py-1 text-[11px] font-medium rounded-full border transition disabled:opacity-50 disabled:cursor-wait ${participant.status === 'no_show'
                                      ? 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/50'
                                      : 'bg-white text-gray-700 border-gray-300 hover:bg-red-50 hover:text-red-700 hover:border-red-300 dark:bg-[#1c1c1e]/40 dark:text-gray-300 dark:border-gray-700'
                                    }`}
                                >
                                  {language === 'en' ? 'Absent' : 'Gelmedi'}
                                </button>
                                <button
                                  onClick={() => updateLessonStatus(participant, 'postponed')}
                                  disabled={updatingLessonIds.has(participant.id)}
                                  className={`flex-1 px-3 py-1 text-[11px] font-medium rounded-full border transition disabled:opacity-50 disabled:cursor-wait ${participant.status === 'postponed'
                                      ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/50'
                                      : 'bg-white text-gray-700 border-gray-300 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 dark:bg-[#1c1c1e]/40 dark:text-gray-300 dark:border-gray-700'
                                    }`}
                                >
                                  {language === 'en' ? 'Delayed' : 'Ertelendi'}
                                </button>
                                <button
                                  onClick={() => updateLessonStatus(participant, 'makeup')}
                                  disabled={updatingLessonIds.has(participant.id)}
                                  className={`flex-1 px-3 py-1 text-[11px] font-medium rounded-full border transition disabled:opacity-50 disabled:cursor-wait ${participant.status === 'makeup'
                                      ? 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800/50'
                                      : 'bg-white text-gray-700 border-gray-300 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300 dark:bg-[#1c1c1e]/40 dark:text-gray-300 dark:border-gray-700'
                                    }`}
                                >
                                  {language === 'en' ? 'Makeup' : 'Telafi'}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </Masonry>
        )}

        {/* Yoklaması işaretlenmemiş geçmiş dersler (yalnızca varsa görünür) */}
        <UnmarkedLessons
          language={language}
          refreshKey={unmarkedRefreshKey}
          onMarked={refreshUsageOf}
          onError={showToast}
        />

        {/* Dashboard Kartları */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
          {/* Bekleyen Ödemeler Bölümü */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#0071e3]/10 border border-[#0071e3]/20 flex items-center justify-center">
                  <FaLiraSign className="h-4 w-4 text-[#0071e3]" />
                </div>
                <h2 className="text-lg font-semibold text-[#1d1d1f] dark:text-white">
                  {language === 'en' ? 'Pending Payments' : 'Bekleyen Ödemeler'}
                </h2>
              </div>
              <button
                onClick={fetchPendingPayments}
                className="flex items-center gap-1.5 text-[#0071e3] hover:text-[#0077ED] text-sm font-medium"
              >
                <ArrowPathIcon className="h-4 w-4" />
                <span>{language === 'en' ? 'Refresh' : 'Yenile'}</span>
              </button>
            </div>

            {isLoadingPayments ? (
              // Loading State
              <div className="bg-white dark:bg-[#121621] rounded-xl border border-[#d2d2d7] dark:border-[#2a3241]">
                <div className="p-5 border-b border-[#d2d2d7] dark:border-[#2a3241]">
                  <div className="h-[18px] bg-[#f5f5f7] dark:bg-[#2a3241] rounded-md w-48 relative overflow-hidden">
                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent" />
                  </div>
                </div>

                {[...Array(3)].map((_, i) => (
                  <div key={i} className="p-5 flex items-center justify-between border-b border-[#d2d2d7] dark:border-[#2a3241] last:border-b-0">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#f5f5f7] dark:bg-[#2a3241] relative overflow-hidden">
                        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent" />
                      </div>
                      <div>
                        <div className="h-5 bg-[#f5f5f7] dark:bg-[#2a3241] rounded-md w-40 mb-1.5 relative overflow-hidden">
                          <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent" />
                        </div>
                        <div className="h-4 bg-[#f5f5f7] dark:bg-[#2a3241] rounded-md w-24 relative overflow-hidden">
                          <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent" />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-8 bg-[#f5f5f7] dark:bg-[#2a3241] rounded-full w-8 relative overflow-hidden">
                        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : loadFailed.payments ? (
              <LoadFailed language={language} onRetry={fetchPendingPayments} />
            ) : pendingPayments.length === 0 ? (
              // Boş State
              <div className="text-center py-12 bg-white dark:bg-[#121621] rounded-xl border border-[#d2d2d7] dark:border-[#2a3241]">
                <FaLiraSign className="w-12 h-12 mx-auto text-[#86868b] mb-4" />
                <h3 className="text-lg font-medium text-[#1d1d1f] dark:text-white mb-1">
                  {language === 'en' ? 'No pending payments' : 'Bekleyen ödeme bulunmuyor'}
                </h3>
                <p className="text-sm text-[#6e6e73] dark:text-[#86868b] max-w-md mx-auto">
                  {language === 'en' ? 'All registration payments seem to be completed.' : 'Tüm kayıtların ödemeleri tamamlanmış görünüyor.'}
                </p>
              </div>
            ) : (
              // Bekleyen Ödemeler Listesi
              <div className="bg-white dark:bg-[#121621] rounded-xl border border-[#d2d2d7] dark:border-[#2a3241] overflow-hidden">
                <div className="p-4 sm:px-6 border-b border-[#d2d2d7] dark:border-[#2a3241] bg-[#f5f5f7] dark:bg-[#1c1c1e]/40">
                  <h3 className="text-sm font-medium text-[#1d1d1f] dark:text-white">
                    {language === 'en' ? `Total ${pendingPayments.length} pending payment${pendingPayments.length !== 1 ? 's' : ''}` : `Toplam ${pendingPayments.length} bekleyen ödeme`}
                  </h3>
                </div>

                <div className="max-h-[350px] overflow-y-auto">
                  {pendingPayments.map((registration) => (
                    <div
                      key={registration.id}
                      className="p-4 sm:px-6 py-4 flex items-center justify-between border-b border-[#d2d2d7] dark:border-[#2a3241] last:border-b-0 hover:bg-[#f5f5f7] dark:hover:bg-[#1c1c1e]/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#ff9500]/10 flex items-center justify-center text-[#ff9500] text-sm font-medium">
                          {registration.student_name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-[15px] font-medium text-[#1d1d1f] dark:text-white flex items-center gap-2">
                            {registration.student_name}
                            <span className="text-[13px] text-[#6e6e73] dark:text-[#86868b] font-normal">
                              ({registration.student_age})
                            </span>
                          </p>
                          <p className="text-[13px] text-[#6e6e73] dark:text-[#86868b]">
                            {language === 'en' ? 'Parent: ' : 'Veli: '}{registration.parent_name}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {whatsAppLink(registration.parent_phone) && (
                          <a
                            href={whatsAppLink(registration.parent_phone, `Merhabalar ${registration.parent_name}. ${registration.student_name} için ödeme beklemekteyiz. Bilginize sunarız.`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-8 h-8 rounded-full bg-[#f5f5f7] dark:bg-[#2a3241] hover:bg-[#e5e5e5] dark:hover:bg-[#3a4251] flex items-center justify-center text-[#34c759] border border-[#d2d2d7] dark:border-[#2a3241] transition-colors"
                            title={language === 'en' ? 'Send Payment Reminder via WhatsApp' : 'WhatsApp\'tan Ödeme Hatırlatma Mesajı Gönder'}
                          >
                            <FaWhatsapp className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Paket Süresi Bitmeye Yaklaşanlar Bölümü */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#ac39ff]/10 border border-[#ac39ff]/20 flex items-center justify-center">
                  <FiPackage className="h-4 w-4 text-[#ac39ff]" />
                </div>
                <h2 className="text-lg font-semibold text-[#1d1d1f] dark:text-white">
                  {language === 'en' ? 'Packages Ended or Ending Soon' : 'Paket Süresi Biten / Bitmek Üzere'}
                </h2>
              </div>
              <button
                onClick={fetchExpiringSoonPackages}
                className="flex items-center gap-1.5 text-[#ac39ff] hover:text-[#b54aff] text-sm font-medium"
              >
                <ArrowPathIcon className="h-4 w-4" />
                <span>{language === 'en' ? 'Refresh' : 'Yenile'}</span>
              </button>
            </div>

            {isLoadingPackages ? (
              // Loading State
              <div className="bg-white dark:bg-[#121621] rounded-xl border border-[#d2d2d7] dark:border-[#2a3241]">
                <div className="p-5 border-b border-[#d2d2d7] dark:border-[#2a3241]">
                  <div className="h-[18px] bg-[#f5f5f7] dark:bg-[#2a3241] rounded-md w-48 relative overflow-hidden">
                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent" />
                  </div>
                </div>

                {[...Array(3)].map((_, i) => (
                  <div key={i} className="p-5 flex items-center justify-between border-b border-[#d2d2d7] dark:border-[#2a3241] last:border-b-0">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#f5f5f7] dark:bg-[#2a3241] relative overflow-hidden">
                        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent" />
                      </div>
                      <div>
                        <div className="h-5 bg-[#f5f5f7] dark:bg-[#2a3241] rounded-md w-40 mb-1.5 relative overflow-hidden">
                          <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent" />
                        </div>
                        <div className="h-4 bg-[#f5f5f7] dark:bg-[#2a3241] rounded-md w-24 relative overflow-hidden">
                          <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent" />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-8 bg-[#f5f5f7] dark:bg-[#2a3241] rounded-full w-8 relative overflow-hidden">
                        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : loadFailed.packages ? (
              <LoadFailed language={language} onRetry={fetchExpiringSoonPackages} />
            ) : expiringSoonPackages.length === 0 ? (
              // Boş State
              <div className="text-center py-12 bg-white dark:bg-[#121621] rounded-xl border border-[#d2d2d7] dark:border-[#2a3241]">
                <FiPackage className="w-12 h-12 mx-auto text-[#86868b] mb-4" />
                <h3 className="text-lg font-medium text-[#1d1d1f] dark:text-white mb-1">
                  {language === 'en' ? 'No packages ended or ending soon' : 'Süresi biten ya da bitmek üzere olan paket yok'}
                </h3>
                <p className="text-sm text-[#6e6e73] dark:text-[#86868b] max-w-md mx-auto">
                  {language === 'en'
                    ? 'Packages that have ended or will end within 7 days are listed here.'
                    : 'Süresi biten ya da 7 gün içinde bitecek paketler burada listelenir.'}
                </p>
              </div>
            ) : (
              // Yakında Bitecek Paketler Listesi
              <div className="bg-white dark:bg-[#121621] rounded-xl border border-[#d2d2d7] dark:border-[#2a3241] overflow-hidden">
                <div className="p-4 sm:px-6 border-b border-[#d2d2d7] dark:border-[#2a3241] bg-[#f5f5f7] dark:bg-[#1c1c1e]/40">
                  <h3 className="text-sm font-medium text-[#1d1d1f] dark:text-white">
                    {language === 'en'
                      ? `Total ${expiringSoonPackages.length} package${expiringSoonPackages.length !== 1 ? 's' : ''}`
                      : `Toplam ${expiringSoonPackages.length} paket`}
                  </h3>
                </div>

                <div className="max-h-[350px] overflow-y-auto">
                  {expiringSoonPackages.map((registration) => {
                    // Kalan gün sayısını hesapla (takvim günü; eksi değer = paket bitmiş)
                    const endDate = new Date(registration.package_end_date);
                    const diffDays = differenceInCalendarDays(endDate, new Date());
                    const expiryLink = whatsAppLink(
                      registration.parent_phone,
                      `Merhabalar ${registration.parent_name}. ${registration.student_name} adlı öğrencinizin paket süresi ${format(endDate, 'd MMMM yyyy', { locale: tr })} tarihinde ${diffDays < 0 ? 'sona ermiştir' : 'sona erecektir'}. Bilginize sunarız.`
                    );

                    // Aciliyet seviyesine göre renk belirle
                    let urgencyColor = "text-[#34c759]"; // Yeşil (daha çok zaman var)
                    if (diffDays <= 3) {
                      urgencyColor = "text-[#ff3b30]"; // Kırmızı (çok az zaman kaldı)
                    } else if (diffDays <= 7) {
                      urgencyColor = "text-[#ff9500]"; // Turuncu (az zaman kaldı)
                    }

                    return (
                      <div
                        key={registration.id}
                        className="p-4 sm:px-6 py-4 flex items-center justify-between border-b border-[#d2d2d7] dark:border-[#2a3241] last:border-b-0 hover:bg-[#f5f5f7] dark:hover:bg-[#1c1c1e]/40 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#ac39ff]/10 flex items-center justify-center text-[#ac39ff] text-sm font-medium">
                            {registration.student_name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-[15px] font-medium text-[#1d1d1f] dark:text-white flex items-center gap-2">
                              {registration.student_name}
                              <span className="text-[13px] text-[#6e6e73] dark:text-[#86868b] font-normal">
                                ({registration.student_age})
                              </span>
                            </p>
                            <div className="flex items-center gap-2">
                              <p className={`text-[13px] ${urgencyColor} font-medium`}>
                                {diffDays < 0
                                  ? (language === 'en' ? `Ended ${-diffDays} day${diffDays !== -1 ? 's' : ''} ago` : `${-diffDays} gün önce bitti`)
                                  : diffDays === 0
                                    ? (language === 'en' ? 'Ends today' : 'Bugün bitiyor')
                                    : (language === 'en' ? `${diffDays} day${diffDays !== 1 ? 's' : ''} left` : `${diffDays} gün kaldı`)}
                              </p>
                              <span className="text-[11px] text-[#6e6e73] dark:text-[#86868b]">
                                ({formatDate(endDate, 'd MMMM yyyy')})
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {expiryLink && (
                            <a
                              href={expiryLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-8 h-8 rounded-full bg-[#f5f5f7] dark:bg-[#2a3241] hover:bg-[#e5e5e5] dark:hover:bg-[#3a4251] flex items-center justify-center text-[#34c759] border border-[#d2d2d7] dark:border-[#2a3241] transition-colors"
                              title={language === 'en' ? 'Send Package Expiration Info via WhatsApp' : 'WhatsApp\'tan Paket Bitiş Bilgisi Gönder'}
                            >
                              <FaWhatsapp className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home; 