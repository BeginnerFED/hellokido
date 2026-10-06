import React, { useState, useEffect, useRef } from 'react'
import { useLanguage } from '../context/LanguageContext'
import { supabase } from '../lib/supabase'
import { AGE_GROUPS } from '../lib/ageGroups'
import { matchesSearch } from '../lib/text'
import { ATTENDANCE_STATUS_OPTIONS, attendanceStatusLabel, isAttendanceOverdue, isRecordedAttendance } from '../lib/attendance'
import {
  XMarkIcon,
  CalendarDaysIcon,
  ClockIcon,
  UsersIcon,
  TagIcon,
  AcademicCapIcon,
  MagnifyingGlassIcon,
  DocumentDuplicateIcon,
  TrashIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import DatePicker, { registerLocale } from 'react-datepicker'
import { tr, enUS } from 'date-fns/locale'
import { addDays, startOfDay } from 'date-fns'
import 'react-datepicker/dist/react-datepicker.css'

// Tarih seçici lokalizasyonlarını kaydet
registerLocale('tr', tr)
registerLocale('en', enUS)

// Kullanıcıya olduğu gibi gösterilecek (çevrilmiş) mesajı taşıyan hata. Veritabanı ve ağ
// hatalarının ham İngilizce metni ekrana yazılmaz; onlar için genel bir mesaj gösterilir.
const userError = (message) => Object.assign(new Error(message), { isUserMessage: true })

// Yoklama durumu seçicisinin yazı rengi
const STATUS_TEXT_CLASSES = {
  scheduled: 'text-[#6e6e73] dark:text-[#86868b]',
  attended: 'text-green-700 dark:text-green-400',
  no_show: 'text-red-600 dark:text-red-400',
  postponed: 'text-amber-700 dark:text-amber-400',
  makeup: 'text-purple-700 dark:text-purple-400',
  cancelled: 'text-[#6e6e73] dark:text-[#86868b]'
}

// Kopyalama için önerilen tarih: dersin haftalık tekrarı olan, bugünden önce olmayan ilk gün.
// Dersin kendi tarihi önerilseydi "Kopyala"ya basmak aynı gün ve saate ikinci bir ders açmaya çalışırdı.
const getDefaultCopyDate = (eventDate) => {
  const today = startOfDay(new Date())
  let date = addDays(eventDate, 7)
  while (startOfDay(date) < today) {
    date = addDays(date, 7)
  }
  return date
}

const EMPTY_FORM = {
  date: new Date(),
  time: {
    hour: '',
    minute: ''
  },
  ageGroup: '',
  students: [],
  eventType: '',
  customDescription: ''
}

export default function UpdateEventSheet({ isOpen, onClose, onSuccess, eventId }) {
  const { language } = useLanguage()
  const t = (trText, enText) => (language === 'tr' ? trText : enText)

  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [students, setStudents] = useState([])
  const [eventData, setEventData] = useState(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [isCopyMode, setIsCopyMode] = useState(false)
  const [copyDate, setCopyDate] = useState(new Date())
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStudents, setSelectedStudents] = useState([])
  const [pinnedIds, setPinnedIds] = useState([]) // açılırken seçili olanlar listede üstte kalır
  const dropdownRef = useRef(null)
  // Panel açıldığında derste olan öğrenciler: { [registration_id]: { id, status, label } }
  const initialParticipantsRef = useRef({})
  const [loadError, setLoadError] = useState(false)
  // Panel açıldığında yoklaması işlenmiş (katıldı / gelmedi) öğrenci sayısı
  const [recordedAttendanceCount, setRecordedAttendanceCount] = useState(0)
  // Yoklaması işlenmiş bir öğrenci dersten çıkarılırken istenen onay (öğrenci adları)
  const [removalWarning, setRemovalWarning] = useState(null)

  // Saat ve dakika seçenekleri
  const hours = ['09', '10', '11', '12', '13', '14', '15', '16', '17', '18']
  const minutes = ['00', '15', '30', '45']

  // Dersin kayıtlı saati listede yoksa (eski kayıt) seçeneklere eklenir; aksi halde kutu
  // başka bir saati gösterirken arka planda eski saat kaydedilirdi
  const hourOptions = !formData.time.hour || hours.includes(formData.time.hour)
    ? hours
    : [formData.time.hour, ...hours].sort()
  const minuteOptions = !formData.time.minute || minutes.includes(formData.time.minute)
    ? minutes
    : [formData.time.minute, ...minutes].sort()

  // Seçili öğrenciler hem listede hem form verisinde tutulur
  const updateSelectedStudents = (nextStudents) => {
    setSelectedStudents(nextStudents)
    setFormData(prev => ({ ...prev, students: nextStudents }))
    setRemovalWarning(null)
  }

  // Etkinlik verilerini ve katılımcıları getir
  useEffect(() => {
    let cancelled = false; // geç gelen yanıt başka bir dersin formunu ezmesin
    const fetchEventData = async () => {
      if (!eventId || !isOpen) return;

      setIsLoading(true);
      setLoadError(false);
      try {
        // Etkinlik verilerini getir
        const { data: event, error: eventError } = await supabase
          .from('events')
          .select('*')
          .eq('id', eventId)
          .single();

        if (eventError) throw eventError;

        // Etkinliğe kayıtlı katılımcıları getir - ilişkisel sorgu yerine manuel işlem
        const { data: participants, error: participantsError } = await supabase
          .from('event_participants')
          .select('id, registration_id, status')
          .eq('event_id', eventId);

        if (participantsError) throw participantsError;

        // Kayıt bilgilerini çek (arşivlenmiş öğrenciler de gelir; derste oldukları sürece gösterilir)
        let registrations = [];
        if (participants && participants.length > 0) {
          const { data: registrationRows, error: registrationsError } = await supabase
            .from('registrations')
            .select('id, student_name, student_age, parent_name, is_active')
            .in('id', participants.map(p => p.registration_id));

          if (registrationsError) throw registrationsError;
          registrations = registrationRows || [];
        }

        if (cancelled) return;

        const registrationById = Object.fromEntries(registrations.map(reg => [reg.id, reg]));

        // Kayıtlı katılımcıları düzenle
        const eventStudents = (participants || [])
          .filter(participant => registrationById[participant.registration_id])
          .map(participant => {
            const reg = registrationById[participant.registration_id];
            return {
              value: reg.id,
              label: reg.student_name,
              parent: reg.parent_name,
              age: reg.student_age,
              status: participant.status,
              isArchived: reg.is_active === false,
              participantId: participant.id
            };
          })
          .sort((a, b) => (a.label || '').localeCompare(b.label || '', 'tr'));

        // Kaydederken fark bu listeye göre hesaplanır; listede gösterilmeyen satıra dokunulmaz
        initialParticipantsRef.current = Object.fromEntries(
          eventStudents.map(student => [
            student.value,
            { id: student.participantId, status: student.status, label: student.label }
          ])
        );

        // Etkinliğin tarih bilgilerini ayarla
        const eventDate = new Date(event.event_date);

        setEventData(event);
        setRecordedAttendanceCount(eventStudents.filter(student => isRecordedAttendance(student.status)).length);
        setCopyDate(getDefaultCopyDate(eventDate));

        // Form verilerini güncelle
        setFormData({
          date: eventDate,
          time: {
            hour: eventDate.getHours().toString().padStart(2, '0'),
            minute: eventDate.getMinutes().toString().padStart(2, '0')
          },
          ageGroup: event.age_group,
          eventType: event.event_type,
          customDescription: event.custom_description || '',
          students: eventStudents
        });

        setSelectedStudents(eventStudents);
      } catch (error) {
        console.error('Etkinlik verileri getirilirken hata:', error.message);
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchEventData();
    return () => { cancelled = true; };
  }, [eventId, isOpen]);

  // Tüm öğrencileri getir
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const { data, error } = await supabase
          .from('registrations')
          .select('id, student_name, student_age, parent_name')
          .eq('is_active', true)
          .order('student_name');

        if (error) throw error;

        const formattedStudents = data.map(student => ({
          value: student.id,
          label: student.student_name,
          parent: student.parent_name,
          age: student.student_age
        }));

        setStudents(formattedStudents);
      } catch (error) {
        console.error('Öğrenciler getirilirken hata:', error.message);
      }
    };

    if (isOpen) {
      fetchStudents();
    }
  }, [isOpen]);

  // Dropdown dışına tıklandığında kapanması için
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Öğrenci seçme/kaldırma işlemi
  const toggleStudent = (student) => {
    const isSelected = selectedStudents.some(s => s.value === student.value);
    if (isSelected) {
      updateSelectedStudents(selectedStudents.filter(s => s.value !== student.value));
      return;
    }

    // Çıkarılıp yeniden eklenen öğrenci, panel açıldığındaki durumuyla geri gelir
    const initial = initialParticipantsRef.current[student.value];
    updateSelectedStudents([
      ...selectedStudents,
      { ...student, status: initial?.status || 'scheduled', isArchived: Boolean(student.isArchived) }
    ]);
  };

  // Bir öğrencinin yoklama durumunu değiştir (Güncelle'ye basılınca kaydedilir)
  const changeStudentStatus = (registrationId, status) => {
    updateSelectedStudents(selectedStudents.map(student => (
      student.value === registrationId ? { ...student, status } : student
    )));
  };

  // Arama filtrelemesi ve sıralama
  const filteredStudents = students.filter(student =>
    matchesSearch(student.label, searchTerm) ||
    matchesSearch(student.parent, searchTerm)
  ).sort((a, b) => {
    // Liste açıldığında seçili olanlar üstte kalır. Sıra her tıklamada yeniden kurulmaz:
    // aksi halde liste her seçimde en başa kayıyordu.
    const aPinned = pinnedIds.includes(a.value);
    const bPinned = pinnedIds.includes(b.value);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return (a.label || '').localeCompare(b.label || '', 'tr');
  });

  // Custom Dropdown Component
  const CustomDropdown = () => (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => {
          if (!isDropdownOpen) setPinnedIds(selectedStudents.map(s => s.value));
          setIsDropdownOpen(!isDropdownOpen);
        }}
        className="relative w-full h-[45px] sm:h-[50px] pl-12 pr-4 flex items-center justify-between rounded-xl border border-[#d2d2d7] dark:border-[#2a3241] bg-white dark:bg-[#121621] text-[#1d1d1f] dark:text-white focus:ring-2 focus:ring-[#0071e3] focus:border-transparent transition-all text-sm sm:text-base cursor-pointer"
      >
        <span className="truncate">
          {selectedStudents.length > 0
            ? t(`${selectedStudents.length} öğrenci seçildi`, `${selectedStudents.length} student${selectedStudents.length === 1 ? '' : 's'} selected`)
            : t('Öğrenci seç...', 'Select students...')}
        </span>
        <svg className="shrink-0 size-3.5 text-gray-500 dark:text-gray-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m7 15 5 5 5-5"/>
          <path d="m7 9 5-5 5 5"/>
        </svg>
      </button>

      {isDropdownOpen && (
        <div className="absolute left-0 right-0 mt-2 z-50 w-full max-h-72 bg-white dark:bg-[#121621] border border-[#d2d2d7] dark:border-[#2a3241] rounded-xl shadow-lg overflow-hidden">
          {/* Search Input */}
          <div className="sticky top-0 p-2 bg-white dark:bg-[#121621] border-b border-[#d2d2d7] dark:border-[#2a3241]">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6e6e73] dark:text-[#86868b]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  // Arama kutusunda Enter formu göndermesin
                  if (e.key === 'Enter') e.preventDefault();
                }}
                onFocus={(e) => e.stopPropagation()}
                autoFocus
                placeholder={t('Ara...', 'Search...')}
                className="w-full h-9 pl-9 pr-4 rounded-lg border border-[#d2d2d7] dark:border-[#2a3241] bg-white dark:bg-[#121621] text-[#1d1d1f] dark:text-white focus:outline-none focus:border-[#0071e3] dark:focus:border-[#0071e3] transition-colors text-sm"
              />
            </div>
          </div>

          {/* Options List */}
          <div className="overflow-y-auto max-h-[calc(18rem-48px)] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-track]:bg-neutral-700 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500">
            {filteredStudents.length === 0 && (
              <div className="px-4 py-3 text-sm text-[#6e6e73] dark:text-[#86868b]">
                {t('Öğrenci bulunamadı', 'No students found')}
              </div>
            )}
            {filteredStudents.map((student) => {
              const isSelected = selectedStudents.some(s => s.value === student.value);
              return (
                <div
                  key={student.value}
                  onClick={() => toggleStudent(student)}
                  className={`
                    flex items-center justify-between px-4 py-2 cursor-pointer
                    ${isSelected
                      ? 'bg-gray-100 dark:bg-[#1d2535]'
                      : 'hover:bg-gray-50 dark:hover:bg-[#1d2535]/50'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    {/* Checkbox */}
                    <div className={`
                      w-5 h-5 rounded-full flex items-center justify-center border-2 transition-colors
                      ${isSelected
                        ? 'border-[#1d1d1f] bg-[#1d1d1f] dark:border-[#0071e3] dark:bg-[#0071e3]'
                        : 'border-[#d2d2d7] dark:border-[#2a3241]'
                      }
                    `}>
                      {isSelected && (
                        <svg className="w-2.5 h-2.5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="2 6 5 9 10 3"></polyline>
                        </svg>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-[#1d1d1f] dark:text-white">
                        {student.label}
                      </div>
                      <div className="text-xs text-[#6e6e73] dark:text-[#86868b]">
                        {student.parent}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-[#0071e3] dark:text-[#0071e3] ml-4">
                    {student.age}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  // Modal kapandığında formu sıfırla
  useEffect(() => {
    if (!isOpen) {
      setFormData(EMPTY_FORM);
      setSelectedStudents([]); // Seçili öğrencileri sıfırla
      setSearchTerm(''); // Arama terimini de sıfırla
      setIsDropdownOpen(false);
      setEventData(null);
      setIsCopyMode(false); // Kopyalama modunu sıfırla
      setIsLoading(false);
      setLoadError(false);
      setIsDeleteModalOpen(false);
      setRemovalWarning(null);
      setRecordedAttendanceCount(0);
      initialParticipantsRef.current = {};
    }
  }, [isOpen]);

  // Form değişikliklerini izle
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Form geçerliliğini kontrol et
  const isFormValid = () => {
    const { ageGroup, eventType, date, time } = formData;
    const requiredFields = [ageGroup, eventType, date, time.hour, time.minute];

    if (isCopyMode && !(copyDate instanceof Date && !Number.isNaN(copyDate.getTime()))) return false;
    return requiredFields.every(field => field && field !== '');
  };

  // Form gönderme
  // confirmedRemoval: yoklaması işlenmiş öğrencinin dersten çıkarılması onaylandı
  const handleSubmit = async (e, { confirmedRemoval = false } = {}) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!isFormValid() || isLoading || !eventData) return;

    setIsLoading(true);
    try {
      // Form verilerini hazırla
      const eventDateTime = new Date(isCopyMode ? copyDate : formData.date);
      eventDateTime.setHours(parseInt(formData.time.hour, 10) || 0, parseInt(formData.time.minute, 10) || 0, 0, 0);

      // Arşivlenmiş öğrenci yeni derse kopyalanmaz
      const formStudents = isCopyMode
        ? formData.students.filter(student => !student.isArchived)
        : formData.students;

      // Veritabanı bir derste en fazla max_capacity (10) katılımcıya izin verir; yazmaya başlamadan kontrol et
      const maxCapacity = eventData?.max_capacity ?? 10;
      if (formStudents.length > maxCapacity) {
        throw userError(t(
          `Bir derse en fazla ${maxCapacity} öğrenci eklenebilir (seçilen: ${formStudents.length}).`,
          `A lesson can have at most ${maxCapacity} students (selected: ${formStudents.length}).`
        ));
      }

      // Aynı dakikada başka etkinlik var mı? Yalnızca o dakika sorgulanır: tüm tabloyu çekmek
      // 1000 satır sınırına takılıyor ve güncel dersler kontrole hiç girmiyordu.
      // Düzenlemede kontrol yalnızca tarih ya da saat değiştiyse yapılır: saati değişmeyen
      // bir dersin öğrenci listesi, aynı saatte başka ders olsa da kaydedilebilmeli.
      const originalDateTime = new Date(eventData.event_date);
      originalDateTime.setSeconds(0, 0);
      const isTimeChanged = originalDateTime.getTime() !== eventDateTime.getTime();

      if (isCopyMode || isTimeChanged) {
        const slotEnd = new Date(eventDateTime.getTime() + 60 * 1000);
        let conflictQuery = supabase
          .from('events')
          .select('id')
          .eq('is_active', true)
          .gte('event_date', eventDateTime.toISOString())
          .lt('event_date', slotEnd.toISOString())
          .limit(1);
        // Kopyalamada kaynak dersin kendisi de çakışmadır (aynı gün ve saate kopya oluşmasın)
        if (!isCopyMode) conflictQuery = conflictQuery.neq('id', eventId);
        const { data: conflictingEvents, error: checkError } = await conflictQuery;
        if (checkError) throw checkError;

        if (conflictingEvents && conflictingEvents.length > 0) {
          throw userError(t(
            'Bu tarih ve saatte başka bir etkinlik zaten mevcut. Lütfen farklı bir saat seçin.',
            'There is already another event at this date and time. Please select a different time.'
          ));
        }
      }

      if (isCopyMode) {
        // Kopyalama modu - yeni etkinlik oluştur
        const newEventData = {
          event_date: eventDateTime.toISOString(),
          age_group: formData.ageGroup,
          event_type: formData.eventType,
          custom_description: formData.eventType === 'ozel' ? formData.customDescription : null,
          max_capacity: eventData.max_capacity,
          current_capacity: 0 // Başlangıçta katılımcı olmayacak, katılımcılar ayrıca eklenecek
        };

        // Yeni etkinlik oluştur
        const { data: newEvent, error: createError } = await supabase
          .from('events')
          .insert(newEventData)
          .select()
          .single();

        if (createError) throw createError;

        // Katılımcıları yeni etkinliğe ekle (yeni derste herkes "planlandı" olarak başlar)
        if (formStudents.length > 0) {
          const participantInserts = formStudents.map(student => ({
            event_id: newEvent.id,
            registration_id: student.value
          }));

          const { error: participantError } = await supabase
            .from('event_participants')
            .insert(participantInserts);

          if (participantError) {
            // Katılımcılar yazılamadıysa boş kalan kopya dersi geri al
            await supabase.from('events').delete().eq('id', newEvent.id);
            throw participantError;
          }
        }

        // Başarılı mesajı göster
        if (onSuccess) {
          onSuccess(t('Etkinlik başarıyla kopyalandı', 'Event copied successfully'));
        }
      } else {
        // ############ GÜNCELLEME MODU BAŞLANGICI ############

        // 1. Mevcut katılımcıları al
        const { data: currentParticipants, error: fetchCurrentError } = await supabase
          .from('event_participants')
          .select('id, registration_id, status')
          .eq('event_id', eventId);

        if (fetchCurrentError) throw fetchCurrentError;
        const currentByRegistration = Object.fromEntries(
          (currentParticipants || []).map(participant => [participant.registration_id, participant])
        );

        // 2. Yeni (formdaki) katılımcılar
        const formByRegistration = Object.fromEntries(formStudents.map(student => [student.value, student]));

        // 3. Farkları hesapla
        // Fark, panel AÇILDIĞINDA yüklenen listeye göre hesaplanır: yalnızca bu kullanıcının çıkardığı
        // silinir, yalnızca eklediği eklenir. Panel açıkken başka cihazdan eklenen öğrenci korunur.
        const initialParticipants = initialParticipantsRef.current;
        const participantsToDelete = Object.keys(initialParticipants)
          .filter(id => !formByRegistration[id] && currentByRegistration[id]);
        const participantsToAdd = Object.keys(formByRegistration)
          .filter(id => !initialParticipants[id] && !currentByRegistration[id]);

        if ((currentParticipants || []).length - participantsToDelete.length + participantsToAdd.length > maxCapacity) {
          throw userError(t(
            `Bir derse en fazla ${maxCapacity} öğrenci eklenebilir.`,
            `A lesson can have at most ${maxCapacity} students.`
          ));
        }

        // Yoklaması işlenmiş (katıldı / gelmedi) öğrenci dersten çıkarılırsa yoklama satırı silinir
        // ve kullanılan ders öğrenciye geri eklenmiş olur. Bunun için ayrıca onay istenir.
        if (!confirmedRemoval) {
          const recordedRemovals = participantsToDelete.filter(id => isRecordedAttendance(currentByRegistration[id].status));
          if (recordedRemovals.length > 0) {
            setRemovalWarning(recordedRemovals.map(id => initialParticipants[id].label || t('Öğrenci', 'Student')));
            return;
          }
        }

        // 4. Silinecek katılımcıları sil
        if (participantsToDelete.length > 0) {
          const { error: deleteError } = await supabase
            .from('event_participants')
            .delete()
            .eq('event_id', eventId)
            .in('registration_id', participantsToDelete);

          if (deleteError) {
            console.error("Katılımcılar silinirken hata:", deleteError);
            throw deleteError; // Hata durumunda işlemi durdur
          }
        }

        // 5. Eklenecek katılımcıları ekle (formda seçilen durumla)
        if (participantsToAdd.length > 0) {
          const inserts = participantsToAdd.map(regId => ({
            event_id: eventId,
            registration_id: regId,
            status: formByRegistration[regId].status || 'scheduled'
          }));

          const { error: insertError } = await supabase
            .from('event_participants')
            .insert(inserts);

          if (insertError) {
            console.error("Katılımcılar eklenirken hata:", insertError);
            throw insertError;
          }
        }

        // 6. Yoklama durumu bu panelde değiştirilen öğrencileri güncelle (yalnızca değişenler)
        const idsByNewStatus = {};
        Object.keys(formByRegistration).forEach(id => {
          const initial = initialParticipants[id];
          const current = currentByRegistration[id];
          const nextStatus = formByRegistration[id].status;
          if (!initial || !current || !nextStatus || nextStatus === initial.status) return;

          if (!idsByNewStatus[nextStatus]) idsByNewStatus[nextStatus] = [];
          idsByNewStatus[nextStatus].push(current.id);
        });

        for (const [status, participantIds] of Object.entries(idsByNewStatus)) {
          const { error: statusError } = await supabase
            .from('event_participants')
            .update({ status })
            .in('id', participantIds);

          if (statusError) throw statusError;
        }

        // 7. Ana etkinlik bilgilerini güncelle
        const updatedEventData = {
          event_date: eventDateTime.toISOString(),
          age_group: formData.ageGroup,
          event_type: formData.eventType,
          custom_description: formData.eventType === 'ozel' ? formData.customDescription : null,
          updated_at: new Date().toISOString()
          // Not: current_capacity trigger tarafından otomatik güncelleniyor
        };

        const { data: updatedRows, error: updateEventError } = await supabase
          .from('events')
          .update(updatedEventData)
          .eq('id', eventId)
          .select('id');

        if (updateEventError) throw updateEventError;
        if (!updatedRows || updatedRows.length === 0) {
          throw userError(t(
            'Etkinlik bulunamadı. Başka bir cihazdan silinmiş olabilir.',
            'The event was not found. It may have been deleted from another device.'
          ));
        }

        // Başarılı mesajı göster
        if (onSuccess) {
          onSuccess(t('Etkinlik başarıyla güncellendi', 'Event updated successfully'));
        }
        // ############ GÜNCELLEME MODU SONU ############
      }

      onClose();
    } catch (error) {
      console.error('Etkinlik işlemi sırasında hata:', error.message);
      if (onSuccess) {
        onSuccess(
          error.isUserMessage
            ? error.message
            : t(
              'İşlem tamamlanamadı. Bağlantınızı kontrol edip tekrar deneyin.',
              'The operation could not be completed. Check your connection and try again.'
            ),
          'error'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Etkinliği silme fonksiyonu
  const handleDeleteEvent = async () => {
    setIsDeleting(true);
    try {
      // Etkinliği sil
      const { error: deleteError } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId);

      if (deleteError) throw deleteError;

      // Başarılı mesajı göster
      if (onSuccess) {
        onSuccess(t('Etkinlik başarıyla silindi', 'Event deleted successfully'));
      }

      // Paneli kapat
      onClose();
    } catch (error) {
      console.error('Etkinlik silme işlemi sırasında hata:', error.message);
      if (onSuccess) {
        onSuccess(
          t(
            'Etkinlik silinemedi. Bağlantınızı kontrol edip tekrar deneyin.',
            'The event could not be deleted. Check your connection and try again.'
          ),
          'error'
        );
      }
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
    }
  };

  // Skeleton yükleme komponenti
  const SkeletonLoading = () => (
    <div className="space-y-6">
      {/* Tarih skeleton */}
      <div className="space-y-2">
        <div className="h-5 w-20 bg-gray-100 dark:bg-gray-800 border border-[#d2d2d7] dark:border-[#2a3241] rounded-xl animate-pulse"></div>
        <div className="h-12 w-full bg-gray-100 dark:bg-gray-800 border border-[#d2d2d7] dark:border-[#2a3241] rounded-xl animate-pulse"></div>
      </div>

      {/* Saat skeleton */}
      <div className="space-y-2">
        <div className="h-5 w-16 bg-gray-100 dark:bg-gray-800 border border-[#d2d2d7] dark:border-[#2a3241] rounded-xl animate-pulse"></div>
        <div className="flex gap-2">
          <div className="h-12 w-full bg-gray-100 dark:bg-gray-800 border border-[#d2d2d7] dark:border-[#2a3241] rounded-xl animate-pulse"></div>
          <div className="h-12 w-full bg-gray-100 dark:bg-gray-800 border border-[#d2d2d7] dark:border-[#2a3241] rounded-xl animate-pulse"></div>
        </div>
      </div>

      {/* Yaş grubu skeleton */}
      <div className="space-y-2">
        <div className="h-5 w-24 bg-gray-100 dark:bg-gray-800 border border-[#d2d2d7] dark:border-[#2a3241] rounded-xl animate-pulse"></div>
        <div className="h-12 w-full bg-gray-100 dark:bg-gray-800 border border-[#d2d2d7] dark:border-[#2a3241] rounded-xl animate-pulse"></div>
      </div>

      {/* Etkinlik türü skeleton */}
      <div className="space-y-2">
        <div className="h-5 w-28 bg-gray-100 dark:bg-gray-800 border border-[#d2d2d7] dark:border-[#2a3241] rounded-xl animate-pulse"></div>
        <div className="h-12 w-full bg-gray-100 dark:bg-gray-800 border border-[#d2d2d7] dark:border-[#2a3241] rounded-xl animate-pulse"></div>
      </div>

      {/* Öğrenci seçimi skeleton */}
      <div className="space-y-2">
        <div className="h-5 w-36 bg-gray-100 dark:bg-gray-800 border border-[#d2d2d7] dark:border-[#2a3241] rounded-xl animate-pulse"></div>
        <div className="h-12 w-full bg-gray-100 dark:bg-gray-800 border border-[#d2d2d7] dark:border-[#2a3241] rounded-xl animate-pulse"></div>
      </div>
    </div>
  );

  const selectClassName = 'w-full h-[45px] sm:h-[50px] pl-12 pr-4 rounded-xl border border-[#d2d2d7] dark:border-[#2a3241] bg-white dark:bg-[#121621] text-[#1d1d1f] dark:text-white focus:ring-2 focus:ring-[#0071e3] focus:border-transparent transition-all text-sm sm:text-base appearance-none cursor-pointer'
  const labelClassName = 'block text-sm font-medium text-[#424245] dark:text-[#86868b] mb-2'

  const selectArrow = (
    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
      </svg>
    </div>
  )

  // Günü geçmiş bir derste hâlâ "planlandı" duran öğrenci: yoklaması unutulmuş
  const unmarkedCount = eventData && !isCopyMode
    ? selectedStudents.filter(student => isAttendanceOverdue(student.status, eventData.event_date)).length
    : 0
  const archivedSelectedCount = selectedStudents.filter(student => student.isArchived).length
  const isBusy = isLoading || isDeleting

  // Render edilecek içerik
  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-25 z-40" onClick={() => { if (!isBusy) onClose() }}></div>
      )}

      {/* Silme Onay Modalı */}
      {isDeleteModalOpen && (
        <>
          <div className="fixed inset-0 bg-black bg-opacity-50 z-[60]" onClick={() => { if (!isDeleting) setIsDeleteModalOpen(false) }}></div>
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-md bg-white dark:bg-[#121621] p-6 rounded-2xl shadow-xl z-[70]">
            <div className="text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
                <TrashIcon className="h-7 w-7 text-red-600 dark:text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-[#1d1d1f] dark:text-white mb-2">{t('Etkinliği Sil', 'Delete Event')}</h3>
              <p className="text-[#6e6e73] dark:text-[#86868b]">
                {t(
                  'Bu etkinliği silmek istediğinizden emin misiniz? Bu işlem geri alınamaz ve bu etkinliğe kayıtlı tüm öğrenciler bu etkinlikten silinecektir.',
                  'Are you sure you want to delete this event? This cannot be undone and all students registered for this event will be removed from it.'
                )}
              </p>
              {/* Yoklaması işlenmiş ders silinirse kullanılan dersler öğrencilere geri eklenir */}
              {recordedAttendanceCount > 0 && (
                <p className="mt-3 p-3 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/30 text-sm text-yellow-800 dark:text-yellow-200 text-left">
                  {t(
                    `Bu derste ${recordedAttendanceCount} öğrencinin yoklaması işlenmiş. Ders silinirse bu yoklamalar da silinir ve kullanılan dersler öğrencilere geri eklenir.`,
                    `Attendance is recorded for ${recordedAttendanceCount} student${recordedAttendanceCount === 1 ? '' : 's'} in this lesson. Deleting it also deletes that attendance and gives the used lessons back.`
                  )}
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeleting}
                className="flex-1 py-3 px-4 text-[#1d1d1f] dark:text-white bg-transparent border border-[#d2d2d7] dark:border-[#2a3241] text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-[#1d2535]/70 focus:outline-none transition-all duration-200"
              >
                {t('İptal', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeleteEvent}
                disabled={isDeleting}
                className="flex-1 py-3 px-4 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 focus:outline-none transition-all duration-200 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>{t('Siliniyor...', 'Deleting...')}</span>
                  </>
                ) : (
                  <span>{t('Evet, Sil', 'Yes, Delete')}</span>
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Slide-in panel */}
      <div className={`fixed inset-y-0 right-0 w-full sm:w-[500px] bg-white dark:bg-[#121621] shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
        <div className="p-6 flex-1 overflow-auto relative">
          {/* Modal açıkken form üzerine overlay ekleyerek interaksiyonu engellemek için */}
          {isDeleteModalOpen && (
            <div className="absolute inset-0 bg-white/50 dark:bg-[#121621]/50 z-10" />
          )}

          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-[#1d1d1f] dark:text-white">
              {isCopyMode ? t('Etkinliği Kopyala', 'Copy Event') : t('Etkinliği Düzenle', 'Edit Event')}
            </h2>
            <button
              type="button"
              onClick={() => { if (!isBusy) onClose() }}
              aria-label={t('Kapat', 'Close')}
              className="text-[#6e6e73] hover:text-[#1d1d1f] dark:text-[#86868b] dark:hover:text-white transition-colors"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          {loadError ? (
            <div className="py-10 text-center text-sm text-red-600 dark:text-red-400">
              {t(
                'Etkinlik bilgileri yüklenemedi. Lütfen paneli kapatıp tekrar deneyin.',
                'The event could not be loaded. Please close the panel and try again.'
              )}
            </div>
          ) : !eventData ? (
            <SkeletonLoading />
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col h-auto">
              <div className="flex-1">
                {/* Normal form alanları */}
                {/* Tarih Seçimi */}
                <div className="mb-4">
                  <label className={labelClassName}>
                    {isCopyMode ? t('Orijinal Etkinlik Tarihi', 'Original Event Date') : t('Tarih', 'Date')}
                  </label>
                  <div className="relative">
                    <CalendarDaysIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6e6e73] dark:text-[#86868b] z-10 pointer-events-none" />
                    <DatePicker
                      selected={formData.date}
                      onChange={date => {
                        // Alan boşaltılırsa son geçerli tarih korunur
                        if (date) setFormData(prev => ({ ...prev, date }))
                      }}
                      dateFormat="d MMMM yyyy"
                      locale={language === 'tr' ? 'tr' : 'en'}
                      minDate={new Date()}
                      className={`w-full h-[45px] sm:h-[50px] pl-12 pr-4 rounded-xl border border-[#d2d2d7] dark:border-[#2a3241] bg-white dark:bg-[#121621] text-[#1d1d1f] dark:text-white focus:ring-2 focus:ring-[#0071e3] focus:border-transparent transition-all text-sm sm:text-base cursor-pointer ${isCopyMode ? 'opacity-70' : ''}`}
                      disabled={isCopyMode}
                    />
                  </div>
                  {isCopyMode && (
                    <p className="mt-1 text-xs text-[#6e6e73] dark:text-[#86868b]">
                      {t(
                        'Kopyalama modunda orijinal etkinlik tarihi değiştirilemez.',
                        'The original event date cannot be changed in copy mode.'
                      )}
                    </p>
                  )}
                </div>

                {/* Saat Seçimi */}
                <div className="mb-4">
                  <label className={labelClassName}>
                    {t('Saat', 'Time')}
                  </label>
                  <div className="relative flex items-center gap-2">
                    <div className="flex-1 relative">
                      <ClockIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6e6e73] dark:text-[#86868b] z-10 pointer-events-none" />
                      <select
                        name="hour"
                        value={formData.time.hour}
                        onChange={(e) => setFormData(prev => ({ ...prev, time: { ...prev.time, hour: e.target.value } }))}
                        className={selectClassName}
                      >
                        {hourOptions.map(hour => (
                          <option key={hour} value={hour}>{hour}</option>
                        ))}
                      </select>
                      {selectArrow}
                    </div>
                    <div className="flex-1 relative">
                      <select
                        name="minute"
                        value={formData.time.minute}
                        onChange={(e) => setFormData(prev => ({ ...prev, time: { ...prev.time, minute: e.target.value } }))}
                        className="w-full h-[45px] sm:h-[50px] px-4 rounded-xl border border-[#d2d2d7] dark:border-[#2a3241] bg-white dark:bg-[#121621] text-[#1d1d1f] dark:text-white focus:ring-2 focus:ring-[#0071e3] focus:border-transparent transition-all text-sm sm:text-base appearance-none cursor-pointer"
                      >
                        {minuteOptions.map(minute => (
                          <option key={minute} value={minute}>{minute}</option>
                        ))}
                      </select>
                      {selectArrow}
                    </div>
                  </div>
                </div>

                {/* Öğrenci Seçimi - MOVED BETWEEN SAAT AND YAŞ GRUBU */}
                <div className="mb-4">
                  <label className={labelClassName}>
                    {t('Katılımcı Öğrenciler', 'Participating Students')}
                  </label>
                  <div className="relative">
                    <UsersIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6e6e73] dark:text-[#86868b] z-10 pointer-events-none" />
                    {CustomDropdown()}
                  </div>

                  {/* Seçili öğrenciler: ad, yoklama durumu ve dersten çıkarma */}
                  {selectedStudents.length > 0 && (
                    <div className="mt-3 border border-[#d2d2d7] dark:border-[#2a3241] rounded-xl divide-y divide-[#d2d2d7] dark:divide-[#2a3241]">
                      {selectedStudents.map(student => (
                        <div key={student.value} className="flex items-center gap-2 pl-3 pr-1.5 py-1.5">
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            <span className={`truncate text-sm ${student.isArchived ? 'text-[#6e6e73] dark:text-[#86868b]' : 'text-[#1d1d1f] dark:text-white'}`}>
                              {student.label}
                            </span>
                            {student.isArchived && (
                              <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-[#1d2535] text-[10px] font-medium text-[#6e6e73] dark:text-[#86868b]">
                                {t('Arşiv', 'Archived')}
                              </span>
                            )}
                          </div>

                          {/* Kopyalanan derste herkes "planlandı" olarak başlar; durum yalnızca düzenlemede seçilir */}
                          {!isCopyMode && (
                            <select
                              value={student.status || 'scheduled'}
                              onChange={(e) => changeStudentStatus(student.value, e.target.value)}
                              aria-label={t(`${student.label} yoklama durumu`, `Attendance status of ${student.label}`)}
                              className={`shrink-0 h-8 pl-2 pr-1 rounded-lg border border-[#d2d2d7] dark:border-[#2a3241] bg-white dark:bg-[#121621] text-xs font-medium focus:ring-2 focus:ring-[#0071e3] focus:border-transparent transition-all cursor-pointer ${STATUS_TEXT_CLASSES[student.status] || STATUS_TEXT_CLASSES.scheduled}`}
                            >
                              {(ATTENDANCE_STATUS_OPTIONS.includes(student.status || 'scheduled')
                                ? ATTENDANCE_STATUS_OPTIONS
                                : [student.status, ...ATTENDANCE_STATUS_OPTIONS]
                              ).map(status => (
                                <option key={status} value={status} className="text-[#1d1d1f] dark:text-white">
                                  {attendanceStatusLabel(status, language)}
                                </option>
                              ))}
                            </select>
                          )}

                          <button
                            type="button"
                            onClick={() => toggleStudent(student)}
                            aria-label={t(`${student.label} dersten çıkar`, `Remove ${student.label} from the lesson`)}
                            title={t('Dersten çıkar', 'Remove from lesson')}
                            className="shrink-0 p-1.5 rounded-lg text-[#6e6e73] dark:text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#1d2535] transition-colors"
                          >
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {unmarkedCount > 0 && (
                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                      {t(
                        `${unmarkedCount} öğrencinin yoklaması işaretlenmemiş. Durumu yanındaki kutudan seçip Güncelle'ye basın.`,
                        `Attendance is not marked for ${unmarkedCount} student${unmarkedCount === 1 ? '' : 's'}. Pick the status next to the name and press Update.`
                      )}
                    </p>
                  )}

                  {isCopyMode && archivedSelectedCount > 0 && (
                    <p className="mt-2 text-xs text-[#6e6e73] dark:text-[#86868b]">
                      {t(
                        'Arşivlenmiş öğrenciler kopyalanan derse eklenmez.',
                        'Archived students are not added to the copied lesson.'
                      )}
                    </p>
                  )}
                </div>

                {/* Yaş Grubu */}
                <div className="mb-4">
                  <label className={labelClassName}>
                    {t('Yaş Grubu', 'Age Group')}
                  </label>
                  <div className="relative">
                    <AcademicCapIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6e6e73] dark:text-[#86868b] z-10 pointer-events-none" />
                    <select
                      name="ageGroup"
                      value={formData.ageGroup}
                      onChange={handleInputChange}
                      className={selectClassName}
                    >
                      {AGE_GROUPS.map(group => (
                        <option key={group} value={group}>{group}</option>
                      ))}
                    </select>
                    {selectArrow}
                  </div>
                </div>

                {/* Etkinlik Türü */}
                <div className="mb-4">
                  <label className={labelClassName}>
                    {t('Etkinlik Türü', 'Event Type')}
                  </label>
                  <div className="relative">
                    <TagIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6e6e73] dark:text-[#86868b] z-10 pointer-events-none" />
                    <select
                      name="eventType"
                      value={formData.eventType}
                      onChange={handleInputChange}
                      className={selectClassName}
                    >
                      <option value="ingilizce">{t('İngilizce', 'English')}</option>
                      <option value="duyusal">{t('Duyusal', 'Sensory')}</option>
                      <option value="ozel">{t('Özel', 'Special')}</option>
                    </select>
                    {selectArrow}
                  </div>
                </div>

                {/* Özel etkinlik seçildiğinde açıklama alanı - UPDATED CURSOR TO TEXT */}
                {formData.eventType === 'ozel' && (
                  <div className="mb-4">
                    <label className={labelClassName}>
                      {t('Özel Etkinlik Açıklaması', 'Special Event Description')}
                    </label>
                    <textarea
                      name="customDescription"
                      value={formData.customDescription}
                      onChange={handleInputChange}
                      className="w-full h-16 px-4 py-3 rounded-xl border border-[#d2d2d7] dark:border-[#2a3241] bg-white dark:bg-[#121621] text-[#1d1d1f] dark:text-white focus:ring-2 focus:ring-[#0071e3] focus:border-transparent transition-all text-sm sm:text-base cursor-text resize-none"
                      placeholder={t('Özel etkinlik için açıklama girin...', 'Enter a description for the special event...')}
                    />
                  </div>
                )}

                {/* Kopyalama Modu Toggle */}
                <div className="mb-2 mt-6 p-4 border border-[#d2d2d7] dark:border-[#2a3241] rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DocumentDuplicateIcon className="w-5 h-5 text-[#6e6e73] dark:text-[#86868b]" />
                      <span className="text-sm font-medium text-[#424245] dark:text-[#86868b]">
                        {t('Bu Etkinliği Kopyala', 'Copy This Event')}
                      </span>
                    </div>
                    <label className="inline-flex relative items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={isCopyMode}
                        onChange={() => {
                          setIsCopyMode(!isCopyMode)
                          setRemovalWarning(null)
                        }}
                      />
                      <div className={`
                        w-11 h-6 bg-gray-200 rounded-full peer
                        dark:bg-gray-700 peer-checked:after:translate-x-full
                        after:content-[''] after:absolute after:top-0.5 after:left-[2px]
                        after:bg-white after:rounded-full after:h-5 after:w-5
                        after:transition-all peer-checked:bg-[#1d1d1f] dark:peer-checked:bg-[#0071e3]
                      `}></div>
                    </label>
                  </div>
                </div>

                {/* Kopyalama için Tarih Seçimi - MOVED HERE */}
                {isCopyMode && (
                  <div className="mt-4 mb-2">
                    <label className={labelClassName}>
                      {t('Kopyalanacak Tarih', 'Copy To Date')}
                    </label>
                    <div className="relative">
                      <CalendarDaysIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6e6e73] dark:text-[#86868b] z-10 pointer-events-none" />
                      <DatePicker
                        selected={copyDate}
                        onChange={date => setCopyDate(date)}
                        dateFormat="d MMMM yyyy"
                        locale={language === 'tr' ? 'tr' : 'en'}
                        minDate={new Date()}
                        className="w-full h-[45px] sm:h-[50px] pl-12 pr-4 rounded-xl border border-[#d2d2d7] dark:border-[#2a3241] bg-white dark:bg-[#121621] text-[#1d1d1f] dark:text-white focus:ring-2 focus:ring-[#0071e3] focus:border-transparent transition-all text-sm sm:text-base cursor-pointer"
                      />
                    </div>
                    <p className="mt-2 text-xs text-[#6e6e73] dark:text-[#86868b]">
                      {t(
                        'Etkinlik, aynı bilgiler ve katılımcılarla bu tarihe kopyalanacaktır.',
                        'The event will be copied to this date with the same details and participants.'
                      )}
                    </p>
                  </div>
                )}

              </div>
            </form>
          )}
        </div>

        {/* Sabit altlık butonlar */}
        <div className="p-4 border-t border-[#d2d2d7] dark:border-[#2a3241] mt-auto">
          {/* Yoklaması işlenmiş öğrenci dersten çıkarılırken onay */}
          {removalWarning && (
            <div className="mb-3 p-3 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/30">
              <div className="flex items-start gap-2">
                <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-500 mt-0.5 shrink-0" />
                <div className="text-xs text-yellow-800 dark:text-yellow-200">
                  <span className="font-semibold">{removalWarning.join(', ')}</span>
                  {t(
                    ' için bu derste yoklama işlenmiş. Dersten çıkarırsanız yoklama silinir ve kullanılan ders öğrenciye geri eklenir.',
                    ': attendance is recorded for this lesson. Removing them deletes that attendance and gives the used lesson back.'
                  )}
                </div>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRemovalWarning(null)}
                  disabled={isLoading}
                  className="h-9 px-3 text-xs font-medium text-[#1d1d1f] dark:text-white border border-[#d2d2d7] dark:border-[#2a3241] rounded-lg hover:bg-white/60 dark:hover:bg-[#1d2535]/70 transition-colors"
                >
                  {t('Vazgeç', 'Cancel')}
                </button>
                <button
                  type="button"
                  onClick={(e) => handleSubmit(e, { confirmedRemoval: true })}
                  disabled={isLoading}
                  className="h-9 px-3 text-xs font-medium text-white bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors"
                >
                  {t('Yine de Çıkar', 'Remove Anyway')}
                </button>
              </div>
            </div>
          )}

          <div className="flex w-full gap-3">
            {/* Silme Butonu - Sadece kopyalama modunda değilse göster */}
            {!isCopyMode && (
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(true)}
                  disabled={isBusy || !eventData}
                  className="w-12 h-12 flex items-center justify-center text-red-500 dark:text-red-400 bg-transparent border border-[#d2d2d7] dark:border-[#2a3241] rounded-lg hover:bg-gray-50 dark:hover:bg-[#1d2535]/70 focus:outline-none transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={t('Etkinliği sil', 'Delete event')}
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 dark:bg-gray-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
                  {t('Etkinliği Sil', 'Delete Event')}
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading || isDeleteModalOpen}
              className={`flex-1 h-12 px-4 text-[#1d1d1f] dark:text-white bg-transparent border border-[#d2d2d7] dark:border-[#2a3241] text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-[#1d2535]/70 focus:outline-none transition-all duration-200 ${(isLoading || isDeleteModalOpen) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {t('İptal', 'Cancel')}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading || !eventData || !isFormValid() || isDeleteModalOpen || Boolean(removalWarning)}
              className={`flex-1 h-12 px-4 bg-[#1d1d1f] dark:bg-[#0071e3] text-white text-sm font-medium rounded-lg focus:outline-none transition-all duration-200 flex items-center justify-center gap-2 ${isLoading ? 'opacity-60 bg-gray-600 dark:bg-[#0071e3]/70 cursor-not-allowed' : eventData && isFormValid() && !isDeleteModalOpen && !removalWarning ? 'hover:bg-black dark:hover:bg-[#0077ed]' : 'opacity-50 cursor-not-allowed'}`}
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>{isCopyMode ? t('Kopyalanıyor...', 'Copying...') : t('Güncelleniyor...', 'Updating...')}</span>
                </>
              ) : (
                isCopyMode ? t('Kopyala', 'Copy') : t('Güncelle', 'Update')
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
