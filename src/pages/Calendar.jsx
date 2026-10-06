import React, { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import trLocale from '@fullcalendar/core/locales/tr';
import enLocale from '@fullcalendar/core/locales/en-gb';
import { PlusIcon, UserGroupIcon, ClockIcon, AcademicCapIcon, CalendarDaysIcon, ArrowTopRightOnSquareIcon, BookOpenIcon } from '@heroicons/react/24/outline';
import CreateEvent from '../components/CreateEvent';
import UpdateEventSheet from '../components/UpdateEventSheet';
import CopyWeekModal from '../components/CopyWeekModal';
import WeeklyThemesModal from '../components/WeeklyThemesModal';
import ExtendModal from '../components/ExtendModal';
import { supabase } from '../lib/supabase';
import { fetchLessonUsageMap } from '../lib/lessonUsage';
import { attendanceStatusLabel, holdsSeat, isAttendanceOverdue, isRecordedAttendance } from '../lib/attendance';
import { weeksBetween } from '../lib/dates';
import Toast from '../components/ui/Toast';
import '../styles/calendar.css';
import { addDays, format, startOfDay, startOfWeek } from 'date-fns';
import tr from 'date-fns/locale/tr';
import enUS from 'date-fns/locale/en-US';
import ActionNotification from '../components/ActionNotification';
import { useLanguage } from '../context/LanguageContext';

// Ön kontrol bu sürede yanıt vermezse beklenmez; kopyalama düğmesi kilitli kalmasın
const PRECHECK_TIMEOUT_MS = 15000;

// Kopyalama özetinde tek tek sayılan atlanmış ders sayısı
const SKIPPED_SLOTS_VISIBLE_LIMIT = 6;

// Kullanıcıya olduğu gibi gösterilecek (çevrilmiş) mesajı taşıyan hata. Veritabanı ve ağ
// hatalarının ham İngilizce metni ekrana yazılmaz; onlar için genel bir mesaj gösterilir.
const userError = (message) => Object.assign(new Error(message), { isUserMessage: true });

// Custom hook to monitor screen width
const useWindowSize = () => {
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  useEffect(() => {
    // Update state when screen size changes
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    // Add event listener
    window.addEventListener('resize', handleResize);

    // Remove event listener when component unmounts
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowSize;
};

const Calendar = () => {
  const { language } = useLanguage();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpdateSheetOpen, setIsUpdateSheetOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState({
    hour: '00',
    minute: '00'
  });
  const [events, setEvents] = useState([]);
  const [groupedEvents, setGroupedEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState({
    message: '',
    type: 'success',
    isVisible: false
  });
  const [currentWeekRange, setCurrentWeekRange] = useState(null);
  const calendarRef = useRef(null);

  // States for Copy Week Modal
  const [isCopyWeekModalOpen, setIsCopyWeekModalOpen] = useState(false);
  const [copyWeekLoading, setCopyWeekLoading] = useState(false);
  // Kopyalanacak hafta (Pazartesi 00:00); modal açılırken takvimde görünen haftadır
  const [copySourceWeekStart, setCopySourceWeekStart] = useState(null);
  // Aynı anda ikinci bir kopyalama başlamasın (modal kapatılıp yeniden açılsa bile)
  const copyWeekInFlightRef = useRef(false);
  // Başlıktaki kopyalama ikonu DOM'a bir kez eklenir; tıklama bu ref üzerinden güncel işleyiciye gider
  const copyWeekClickRef = useRef(null);

  // Hafta kopyalama ön kontrolü: kopyalanan haftadaki ders hakkı bitmiş ve arşivlenmiş öğrenciler
  const [precheckStudents, setPrecheckStudents] = useState([]);
  const [precheckArchived, setPrecheckArchived] = useState([]);
  const [precheckLoading, setPrecheckLoading] = useState(false);
  const [precheckFailed, setPrecheckFailed] = useState(false);
  const precheckRequestIdRef = useRef(0); // Geç gelen yanıtın günceli ezmemesi için
  const [extendTargetRegistration, setExtendTargetRegistration] = useState(null);
  const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);

  // Action notification state variables
  const [isActionNotificationVisible, setIsActionNotificationVisible] = useState(false);
  const [actionNotificationMessage, setActionNotificationMessage] = useState('');
  // Atlanan ders varsa özet kendiliğinden kapanmaz (kullanıcı okuyup kapatır)
  const [actionNotificationSticky, setActionNotificationSticky] = useState(false);
  const [targetWeekForNavigation, setTargetWeekForNavigation] = useState(null);

  // Haftalık konular (weekly themes) state'leri
  const [isThemesModalOpen, setIsThemesModalOpen] = useState(false);
  const [themesModalFocusWeek, setThemesModalFocusWeek] = useState(null);
  const [weekThemes, setWeekThemes] = useState({}); // { 'yyyy-MM-dd' (Pazartesi) -> konu }
  const [currentViewType, setCurrentViewType] = useState('timeGridWeek');
  const themesRequestIdRef = useRef(0); // Geç gelen yanıtın günceli ezmemesi için
  const eventsRequestIdRef = useRef(0); // Aynı koruma takvimdeki dersler için

  // Takvimin kapsayıcısı, pencere boyutu değişmeden daralıp genişleyebilir (kenar çubuğu,
  // sayfanın kaydırma çubuğu, geç yüklenen stil). FullCalendar yalnızca pencere boyutunu izlediği
  // için ızgara eski genişlikte kalır ve son gün sütunu kesilir. Genişlik değişince ölçüm yenilenir.
  const calendarWrapperRef = useRef(null);
  useEffect(() => {
    const wrapper = calendarWrapperRef.current;
    if (!wrapper || typeof ResizeObserver === 'undefined') return;

    let lastWidth = wrapper.clientWidth;
    let frame = null;
    const observer = new ResizeObserver(() => {
      const currentWidth = wrapper.clientWidth;
      if (currentWidth === lastWidth) return;

      lastWidth = currentWidth;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (calendarRef.current) calendarRef.current.getApi().updateSize();
      });
    });
    observer.observe(wrapper);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  // Get screen width
  const { width } = useWindowSize();

  // Helper function to format age group text
  const formatAgeGroup = (ageGroup) => {
    const value = ageGroup || '';

    // If screen width is less than 1700px or zoomed
    if (width < 1700) {
      // Yaş grupları veritabanında Türkçe tutulur ('16-24 Aylık', '3+ Yaş'); dar ekranda
      // dil ne olursa olsun yalnızca sayı kısmı gösterilir
      return value
        .replace('Aylık', '')
        .replace('Yaş', '')
        .trim();
    }

    // Normal view
    if (language !== 'tr') {
      return value
        .replace('Aylık', 'Months')
        .replace('Yaş', 'Years');
    }

    return value;
  };

  // Format date with the correct locale
  const formatDate = (date, formatStr) => {
    return format(new Date(date), formatStr || 'dd.MM.yyyy', { locale: language === 'tr' ? tr : enUS });
  };

  // Determine color and icon based on event type
  const getEventTypeDetails = (type) => {
    switch (type) {
      case 'ingilizce':
        return {
          color: '#8b5cf6', // Violet color (Tailwind violet-500)
          icon: '🇬🇧',
          label: language === 'tr' ? 'İngilizce' : 'English'
        };
      case 'duyusal':
        return {
          color: '#f97316', // Orange color (Tailwind orange-500)
          icon: '🎨',
          label: language === 'tr' ? 'Duyusal' : 'Sensory'
        };
      case 'ozel':
        return {
          color: '#059669',
          icon: '⭐',
          label: language === 'tr' ? 'Özel' : 'Special'
        };
      default:
        return {
          color: '#6b7280',
          icon: '📅',
          label: type
        };
    }
  };

  // Fetch events
  const fetchEvents = async (start, end) => {
    if (!start || !end) return;

    // Art arda gönderilen isteklerden yalnızca sonuncusunun yanıtı kullanılır: yavaş gelen
    // eski yanıt, ekranda görünen haftanın derslerini silmesin
    const requestId = ++eventsRequestIdRef.current;
    const isStale = () => requestId !== eventsRequestIdRef.current;

    try {
      setIsLoading(true);

      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*, event_participants(registration_id, status)')
        .eq('is_active', true)
        .gte('event_date', start.toISOString())
        .lt('event_date', end.toISOString())
        .order('event_date', { ascending: true });

      if (isStale()) return;
      if (eventsError) throw eventsError;

      // Get registered students (her kayıt bir kez sorulur: ay görünümünde aynı öğrenci
      // onlarca derste yer alır ve tekrarlı liste adres uzunluğu sınırına dayanıyordu)
      const registrationIds = [...new Set(
        eventsData
          .flatMap(event => event.event_participants)
          .map(participant => participant.registration_id)
      )];

      // registrationIds boş ise boşuna sorgu atma
      let studentMap = {};
      if (registrationIds.length > 0) {
        const { data: studentsData, error: studentsError } = await supabase
          .from('registrations')
          .select('id, student_name')
          .in('id', registrationIds);

        if (isStale()) return;
        if (studentsError) throw studentsError;

        // Match student names with IDs
        studentMap = Object.fromEntries(
          studentsData.map(student => [student.id, student.student_name])
        );
      }

      const now = new Date();
      const todayStart = startOfDay(now);

      // Convert events to FullCalendar format
      const formattedEvents = eventsData.map(event => {
        const typeDetails = getEventTypeDetails(event.event_type);
        const eventDate = new Date(event.event_date);
        const students = event.event_participants
          .map(participant => ({
            name: studentMap[participant.registration_id],
            status: participant.status,
            holdsSeat: holdsSeat(participant.status)
          }))
          .filter(student => student.name);

        // Geçmiş dersler ve yoklaması işlenmiş dersler sürüklenemez: yanlışlıkla kaydırılan
        // ders, işlenmiş yoklamayı başka bir güne taşırdı. Tarih düzenleme panelinden değiştirilebilir.
        const hasRecordedAttendance = event.event_participants.some(participant => isRecordedAttendance(participant.status));
        const isLocked = eventDate < todayStart || hasRecordedAttendance;

        return {
          id: event.id,
          title: event.event_type,
          start: event.event_date,
          end: new Date(eventDate.getTime() + 60 * 60 * 1000),
          backgroundColor: typeDetails.color,
          borderColor: typeDetails.color,
          ...(isLocked ? { editable: false } : {}),
          extendedProps: {
            ageGroup: event.age_group,
            description: event.custom_description,
            eventType: event.event_type,
            // Ana sayfa ve herkese açık takvimle aynı sayı: yalnızca derste yer tutan öğrenciler
            currentCapacity: students.filter(student => student.holdsSeat).length,
            typeDetails,
            students,
            // Günü geçmiş bir derste hâlâ "planlandı" duran öğrenci: yoklaması unutulmuş
            unmarkedCount: students.filter(student => isAttendanceOverdue(student.status, eventDate, now)).length
          }
        };
      });

      setEvents(formattedEvents);

      // Group events by day and type
      groupEventsByDayAndType(formattedEvents);
    } catch (error) {
      if (isStale()) return;

      console.error(language === 'tr' ? 'Etkinlikler getirilirken hata:' : 'Error fetching events:', error);
      showToast(
        language === 'tr'
          ? 'Takvim yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.'
          : 'The calendar could not be loaded. Check your connection and try again.',
        'error'
      );
    } finally {
      if (!isStale()) {
        setIsLoading(false);
      }
    }
  };

  // Görünen aralıktaki haftalık konuları getir (week_start bir date kolonu,
  // bu yüzden anahtarlar her zaman lokal 'yyyy-MM-dd' formatında — toISOString kullanılmaz)
  const fetchWeekThemes = async (start, end) => {
    try {
      if (!start || !end) return;

      const requestId = ++themesRequestIdRef.current;
      const from = format(startOfWeek(start, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const to = format(end, 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('weekly_themes')
        .select('week_start, theme')
        .gte('week_start', from)
        .lt('week_start', to);

      if (error) throw error;

      // Bu arada daha yeni bir istek başladıysa bu yanıtı yok say
      if (requestId !== themesRequestIdRef.current) return;

      const themeMap = {};
      (data || []).forEach(row => {
        themeMap[row.week_start] = row.theme;
      });
      setWeekThemes(themeMap);
    } catch (error) {
      // Konu sorgusu başarısız olsa da takvim çalışmaya devam etmeli
      console.error(language === 'tr' ? 'Haftalık konular getirilirken hata:' : 'Error fetching weekly themes:', error);
    }
  };

  // Group events by day and type
  const groupEventsByDayAndType = (events) => {
    // Group events by day and type
    const groupedByDayAndType = {};

    events.forEach(event => {
      const date = new Date(event.start);
      const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const eventType = event.extendedProps.eventType;

      if (!groupedByDayAndType[dateKey]) {
        groupedByDayAndType[dateKey] = {};
      }

      if (!groupedByDayAndType[dateKey][eventType]) {
        groupedByDayAndType[dateKey][eventType] = {
          count: 0,
          events: [],
          typeDetails: event.extendedProps.typeDetails,
          color: event.backgroundColor
        };
      }

      groupedByDayAndType[dateKey][eventType].count += 1;
      groupedByDayAndType[dateKey][eventType].events.push(event);
    });

    // Convert groups to FullCalendar format
    const groupedEvents = [];

    Object.keys(groupedByDayAndType).forEach(dateKey => {
      const [year, month, day] = dateKey.split('-').map(Number);

      Object.keys(groupedByDayAndType[dateKey]).forEach(eventType => {
        const group = groupedByDayAndType[dateKey][eventType];

        // Group all event types (even if count is 1)
        const date = new Date(year, month, day);

        groupedEvents.push({
          id: `group-${dateKey}-${eventType}`,
          title: `${group.count} ${group.typeDetails.label}`,
          start: date,
          backgroundColor: group.color,
          borderColor: group.color,
          display: 'block',
          extendedProps: {
            isGrouped: true,
            count: group.count,
            eventType,
            typeDetails: group.typeDetails,
            originalEvents: group.events
          }
        });
      });
    });

    setGroupedEvents(groupedEvents);
  };

  // Load events when component mounts and when new events are added
  // useEffect removed because datesSet in FullCalendar will handle initial fetch

  // Render event content
  const renderEventContent = (eventInfo) => {
    const { typeDetails, currentCapacity, ageGroup, students, description, isGrouped, count, unmarkedCount } = eventInfo.event.extendedProps;

    // Ay görünümünde ve gruplandırılmış etkinlik ise
    if (eventInfo.view.type === 'dayGridMonth' && isGrouped) {
      return (
        <div className="grouped-event-card w-full h-full flex items-center justify-center text-white font-medium">
          <span className="text-sm">{count} {typeDetails.label}</span>
        </div>
      );
    }

    // Normal etkinlik görünümü
    return (
      <div className="event-card w-full h-full flex flex-row text-white overflow-hidden">
        {/* Dikey Başlık - Sol Üstte */}
        <div className="event-title">
          {typeDetails.label}
        </div>

        {/* İçerik Alanı */}
        <div className="event-content">
          {/* Bilgiler */}
          <div className="flex flex-col gap-1.5 text-xs">
            {/* Saat */}
            <div className="flex items-center gap-1 bg-white/15 px-2.5 py-1 rounded-md shadow-sm w-fit">
              <ClockIcon className="w-3 h-3 text-white/70" />
              <span className="font-medium">
                {new Date(eventInfo.event.start).toLocaleTimeString(language === 'tr' ? 'tr-TR' : 'en-US', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>

            {/* Yaş Grubu */}
            <div className="flex items-center gap-1 bg-white/15 px-2.5 py-1 rounded-md shadow-sm w-fit">
              <AcademicCapIcon className="w-3 h-3 text-white/70" />
              <span className="font-medium">{formatAgeGroup(ageGroup)}</span>
            </div>

            {/* Kapasite */}
            <div className="flex items-center gap-1 bg-white/15 px-2.5 py-1 rounded-md shadow-sm w-fit">
              <UserGroupIcon className="w-3 h-3 text-white/70" />
              <span className="font-medium">{currentCapacity}/6</span>
              {/* Geçmiş derste yoklaması işaretlenmemiş öğrenci varsa küçük bir işaret */}
              {unmarkedCount > 0 && (
                <span
                  className="attendance-missing-dot"
                  title={language === 'tr'
                    ? `${unmarkedCount} öğrencinin yoklaması işaretlenmemiş`
                    : `Attendance not marked for ${unmarkedCount} student${unmarkedCount === 1 ? '' : 's'}`}
                ></span>
              )}
            </div>
          </div>

          {/* Açıklama (Özel etkinlik için) */}
          {description && (
            <div className="mt-1 text-xs italic opacity-90 line-clamp-1">
              {description}
            </div>
          )}

          {/* Öğrenci Listesi - Hover durumunda görünecek */}
          {students && students.length > 0 && (
            <div className="student-list mt-1 pt-1 border-t border-white/20 text-xs">
              <div className="student-list-items space-y-0.5 max-h-20 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/30">
                {students.map((student, index) => (
                  // Erteleyen / gelmeyen öğrenci listede kalır ama üstü çizili görünür
                  <div
                    key={index}
                    className={`flex items-center gap-1.5 ${student.holdsSeat ? '' : 'opacity-60'}`}
                    title={student.holdsSeat ? undefined : attendanceStatusLabel(student.status, language)}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-white/50 shrink-0"></div>
                    <span className={`truncate ${student.holdsSeat ? '' : 'line-through'}`}>{student.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Görünen aralığın tamamını yeniden yükler. activeStart/activeEnd kullanılır: ay görünümünde
  // komşu ayların gri günlerindeki dersler de ekranda olduğu için onlar da yenilenmeli.
  const refreshEvents = () => {
    if (!calendarRef.current) return Promise.resolve();

    const { activeStart, activeEnd } = calendarRef.current.getApi().view;
    return fetchEvents(activeStart, activeEnd);
  };

  // Tarih seçildiğinde
  const handleDateSelect = (selectInfo) => {
    // Seçilen tarih ve saati al
    const selectedDateTime = selectInfo.start; // yerel saatli Date (ay görünümünde yerel gece yarısı)
    const selectedHour = selectedDateTime.getHours().toString().padStart(2, '0');
    const selectedMinute = selectedDateTime.getMinutes().toString().padStart(2, '0');

    // Seçilen dakikayı en yakın 15'in katına yuvarla (00, 15, 30, 45)
    const roundedMinute = Math.round(selectedMinute / 15) * 15;
    const formattedMinute = (roundedMinute === 60 ? 0 : roundedMinute).toString().padStart(2, '0');

    setSelectedDate(selectInfo.start);

    // Ay görünümünde (dayGridMonth) ise dakika seçilmesin
    const isMonthView = selectInfo.view.type === 'dayGridMonth';

    // Seçilen saat bilgisini de sakla
    setSelectedTime({
      hour: isMonthView ? '' : selectedHour,
      minute: isMonthView ? '' : formattedMinute
    });

    setIsModalOpen(true);
  };

  // Modal'ı kapat
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedDate(null);
    setSelectedTime({
      hour: '00',
      minute: '00'
    });
  };

  // Toast gösterme fonksiyonu
  const showToast = (message, type = 'success') => {
    setToast({
      message,
      type,
      isVisible: true
    });
  };

  // Toast kapatma fonksiyonu
  const closeToast = () => {
    setToast(prev => ({
      ...prev,
      isVisible: false
    }));
  };

  // Etkinlik oluşturulduğunda
  const handleCreateEvent = async (formData) => {
    try {
      if (!formData || !formData.date) {
        throw userError(language === 'tr' ? 'Geçersiz form verisi' : 'Invalid form data');
      }

      // Tarih ve saat bilgisini birleştir
      const eventDateTime = new Date(formData.date);
      if (isNaN(eventDateTime.getTime())) {
        throw userError(language === 'tr' ? 'Geçersiz tarih formatı' : 'Invalid date format');
      }

      eventDateTime.setHours(parseInt(formData.time.hour, 10) || 0, parseInt(formData.time.minute, 10) || 0, 0, 0);

      // Aynı dakikada başka etkinlik var mı? Yalnızca o dakika sorgulanır (tüm tablo 1000 satır sınırına takılıyordu)
      const slotEnd = new Date(eventDateTime.getTime() + 60 * 1000);
      const { data: conflictingEvents, error: checkError } = await supabase
        .from('events')
        .select('id')
        .eq('is_active', true)
        .gte('event_date', eventDateTime.toISOString())
        .lt('event_date', slotEnd.toISOString())
        .limit(1);

      if (checkError) throw checkError;
      const conflictingEvent = conflictingEvents && conflictingEvents.length > 0;

      if (conflictingEvent) {
        throw userError(
          language === 'tr'
            ? 'Bu tarih ve saatte başka bir etkinlik zaten mevcut. Lütfen farklı bir saat seçin.'
            : 'There is already another event at this date and time. Please select a different time.'
        );
      }

      // Form verilerini kontrol et
      const eventData = {
        event_date: eventDateTime.toISOString(),
        age_group: formData.ageGroup || '',
        event_type: formData.eventType || '',
        custom_description: formData.eventType === 'ozel' ? formData.customDescription : null,
        max_capacity: 10,
        current_capacity: 0 // Başlangıçta 0 olmalı, trigger katılımcılar eklendiğinde bu değeri arttıracak
      };

      // Zorunlu alanları kontrol et
      if (!eventData.age_group || !eventData.event_type) {
        throw userError(language === 'tr' ? 'Zorunlu alanlar eksik' : 'Required fields are missing');
      }

      // Veritabanı bir derste en fazla max_capacity katılımcıya izin verir; ders oluşmadan önce kontrol et
      const selectedCount = Array.isArray(formData.students) ? formData.students.length : 0;
      if (selectedCount > eventData.max_capacity) {
        throw userError(language === 'tr'
          ? `Bir derse en fazla ${eventData.max_capacity} öğrenci eklenebilir (seçilen: ${selectedCount}).`
          : `A lesson can have at most ${eventData.max_capacity} students (selected: ${selectedCount}).`);
      }

      // Supabase'e etkinlik kaydetme işlemi
      const { data: eventResult, error: eventError } = await supabase
        .from('events')
        .insert([eventData])
        .select()
        .single();

      if (eventError) throw eventError;

      if (!eventResult) {
        throw userError(language === 'tr' ? 'Etkinlik oluşturma başarısız' : 'Event creation failed');
      }

      // Katılımcıları ekle
      if (Array.isArray(formData.students) && formData.students.length > 0) {
        const participantInserts = formData.students.map(student => ({
          event_id: eventResult.id,
          registration_id: student.value
        }));

        const { error: participantError } = await supabase
          .from('event_participants')
          .insert(participantInserts);

        if (participantError) {
          // Katılımcılar yazılamadıysa boş kalan dersi geri al (tekrar denemede çift ders oluşmasın)
          await supabase.from('events').delete().eq('id', eventResult.id);
          throw participantError;
        }
      }

      // Başarı mesajı göster
      showToast(
        language === 'tr' ? 'Etkinlik başarıyla oluşturuldu' : 'Event created successfully',
        'success'
      );

      // Etkinlikleri yeniden yükle - mevcut görünüm aralığında
      await refreshEvents();
      handleCloseModal();
    } catch (error) {
      console.error(language === 'tr' ? 'Etkinlik oluşturulurken hata:' : 'Error creating event:', error);
      showToast(
        error.isUserMessage
          ? error.message
          : (language === 'tr'
            ? 'Etkinlik oluşturulamadı. Bağlantınızı kontrol edip tekrar deneyin.'
            : 'The event could not be created. Check your connection and try again.'),
        'error'
      );
    }
  };

  // Etkinliğe tıklandığında
  const handleEventClick = (clickInfo) => {
    const event = clickInfo.event;

    // Gruplandırılmış etkinlik ise ve ay görünümündeyse, hafta görünümüne geç
    if (event.extendedProps.isGrouped && clickInfo.view.type === 'dayGridMonth') {
      const calendarApi = clickInfo.view.calendar;
      calendarApi.changeView('timeGridWeek', event.start);
      return;
    }

    // Gruplandırılmış değilse etkinlik düzenleme sheet'ini aç
    if (!event.extendedProps.isGrouped) {
      setSelectedEvent(event.id);
      setIsUpdateSheetOpen(true);
    }
  };

  // Etkinlik sürüklendiğinde
  const handleEventDrop = async (dropInfo) => {
    try {
      const event = dropInfo.event;
      // Saniyeler sıfırlanır: aynı dakikadaki ders kontrolü tam dakika üzerinden yapılır
      const newDate = new Date(event.start);
      newDate.setSeconds(0, 0);

      // Hedef dakikada başka ders varsa taşımayı geri al
      const dropSlotEnd = new Date(newDate.getTime() + 60 * 1000);
      const { data: clash, error: clashError } = await supabase
        .from('events')
        .select('id')
        .eq('is_active', true)
        .neq('id', event.id)
        .gte('event_date', newDate.toISOString())
        .lt('event_date', dropSlotEnd.toISOString())
        .limit(1);
      if (clashError) throw clashError;
      if (clash && clash.length > 0) {
        dropInfo.revert();
        showToast(language === 'tr' ? 'Bu tarih ve saatte başka bir etkinlik zaten mevcut.' : 'There is already another event at this date and time.', 'error');
        return;
      }

      // Update event in Supabase
      const { error } = await supabase
        .from('events')
        .update({ event_date: newDate.toISOString() })
        .eq('id', event.id);

      if (error) {
        dropInfo.revert();
        throw error;
      }

      // Show success message
      showToast(
        language === 'tr' ? 'Etkinlik başarıyla taşındı' : 'Event moved successfully',
        'success'
      );

      // Reload events - mevcut görünüm aralığında
      await refreshEvents();
    } catch (error) {
      console.error(
        language === 'tr' ? 'Etkinlik taşınırken hata:' : 'Error moving event:',
        error
      );
      showToast(
        language === 'tr' ? 'Etkinlik taşınırken bir hata oluştu' : 'An error occurred while moving the event',
        'error'
      );
      dropInfo.revert();
    }
  };

  // Kopyalanacak haftanın ön kontrolü: ders hakkı bitmiş ve arşivlenmiş öğrenciler.
  // Öğrenciler veritabanından okunur; ekrandaki takvim o an başka bir aralığı gösteriyor ya da
  // eski veriyi tutuyor olabilir. Kopyalamayı ASLA engellemez: hata ya da zaman aşımında
  // modalda bir uyarı satırı gösterilir.
  const fetchCopyWeekPrecheck = async (weekStart) => {
    if (!weekStart) return;

    const requestId = ++precheckRequestIdRef.current;
    const isStale = () => requestId !== precheckRequestIdRef.current;

    const loadPrecheck = async () => {
      const { data: weekEvents, error: eventsError } = await supabase
        .from('events')
        .select('id, event_participants(registration_id)')
        .eq('is_active', true)
        .gte('event_date', weekStart.toISOString())
        .lt('event_date', addDays(weekStart, 7).toISOString());

      if (eventsError) throw eventsError;

      const registrationIds = [...new Set(
        (weekEvents || [])
          .flatMap(event => event.event_participants || [])
          .map(participant => participant.registration_id)
      )];

      if (registrationIds.length === 0) return { exhausted: [], archived: [] };

      // Arşivlenmiş kayıtlar da okunur: yeni haftaya taşınmayacakları modalda belirtilir
      const { data: registrations, error: registrationsError } = await supabase
        .from('registrations')
        .select('*')
        .in('id', registrationIds);

      if (registrationsError) throw registrationsError;

      const activeRegistrations = (registrations || []).filter(registration => registration.is_active);
      const archived = (registrations || [])
        .filter(registration => !registration.is_active)
        .sort((a, b) => (a.student_name || '').localeCompare(b.student_name || '', 'tr'));

      const usageMap = await fetchLessonUsageMap(activeRegistrations);

      const exhausted = activeRegistrations
        // isFree kontrolü eşikten ÖNCE: ücretsizde remaining null ve null <= 0 true döner
        .filter(registration => {
          const usage = usageMap[registration.id];
          return usage && !usage.isFree && usage.remaining === 0;
        })
        .map(registration => ({ ...registration, usage: usageMap[registration.id] }))
        .sort((a, b) => new Date(a.package_end_date) - new Date(b.package_end_date));

      return { exhausted, archived };
    };

    let timeoutId;
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('precheck_timeout')), PRECHECK_TIMEOUT_MS);
    });

    try {
      setPrecheckLoading(true);
      setPrecheckFailed(false);

      const result = await Promise.race([loadPrecheck(), timeout]);

      // Bu arada daha yeni bir kontrol başladıysa ya da modal kapandıysa bu yanıt yok sayılır
      if (isStale()) return;

      setPrecheckStudents(result.exhausted);
      setPrecheckArchived(result.archived);
    } catch (error) {
      if (isStale()) return;

      console.error('Hafta kopyalama ön kontrolü yapılırken hata:', error);
      setPrecheckStudents([]);
      setPrecheckArchived([]);
      setPrecheckFailed(true);
    } finally {
      clearTimeout(timeoutId);
      if (!isStale()) {
        setPrecheckLoading(false);
      }
    }
  };

  // Ön kontrol listesinden uzatma modalını aç (Registration.jsx'teki guard'ların aynısı)
  const handleExtendFromPrecheck = (registration) => {
    if (registration.package_type === 'ucretsiz') {
      showToast(
        language === 'tr'
          ? 'Ücretsiz katılımlarda paket uzatma yapılmaz'
          : 'Package extension is not available for free participation',
        'error'
      );
      return;
    }
    if (registration.payment_status === 'beklemede') {
      showToast(
        language === 'tr'
          ? "Uzatma işlemi için ödeme durumu 'Beklemede' olamaz"
          : "Payment status cannot be 'Pending' for extension",
        'error'
      );
      return;
    }
    setExtendTargetRegistration(registration);
    setIsExtendModalOpen(true);
  };

  // Ön kontrol modal açılınca çalışır; modal kapanınca bekleyen yanıt yok sayılır ve liste temizlenir
  useEffect(() => {
    if (!isCopyWeekModalOpen || !copySourceWeekStart) return;

    fetchCopyWeekPrecheck(copySourceWeekStart);

    return () => {
      precheckRequestIdRef.current += 1;
      setPrecheckStudents([]);
      setPrecheckArchived([]);
      setPrecheckFailed(false);
      setPrecheckLoading(false);
    };
  }, [isCopyWeekModalOpen, copySourceWeekStart]);

  // "Bu Haftayı Kopyala": kaynak hafta, modal açılırken takvimde görünen haftadır
  const handleCopyWeekClick = () => {
    if (!calendarRef.current || copyWeekInFlightRef.current) return;

    const calendarApi = calendarRef.current.getApi();

    // Hafta görünümünde değilse önce hafta görünümüne geçilir: hangi haftanın kopyalanacağı
    // takvimde de görünsün
    if (calendarApi.view.type !== 'timeGridWeek') {
      calendarApi.changeView('timeGridWeek');
    }

    // getDate() takvimin "geçerli tarihi"dir; görünüm değişse de aynı kalır ve gösterilen
    // hafta her zaman onu içerir
    setCopySourceWeekStart(startOfWeek(calendarApi.getDate(), { weekStartsOn: 1 }));
    setIsCopyWeekModalOpen(true);
  };

  // İkonun tıklaması her render'da güncel işleyiciye bağlanır (ikon DOM'a bir kez ekleniyor)
  useEffect(() => {
    copyWeekClickRef.current = handleCopyWeekClick;
  });

  // Kopya modalını kapat. Kopyalama sürerken kapatılamaz: kapanıp yeniden açılan modal,
  // süren işlemin üstüne ikinci bir kopyalama başlatabiliyordu.
  const handleCloseCopyWeekModal = () => {
    if (copyWeekInFlightRef.current) return;
    setIsCopyWeekModalOpen(false);
  };

  // Kopyalama hatasını kullanıcının anlayacağı bir mesaja çevirir
  const getCopyWeekErrorMessage = (error) => {
    const text = String(error?.message || '');

    if (text.includes('invalid_target_week')) {
      return language === 'tr' ? 'Geçerli bir hedef hafta seçin' : 'Select a valid target week';
    }
    if (error?.code === '42501') {
      return language === 'tr' ? 'Bu işlem için yönetici yetkisi gerekir' : 'This action requires admin access';
    }
    return language === 'tr'
      ? 'Hafta kopyalanamadı, hiçbir ders eklenmedi. Bağlantınızı kontrol edip tekrar deneyin.'
      : 'The week could not be copied and nothing was added. Check your connection and try again.';
  };

  // Atlanan derslerin gün ve saatleri ("Sal 14:45, Çar 14:45 …")
  const formatSkippedSlots = (slots) => {
    const labels = (slots || [])
      .slice(0, SKIPPED_SLOTS_VISIBLE_LIMIT)
      .map(slot => formatDate(slot, 'EEE HH:mm'));
    const hiddenCount = (slots || []).length - labels.length;

    if (hiddenCount > 0) {
      labels.push(language === 'tr' ? `+${hiddenCount} ders daha` : `+${hiddenCount} more`);
    }
    return labels.join(', ');
  };

  // Haftayı kopyalar. Kopyalama veritabanında tek işlem olarak yapılır (copy_week fonksiyonu):
  // ya bütün dersler katılımcılarıyla birlikte oluşur ya da hiçbiri; yarım kalmış hafta oluşmaz.
  // Kopyalanan dersler, takvimde o an görünenler değil veritabanındaki güncel derslerdir.
  // excludedRegistrationIds: ön kontrol listesinden "Hariç Tut" denen öğrenciler.
  // Dersler yine kopyalanır, sadece bu öğrenciler katılımcı olarak eklenmez.
  const handleCopyWeek = async (targetWeekStart, excludedRegistrationIds = []) => {
    if (copyWeekInFlightRef.current) return;

    const weeks = weeksBetween(copySourceWeekStart, targetWeekStart);
    if (!copySourceWeekStart || !weeks) {
      showToast(getCopyWeekErrorMessage({ message: 'invalid_target_week' }), 'error');
      return;
    }

    copyWeekInFlightRef.current = true;
    setCopyWeekLoading(true);

    try {
      const { data: result, error } = await supabase.rpc('copy_week', {
        p_source_start: copySourceWeekStart.toISOString(),
        p_weeks: weeks,
        p_excluded: excludedRegistrationIds
      });

      if (error) throw error;

      const copied = result?.copied || 0;
      const skipped = result?.skipped || 0;
      const isTr = language === 'tr';

      setIsCopyWeekModalOpen(false);

      if (copied > 0) {
        showToast(
          isTr
            ? `${copied} etkinlik kopyalandı${skipped > 0 ? `, ${skipped} etkinlik atlandı` : ''}`
            : `${copied} event${copied === 1 ? '' : 's'} copied${skipped > 0 ? `, ${skipped} skipped` : ''}`,
          skipped > 0 ? 'warning' : 'success'
        );

        // Takvim kopyalanan haftaya kendiliğinden geçmez; kullanıcıya özet ve geçiş düğmesi gösterilir
        const targetEnd = addDays(targetWeekStart, 6);
        let summary = isTr
          ? `Etkinlikler ${formatDate(targetWeekStart, 'dd MMMM yyyy')} - ${formatDate(targetEnd, 'dd MMMM yyyy')} tarihlerine kopyalandı.`
          : `Events were copied to ${formatDate(targetWeekStart, 'dd MMMM yyyy')} - ${formatDate(targetEnd, 'dd MMMM yyyy')}.`;

        if (skipped > 0) {
          summary += isTr
            ? ` Hedef haftada aynı saatte etkinlik olduğu için ${skipped} etkinlik atlandı: ${formatSkippedSlots(result.skipped_slots)}.`
            : ` ${skipped} skipped because the target week already has an event at that time: ${formatSkippedSlots(result.skipped_slots)}.`;
        }

        setTargetWeekForNavigation(targetWeekStart);
        setActionNotificationMessage(summary);
        setActionNotificationSticky(skipped > 0);
        setIsActionNotificationVisible(true);
      } else if (skipped > 0) {
        showToast(
          isTr
            ? 'Hedef haftada bu saatlerin hepsinde zaten etkinlik var; yeni etkinlik eklenmedi'
            : 'The target week already has an event at each of these times; nothing was added',
          'warning'
        );
      } else {
        showToast(
          isTr ? 'Bu haftada kopyalanacak etkinlik bulunamadı' : 'There are no events to copy in this week',
          'error'
        );
      }

      // Etkinlikleri yeniden yükle - mevcut görünüm aralığında
      refreshEvents();
    } catch (error) {
      // Modal açık kalır: hiçbir şey yazılmadığı için kullanıcı aynı ekrandan tekrar deneyebilir
      console.error('Hafta kopyalanırken hata:', error);
      showToast(getCopyWeekErrorMessage(error), 'error');
    } finally {
      copyWeekInFlightRef.current = false;
      setCopyWeekLoading(false);
    }
  };

  // Hedef haftaya gitme işlemi
  const navigateToTargetWeek = () => {
    if (targetWeekForNavigation && calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.gotoDate(targetWeekForNavigation);
    }
  };

  // Takvim yüklendikten sonra başlığın yanına "Bu Haftayı Kopyala" ikonunu ekle
  useEffect(() => {
    const tooltipText = language === 'tr' ? 'Bu Haftayı Kopyala' : 'Copy This Week';

    const addCopyWeekButton = () => {
      if (!calendarRef.current) return;

      // Takvim başlığını içeren elementi bul
      const titleElement = document.querySelector('.fc-toolbar-title');
      if (!titleElement) return;

      // Eğer daha önce eklenmiş bir ikon varsa kaldır
      const existingIcon = document.getElementById('copy-week-icon');
      if (existingIcon) existingIcon.remove();

      // Yeni ikon oluştur
      const iconContainer = document.createElement('div');
      iconContainer.classList.add('relative', 'inline-flex', 'ml-2', 'items-center');
      iconContainer.id = 'copy-week-icon';

      // İkon elementi
      const iconElement = document.createElement('button');
      iconElement.type = 'button';
      iconElement.setAttribute('aria-label', tooltipText);
      iconElement.classList.add(
        'inline-flex', 'items-center', 'justify-center',
        'w-7', 'h-7', 'bg-white', 'dark:bg-[#121621]',
        'border', 'border-[#d2d2d7]', 'dark:border-[#2a3241]',
        'rounded-full', 'text-[#6e6e73]', 'dark:text-[#86868b]',
        'hover:text-[#1d1d1f]', 'dark:hover:text-white',
        'hover:border-[#0071e3]', 'dark:hover:border-[#0071e3]',
        'transition-all', 'duration-200', 'cursor-pointer',
        'group'
      );

      // SVG ikonu
      iconElement.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5A3.375 3.375 0 0 0 6.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0 0 15 2.25h-1.5a2.251 2.251 0 0 0-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 0 0-9-9Z" />
        </svg>
      `;

      // Tooltip ekle
      const tooltip = document.createElement('div');
      tooltip.classList.add(
        'absolute', 'bottom-full', 'left-1/2', 'transform', '-translate-x-1/2', 'mb-2',
        'px-2', 'py-1', 'bg-gray-800', 'dark:bg-gray-700', 'text-white', 'text-xs',
        'rounded', 'opacity-0', 'group-hover:opacity-100', 'transition-opacity',
        'duration-200', 'whitespace-nowrap', 'pointer-events-none', 'z-10'
      );
      tooltip.textContent = tooltipText;

      // İkon tıklama işlevi: ikon bir kez oluşturulduğu için işleyici ref üzerinden çağrılır
      // (doğrudan bağlansaydı ilk render'daki eski işleyici çalışırdı)
      iconElement.addEventListener('click', () => {
        if (copyWeekClickRef.current) copyWeekClickRef.current();
      });

      // Elementleri birleştir
      iconContainer.appendChild(iconElement);
      iconContainer.appendChild(tooltip);

      // Başlık elementinin yanına ekle
      titleElement.appendChild(iconContainer);
    };

    // İlk yüklemede ve dil değiştiğinde ikonu ekle
    addCopyWeekButton();

    // Pencere boyutu değiştiğinde ya da sekmeye dönüldüğünde ikon kaybolduysa tekrar ekle
    const handleViewChange = () => {
      setTimeout(addCopyWeekButton, 100);
    };

    window.addEventListener('resize', handleViewChange);
    document.addEventListener('visibilitychange', handleViewChange);

    // Temizleme
    return () => {
      window.removeEventListener('resize', handleViewChange);
      document.removeEventListener('visibilitychange', handleViewChange);
    };
  }, [language]);

  // Görünen haftanın konusu (banner sadece hafta ve gün görünümlerinde gösterilir)
  const activeWeekKey = currentWeekRange
    ? format(startOfWeek(new Date(currentWeekRange), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    : null;
  const activeWeekTheme = activeWeekKey ? weekThemes[activeWeekKey] : null;
  const showThemeBanner = (currentViewType === 'timeGridWeek' || currentViewType === 'timeGridDay') && activeWeekKey;

  return (
    <div className="min-h-screen text-[#1d1d1f] dark:text-[#f5f5f7]">
      {/* Header */}
      <div className="flex flex-wrap sm:flex-row items-start sm:items-center justify-between h-auto sm:h-16 px-6 border-b border-[#d2d2d7] dark:border-[#2a3241] py-4 sm:py-0 gap-4 sm:gap-0 bg-white dark:bg-[#1a1f2e] mb-6 rounded-t-xl">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-medium text-[#1d1d1f] dark:text-white">
            {language === 'tr' ? 'Takvim' : 'Calendar'}
          </h1>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
          <a
            href={`${import.meta.env.BASE_URL}#/takvim`}
            target="_blank"
            rel="noopener noreferrer"
            className="h-10 sm:h-8 px-3 bg-purple-100 dark:bg-purple-800/20 text-purple-700 dark:text-purple-300 text-sm font-medium rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800/30 focus:outline-none transition-all duration-200 flex items-center justify-center gap-1.5 w-full sm:w-auto transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <CalendarDaysIcon className="w-3.5 h-3.5" />
            <span>{language === 'tr' ? 'Herkese Açık Takvim' : 'Public Calendar'}</span>
            <ArrowTopRightOnSquareIcon className="w-3 h-3" />
          </a>
          <button
            onClick={() => {
              setThemesModalFocusWeek(null);
              setIsThemesModalOpen(true);
            }}
            className="h-10 sm:h-8 px-3 bg-pink-100 dark:bg-pink-800/20 text-pink-700 dark:text-pink-300 text-sm font-medium rounded-lg hover:bg-pink-200 dark:hover:bg-pink-800/30 focus:outline-none transition-all duration-200 flex items-center justify-center gap-1.5 w-full sm:w-auto transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <BookOpenIcon className="w-3.5 h-3.5" />
            <span>{language === 'tr' ? 'Haftalık Konular' : 'Weekly Themes'}</span>
          </button>
          <button
            onClick={() => {
              setSelectedTime({
                hour: '',
                minute: ''
              });
              setIsModalOpen(true);
            }}
            className="h-10 sm:h-8 px-4 bg-[#1d1d1f] dark:bg-[#0071e3] text-white text-sm font-medium rounded-lg hover:bg-black dark:hover:bg-[#0077ed] focus:outline-none transition-all duration-200 flex items-center justify-center gap-2 w-full sm:w-auto transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <PlusIcon className="w-4 h-4" />
            <span>{language === 'tr' ? 'Yeni Etkinlik' : 'New Event'}</span>
          </button>
        </div>
      </div>

      {/* overflow-hidden yok: gün adları satırının sayfa kaydırılırken üstte sabit kalabilmesi için */}
      <div ref={calendarWrapperRef} className="relative bg-white dark:bg-[#1a1f2e] rounded-xl">
        {/* Haftanın Konusu (hafta ve gün görünümleri) */}
        {showThemeBanner && (
          <div className="flex items-center justify-between gap-4 px-6 py-2.5 border-b border-[#d2d2d7] dark:border-[#2a3241]">
            <div className="flex items-center gap-2.5 min-w-0 text-sm">
              <span className="text-[#6e6e73] dark:text-[#86868b] shrink-0">
                {language === 'tr' ? 'Haftanın Konusu' : 'Weekly Theme'}
              </span>
              <span className="h-3.5 w-px bg-[#d2d2d7] dark:bg-[#2a3241] shrink-0"></span>
              {activeWeekTheme ? (
                <span className="text-base font-semibold text-[#1d1d1f] dark:text-white truncate">
                  {activeWeekTheme}
                </span>
              ) : (
                <span className="text-[#a1a1a6] dark:text-[#6e6e73]">
                  {language === 'tr' ? 'Belirlenmedi' : 'Not set'}
                </span>
              )}
            </div>
            <button
              onClick={() => {
                setThemesModalFocusWeek(activeWeekKey);
                setIsThemesModalOpen(true);
              }}
              className="h-7 px-3.5 rounded-full border border-[#d2d2d7] dark:border-[#2a3241] text-[13px] font-medium text-[#6e6e73] dark:text-[#86868b] hover:text-[#0071e3] dark:hover:text-[#0071e3] hover:border-[#0071e3] dark:hover:border-[#0071e3] hover:bg-[#0071e3]/[0.04] dark:hover:bg-[#0071e3]/10 active:scale-[0.96] transition-all duration-200 shrink-0"
            >
              {activeWeekTheme
                ? (language === 'tr' ? 'Düzenle' : 'Edit')
                : (language === 'tr' ? 'Konu Ekle' : 'Add Theme')}
            </button>
          </div>
        )}

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center rounded-xl bg-white/50 dark:bg-black/50 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
              <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                {language === 'tr' ? 'Yükleniyor...' : 'Loading...'}
              </span>
            </div>
          </div>
        )}

        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
          }}
          buttonText={{
            today: language === 'tr' ? 'Bugün' : 'Today',
            month: language === 'tr' ? 'Ay' : 'Month',
            week: language === 'tr' ? 'Hafta' : 'Week',
            day: language === 'tr' ? 'Gün' : 'Day'
          }}
          buttonClassNames="h-9 px-4 rounded-lg text-sm font-medium bg-white dark:bg-[#121621] text-[#1d1d1f] dark:text-white border border-[#d2d2d7] dark:border-[#2a3241] hover:border-[#0071e3] dark:hover:border-[#0071e3] transition-colors whitespace-nowrap"
          locale={language === 'tr' ? trLocale : enLocale}
          selectable={true}
          select={handleDateSelect}
          events={currentViewType === 'dayGridMonth' ? groupedEvents : events}
          eventClick={handleEventClick}
          eventContent={renderEventContent}
          editable={currentViewType !== 'dayGridMonth'} // Sürükle-bırak; ay görünümündeki günlük özetler taşınmaz
          eventDurationEditable={false} // Ders süresi takvimden değiştirilmez (boyutlandırma tutamacı çıkmasın)
          eventDrop={handleEventDrop} // Drag-and-drop handler
          dragScroll={true} // Auto-scroll during dragging
          snapDuration="00:15:00" // Place at 15-minute intervals
          eventDragStart={(info) => info.el.classList.add('event-dragging')} // Add class when dragging starts
          eventDragStop={(info) => info.el.classList.remove('event-dragging')} // Remove class when dragging ends
          droppable={true} // For external dragging (can be used in the future)
          dropAccept=".fc-event" // Accept only events
          height="auto"
          contentHeight="auto"
          aspectRatio={1.8}
          firstDay={1}
          slotMinTime="09:00:00"
          slotMaxTime="19:00:00"
          expandRows={true}
          stickyHeaderDates={true}
          dayMaxEvents={3}
          eventTimeFormat={{
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }}
          allDaySlot={false}
          slotDuration="00:30:00"
          slotLabelInterval="01:00"
          datesSet={(dateInfo) => {
            fetchEvents(dateInfo.start, dateInfo.end);
            setCurrentWeekRange(dateInfo.start); // Görünen aralığın başı (haftanın konusu bandı için)
            fetchWeekThemes(dateInfo.start, dateInfo.end);
            setCurrentViewType(dateInfo.view.type);
          }}
          eventClassNames="overflow-hidden rounded-lg shadow-sm hover:shadow-md transition-shadow"
        />
      </div>

      {/* Create Event Modal */}
      <CreateEvent
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={handleCreateEvent}
        selectedDate={selectedDate}
        selectedTime={selectedTime}
      />

      {/* Etkinlik Düzenleme Sheet */}
      <UpdateEventSheet
        isOpen={isUpdateSheetOpen}
        onClose={() => setIsUpdateSheetOpen(false)}
        onSuccess={(message, type = 'success') => {
          setToast({
            message,
            type,
            isVisible: true
          });
          refreshEvents();
        }}
        eventId={selectedEvent}
      />

      {/* Hafta Kopyalama Modal */}
      <CopyWeekModal
        isOpen={isCopyWeekModalOpen}
        onClose={handleCloseCopyWeekModal}
        onConfirm={handleCopyWeek}
        currentWeekStart={copySourceWeekStart}
        isCopying={copyWeekLoading}
        precheckStudents={precheckStudents}
        precheckArchived={precheckArchived}
        precheckLoading={precheckLoading}
        precheckFailed={precheckFailed}
        onRetryPrecheck={() => fetchCopyWeekPrecheck(copySourceWeekStart)}
        onExtendStudent={handleExtendFromPrecheck}
      />

      {/* Paket Uzatma Modal — CopyWeekModal'ın KARDEŞİ olarak monte edilir.
          İçine konulsaydı her tıklama CopyWeekModal'ın overlay'ine sızıp onu kapatırdı.
          z-50 (ExtendModal) > z-40 (CopyWeekModal) olduğu için üstte çıkar. */}
      <ExtendModal
        isOpen={isExtendModalOpen}
        onClose={() => setIsExtendModalOpen(false)}
        onSuccess={() => {
          // ExtendModal onClose'u onSuccess'ten ÖNCE çağırdığı için kaydı burada
          // null'lamıyoruz. Uzatma sonrası liste yenilenir (uzatılan öğrenci düşer).
          fetchCopyWeekPrecheck(copySourceWeekStart);
        }}
        registration={extendTargetRegistration}
      />

      {/* Haftalık Konular Modal */}
      <WeeklyThemesModal
        isOpen={isThemesModalOpen}
        onClose={() => setIsThemesModalOpen(false)}
        focusWeekStart={themesModalFocusWeek}
        onSaved={() => {
          if (calendarRef.current) {
            const calendarApi = calendarRef.current.getApi();
            fetchWeekThemes(calendarApi.view.activeStart, calendarApi.view.activeEnd);
          }
        }}
      />

      {/* Toast */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={closeToast}
      />

      {/* Action Notification */}
      <ActionNotification
        isVisible={isActionNotificationVisible}
        title={language === 'tr' ? 'Kopyalama Tamamlandı' : 'Copy Completed'}
        message={actionNotificationMessage}
        autoClose={!actionNotificationSticky}
        actionText={language === 'tr' ? "Kopyalanan Haftaya Git" : "Go to Copied Week"}
        onAction={navigateToTargetWeek}
        onClose={() => setIsActionNotificationVisible(false)}
      />
    </div>
  );
};

export default Calendar; 