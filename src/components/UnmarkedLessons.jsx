import React, { useEffect, useRef, useState } from 'react';
import { addDays, format, startOfDay } from 'date-fns';
import { tr, enUS } from 'date-fns/locale';
import { ChevronDownIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { supabase } from '../lib/supabase';

// Geriye dönük kaç günün dersleri listelenir
const WINDOW_DAYS = 30;

const EVENT_TYPE_LABELS = {
  ingilizce: { tr: 'İngilizce', en: 'English' },
  duyusal: { tr: 'Duyusal', en: 'Sensory' },
  ozel: { tr: 'Özel', en: 'Special' }
};

// Yoklama düğmeleri (bugünkü dersler kartındaki düğmelerle aynı sıra ve renkler)
const STATUS_BUTTONS = [
  { status: 'attended', tr: 'Katıldı', en: 'Joined', hover: 'hover:bg-green-50 hover:text-green-700 hover:border-green-300' },
  { status: 'no_show', tr: 'Gelmedi', en: 'Absent', hover: 'hover:bg-red-50 hover:text-red-700 hover:border-red-300' },
  { status: 'postponed', tr: 'Ertelendi', en: 'Delayed', hover: 'hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300' },
  { status: 'makeup', tr: 'Telafi', en: 'Makeup', hover: 'hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300' }
];

// Günü geçtiği halde yoklaması işaretlenmemiş (hâlâ "planlandı" duran) katılımlar.
// Yoklama yalnızca dersin günü ana sayfadan işaretlenebildiği için unutulan gün sessizce
// kalıyor, öğrencinin kalan dersi olduğundan fazla görünüyordu. İşaretlenmemiş kayıt yoksa
// bu bölüm hiç görünmez.
// onMarked(registration): bir yoklama kaydedildiğinde, kalan ders rozetleri yenilensin diye çağrılır.
// onError(message): kayıt başarısız olursa gösterilecek mesaj.
export default function UnmarkedLessons({ language, refreshKey = 0, onMarked, onError }) {
  const [rows, setRows] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [updatingIds, setUpdatingIds] = useState(() => new Set());
  const inFlightRef = useRef(new Set());
  const requestRef = useRef(0);
  const isTr = language !== 'en';

  useEffect(() => {
    const requestId = ++requestRef.current;

    const load = async () => {
      try {
        const todayStart = startOfDay(new Date());

        const { data: participants, error: participantsError } = await supabase
          .from('event_participants')
          .select('id, status, registration_id, events!inner(id, event_date, event_type, age_group, custom_description, is_active)')
          .eq('status', 'scheduled')
          .eq('events.is_active', true)
          .gte('events.event_date', addDays(todayStart, -WINDOW_DAYS).toISOString())
          .lt('events.event_date', todayStart.toISOString());

        if (participantsError) throw participantsError;

        const registrationIds = [...new Set((participants || []).map(participant => participant.registration_id))];
        let registrations = [];
        if (registrationIds.length > 0) {
          const { data, error: registrationsError } = await supabase
            .from('registrations')
            .select('id, student_name, parent_name, is_active, package_type, package_start_date')
            .in('id', registrationIds);

          if (registrationsError) throw registrationsError;
          registrations = data || [];
        }

        if (requestId !== requestRef.current) return;

        const registrationById = new Map(registrations.map(registration => [registration.id, registration]));
        setRows(
          (participants || [])
            .map(participant => ({ ...participant, registration: registrationById.get(participant.registration_id) }))
            .filter(participant => participant.registration)
            // En yeni ders üstte; aynı dersin öğrencileri ada göre
            .sort((a, b) => (
              new Date(b.events.event_date) - new Date(a.events.event_date) ||
              (a.registration.student_name || '').localeCompare(b.registration.student_name || '', 'tr')
            ))
        );
      } catch (error) {
        // Bu bölüm yardımcıdır: yüklenemezse sayfanın geri kalanı etkilenmez, bölüm görünmez
        if (requestId !== requestRef.current) return;
        console.error('İşaretlenmemiş dersler getirilirken hata oluştu:', error);
        setRows([]);
      }
    };

    load();
  }, [refreshKey]);

  const markStatus = async (row, status) => {
    if (inFlightRef.current.has(row.id)) return;

    inFlightRef.current.add(row.id);
    setUpdatingIds(new Set(inFlightRef.current));

    try {
      const { data, error } = await supabase
        .from('event_participants')
        .update({ status })
        .eq('id', row.id)
        .select('id');

      if (error) throw error;
      // Hata dönmeden hiçbir satır değişmediyse kayıt yapılmamıştır (öğrenci dersten çıkarılmış olabilir)
      if (!data || data.length === 0) throw new Error('no_rows_updated');

      // İşaretlenen kayıt listeden çıkar
      setRows(prev => prev.filter(item => item.id !== row.id));
      if (onMarked) onMarked(row.registration);
    } catch (error) {
      console.error('Yoklama kaydedilirken hata oluştu:', error);
      if (onError) {
        onError(isTr
          ? 'Kaydedilemedi. Bağlantınızı kontrol edip tekrar deneyin.'
          : 'Could not save. Check your connection and try again.');
      }
    } finally {
      inFlightRef.current.delete(row.id);
      setUpdatingIds(new Set(inFlightRef.current));
    }
  };

  if (rows.length === 0) return null;

  // Derse göre grupla (satırlar zaten tarihe göre sıralı)
  const groups = [];
  rows.forEach(row => {
    const last = groups[groups.length - 1];
    if (last && last.event.id === row.events.id) {
      last.rows.push(row);
    } else {
      groups.push({ event: row.events, rows: [row] });
    }
  });

  const dateLocale = isTr ? tr : enUS;

  return (
    <div className="mt-10 rounded-xl border border-yellow-200 dark:border-yellow-800/30 bg-yellow-50 dark:bg-yellow-900/10">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between gap-3 p-4 text-left"
      >
        <span className="flex items-start gap-3 min-w-0">
          <ExclamationTriangleIcon className="w-5 h-5 mt-0.5 shrink-0 text-yellow-600 dark:text-yellow-500" />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-yellow-800 dark:text-yellow-200">
              {isTr
                ? `Geçmiş derslerde yoklaması işaretlenmemiş ${rows.length} kayıt var`
                : `${rows.length} attendance record${rows.length === 1 ? '' : 's'} from past lessons ${rows.length === 1 ? 'is' : 'are'} not marked`}
            </span>
            <span className="block mt-0.5 text-xs text-yellow-700 dark:text-yellow-300/80">
              {isTr
                ? 'İşaretlenene kadar öğrencinin kalan dersinden düşmez (son 30 gün).'
                : 'They are not deducted from the remaining lessons until marked (last 30 days).'}
            </span>
          </span>
        </span>
        <span className="flex items-center gap-1 shrink-0 text-xs font-medium text-yellow-800 dark:text-yellow-200">
          {isOpen ? (isTr ? 'Gizle' : 'Hide') : (isTr ? 'Göster' : 'Show')}
          <ChevronDownIcon className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-4">
          {groups.map(group => (
            <div key={group.event.id}>
              <div className="text-[13px] font-medium text-[#1d1d1f] dark:text-white capitalize">
                {format(new Date(group.event.event_date), 'd MMMM EEEE, HH:mm', { locale: dateLocale })}
                <span className="font-normal text-[#6e6e73] dark:text-[#86868b] normal-case">
                  {' · '}
                  {group.event.event_type === 'ozel' && group.event.custom_description
                    ? group.event.custom_description
                    : (EVENT_TYPE_LABELS[group.event.event_type]?.[isTr ? 'tr' : 'en'] || group.event.event_type)}
                  {' · '}
                  {group.event.age_group}
                </span>
              </div>

              <div className="mt-2 space-y-2">
                {group.rows.map(row => (
                  <div
                    key={row.id}
                    className="p-3 bg-white dark:bg-[#121621] rounded-lg border border-[#d2d2d7] dark:border-[#2a3241] flex flex-col sm:flex-row sm:items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#1d1d1f] dark:text-white flex items-center gap-2">
                        <span className="truncate">{row.registration.student_name}</span>
                        {row.registration.is_active === false && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-[#1d2535] text-[10px] font-medium text-[#6e6e73] dark:text-[#86868b]">
                            {isTr ? 'Arşiv' : 'Archived'}
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-[#6e6e73] dark:text-[#86868b] truncate">
                        {isTr ? 'Veli: ' : 'Parent: '}{row.registration.parent_name}
                      </p>
                    </div>

                    <div className="grid grid-cols-4 sm:flex sm:flex-row items-center gap-2">
                      {STATUS_BUTTONS.map(button => (
                        <button
                          key={button.status}
                          type="button"
                          onClick={() => markStatus(row, button.status)}
                          disabled={updatingIds.has(row.id)}
                          className={`px-1 sm:px-3 py-1 text-[11px] font-medium text-center whitespace-nowrap rounded-full border transition disabled:opacity-50 disabled:cursor-wait bg-white text-gray-700 border-gray-300 dark:bg-[#1c1c1e]/40 dark:text-gray-300 dark:border-gray-700 ${button.hover}`}
                        >
                          {isTr ? button.tr : button.en}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
