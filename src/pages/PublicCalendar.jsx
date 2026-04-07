import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval } from 'date-fns';
import { tr } from 'date-fns/locale';

const PublicCalendar = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [isFiltersVisible, setIsFiltersVisible] = useState(false);
  const [expandedDay, setExpandedDay] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filters, setFilters] = useState({
    ageGroup: '',
    eventType: ''
  });

  const filterPanelRef = useRef(null);
  const filterButtonRef = useRef(null);

  // Dışarı tıklandığında filtre panelini kapat
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isFiltersVisible &&
        filterPanelRef.current &&
        !filterPanelRef.current.contains(event.target) &&
        !filterButtonRef.current.contains(event.target)
      ) {
        setIsFiltersVisible(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFiltersVisible]);

  // Etkinlik türüne göre renk ve ikon belirleme
  const getEventTypeDetails = (type) => {
    switch (type) {
      case 'ingilizce':
        return {
          color: '#8b5cf6',
          icon: '🌐',
          svgIcon: true,
          label: 'İngilizce'
        };
      case 'duyusal':
        return {
          color: '#f97316',
          icon: '🎨',
          svgIcon: false,
          label: 'Duyusal'
        };
      case 'ozel':
        return {
          color: '#059669',
          icon: '⭐',
          svgIcon: false,
          label: 'Özel'
        };
      default:
        return {
          color: '#6b7280',
          icon: '📅',
          svgIcon: false,
          label: type
        };
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [currentWeek, filters]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);

      const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });

      let query = supabase
        .from('events')
        .select('*')
        .eq('is_active', true)
        .gte('event_date', weekStart.toISOString())
        .lte('event_date', weekEnd.toISOString())
        .order('event_date', { ascending: true });

      if (filters.ageGroup) {
        query = query.eq('age_group', filters.ageGroup);
      }
      if (filters.eventType) {
        query = query.eq('event_type', filters.eventType);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Her etkinlik için aktif katılımcı sayısını getir
      const eventsWithActiveCapacity = await Promise.all(data.map(async (event) => {
        const { data: participants, error: participantsError } = await supabase
          .from('event_participants')
          .select('status')
          .eq('event_id', event.id);
          
        if (participantsError) throw participantsError;
        
        // Aktif statüdeki katılımcıları say (scheduled, makeup, attended)
        const activeCount = participants ? 
          participants.filter(p => p.status === 'scheduled' || p.status === 'makeup' || p.status === 'attended').length : 
          0;
        
        return {
          ...event,
          active_capacity: activeCount
        };
      }));
      
      setEvents(eventsWithActiveCapacity);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const navigateWeek = (direction) => {
    setCurrentWeek(direction === 'next' ? addWeeks(currentWeek, 1) : subWeeks(currentWeek, 1));
  };

  // Haftanın günlerini oluştur
  const weekDays = eachDayOfInterval({
    start: startOfWeek(currentWeek, { weekStartsOn: 1 }),
    end: endOfWeek(currentWeek, { weekStartsOn: 1 })
  });

  // Belirli bir gün için etkinlikleri filtrele
  const getEventsForDay = (date) => {
    return events.filter(event => 
      format(new Date(event.event_date), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
    );
  };

  if (loading) return (
    <div className="min-h-screen w-full grid place-items-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-4 border-purple-200 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-purple-500 rounded-full animate-spin border-t-transparent"></div>
        </div>
        <div className="text-sm text-purple-600 font-medium">Yükleniyor...</div>
      </div>
    </div>
  );
  
  if (error) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-base text-red-600">Hata: {error}</div>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-blue-50 to-purple-50 font-['Euclid_Circular_A']">
      {/* Header */}
      <div className="bg-white shadow-lg" role="banner">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex justify-center items-center">
            <img 
              src="https://hellokido.com/assets/img/logo/svgBG.svg" 
              alt="HelloKido Logo" 
              className="h-16 md:h-20"
            />
          </div>
        </div>
      </div>

      {/* Sticky Navigation */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm shadow-sm" role="navigation">
        <div className="max-w-3xl mx-auto px-4 py-3">
          {/* Navigation */}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => navigateWeek('prev')}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-pink-100 hover:bg-pink-200 text-pink-700 transition-all duration-200 transform hover:scale-105"
              aria-label="Önceki hafta"
            >
              ←
            </button>
            <h2 className="flex-1 text-center text-base font-bold text-purple-800 bg-purple-100 mx-2 px-4 py-1.5 rounded-full">
              {format(weekDays[0], 'd MMMM', { locale: tr })} - {format(weekDays[6], 'd MMMM', { locale: tr })}
            </h2>
            <button
              onClick={() => navigateWeek('next')}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-pink-100 hover:bg-pink-200 text-pink-700 transition-all duration-200 transform hover:scale-105"
              aria-label="Sonraki hafta"
            >
              →
            </button>
            <div className="relative">
              <button
                ref={filterButtonRef}
                onClick={() => setIsFiltersVisible(!isFiltersVisible)}
                className={`w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 transform hover:scale-105 ${
                  filters.ageGroup || filters.eventType 
                    ? 'bg-purple-500 text-white hover:bg-purple-600' 
                    : 'bg-purple-100 hover:bg-purple-200 text-purple-700'
                }`}
                aria-label={`Filtreleri ${isFiltersVisible ? 'gizle' : 'göster'}`}
                aria-expanded={isFiltersVisible}
                aria-controls="filterPanel"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true" data-slot="icon" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75"></path>
                </svg>
              </button>
              {(filters.ageGroup || filters.eventType) && (
                <span 
                  className="absolute -top-1 -right-1 w-3 h-3 bg-pink-500 rounded-full border-2 border-white"
                  aria-label="Aktif filtreler var"
                ></span>
              )}
            </div>
          </div>
        </div>

        {/* Filtre Paneli */}
        <div 
          ref={filterPanelRef}
          id="filterPanel"
          className={`border-t border-purple-100 transition-all duration-300 ${isFiltersVisible ? 'max-h-96 py-4' : 'max-h-0 overflow-hidden'}`}
          role="region"
          aria-label="Filtre seçenekleri"
        >
          <div className="max-w-3xl mx-auto px-4">
            <div className="bg-white rounded-2xl p-4 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-purple-800">
                  Filtreler {events.length > 0 && `(${events.length} sonuç)`}
                </h3>
                {(filters.ageGroup || filters.eventType) && (
                  <button
                    onClick={() => setFilters({ ageGroup: '', eventType: '' })}
                    className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-3 h-3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Temizle
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="ageGroup" className="block text-xs font-semibold text-purple-700">
                    Yaş Grubu
                  </label>
                  <select
                    id="ageGroup"
                    value={filters.ageGroup}
                    onChange={(e) => setFilters(prev => ({ ...prev, ageGroup: e.target.value }))}
                    className="w-full rounded-xl border-2 border-purple-100 text-xs focus:ring-purple-500 focus:border-purple-500 bg-purple-50/50 py-2"
                  >
                    <option value="">Tümü</option>
                    <option value="12-18 Aylık">12-18 Aylık</option>
                    <option value="18-24 Aylık">18-24 Aylık</option>
                    <option value="24-36 Aylık">24-36 Aylık</option>
                    <option value="3+ Yaş">3+ Yaş</option>
                    <option value="4+ Yaş">4+ Yaş</option>
                    <option value="5+ Yaş">5+ Yaş</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="eventType" className="block text-xs font-semibold text-purple-700">
                    Etkinlik Tipi
                  </label>
                  <select
                    id="eventType"
                    value={filters.eventType}
                    onChange={(e) => setFilters(prev => ({ ...prev, eventType: e.target.value }))}
                    className="w-full rounded-xl border-2 border-purple-100 text-xs focus:ring-purple-500 focus:border-purple-500 bg-purple-50/50 py-2"
                  >
                    <option value="">Tümü</option>
                    <option value="ingilizce">İngilizce</option>
                    <option value="duyusal">Duyusal</option>
                    <option value="ozel">Özel</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Günler Listesi */}
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6" role="main">
        {weekDays.map((day) => {
          const dayEvents = getEventsForDay(day);
          const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
          const isExpanded = expandedDay === format(day, 'yyyy-MM-dd');
          const hasEvents = dayEvents.length > 0;
          
          return (
            <div 
              key={day.toString()} 
              className={`bg-white rounded-2xl shadow-lg transform transition-all duration-300 hover:scale-[1.02] ${isToday ? 'ring-4 ring-yellow-400' : ''}`}
            >
              <button
                onClick={() => setExpandedDay(isExpanded ? null : format(day, 'yyyy-MM-dd'))}
                className="w-full px-4 py-3 flex items-center justify-between"
                aria-expanded={isExpanded}
                aria-controls={`day-events-${format(day, 'yyyy-MM-dd')}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`text-base font-bold ${isToday ? 'text-yellow-500' : 'text-purple-700'}`}>
                    {format(day, 'EEEE', { locale: tr })}
                  </div>
                  <div className="text-sm text-purple-500 font-medium">
                    {format(day, 'd MMMM', { locale: tr })}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {hasEvents && (
                    <span className="bg-gradient-to-r from-pink-500 to-purple-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-md">
                      {dayEvents.length} etkinlik
                    </span>
                  )}
                  <svg
                    className={`w-5 h-5 text-purple-500 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              <div 
                id={`day-events-${format(day, 'yyyy-MM-dd')}`}
                className={`overflow-hidden transition-all duration-300`}
                style={{ maxHeight: isExpanded ? `${dayEvents.length * 120 + 50}px` : '0' }}
                role="region"
                aria-label={`${format(day, 'EEEE', { locale: tr })} etkinlikleri`}
              >
                <div className="px-4 pb-4 space-y-3">
                  {dayEvents.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-gray-400 text-sm font-medium">Atölyemiz bugün kapalıdır ✨</p>
                    </div>
                  ) : (
                    dayEvents.map(event => {
                      const typeDetails = getEventTypeDetails(event.event_type);
                      // Aktif katılımcı sayısına göre kalan kontenjanı hesapla
                      const availableSpots = 6 - event.active_capacity;
                      const hasSpots = availableSpots > 0;
                      
                      return (
                        <div
                          key={event.id}
                          className={`p-3 rounded-xl border-2 transition-all duration-300 transform hover:scale-[1.02] ${
                            hasSpots 
                              ? 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200' 
                              : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">
                                {typeDetails.svgIcon ? (
                                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"></path>
                                  </svg>
                                ) : (
                                  typeDetails.icon
                                )}
                              </span>
                              <span className="font-bold text-sm bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-600">
                                {typeDetails.label}
                              </span>
                            </div>
                            <span className="text-sm font-bold px-2 py-1 bg-white rounded-full shadow-sm">
                              {format(new Date(event.event_date), 'HH:mm')}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <div className="text-xs font-medium text-purple-700 bg-purple-100 px-2 py-1 rounded-full">
                              {event.age_group}
                            </div>
                            <div className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                              hasSpots 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {hasSpots ? `${availableSpots} kişilik kontenjan kaldı` : 'Dolu'}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
};

export default PublicCalendar; 