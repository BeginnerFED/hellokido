import { supabase } from './supabase';
import { isAttendanceOverdue } from './attendance';

// Ücretsiz katılım: ödeme alınmayan, ders kotası olmayan paket türü
export const FREE_PACKAGE_TYPE = 'ucretsiz';

export const isFreePackage = (packageType) => packageType === FREE_PACKAGE_TYPE;

// Paket tipine göre toplam ders hakkı
// 3ay-* paketleri 12 haftalık uzun dönem paketleridir (haftada 1 → 12, haftada 2 → 24 atölye)
export const PACKAGE_LESSON_TOTALS = {
  'hafta-1': 4,
  'hafta-2': 8,
  'hafta-3': 12,
  'hafta-4': 16,
  '3ay-hafta-1': 12,
  '3ay-hafta-2': 24,
  'tek-seferlik': 1
};

export const getPackageLessonTotal = (packageType) => {
  // Ücretsizde kota kavramı yok (null), bilinmeyen tipler 0
  if (isFreePackage(packageType)) return null;
  return PACKAGE_LESSON_TOTALS[packageType] || 0;
};

// Paket dönemleri gün bazında karşılaştırılır; "gün" atölyenin bulunduğu saat dilimindeki gündür.
const BUSINESS_TIME_ZONE = 'Europe/Istanbul';
const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

// 'YYYY-AA-GG' (sıralanabilir). Geçersiz tarihte boş döner.
const dayKey = (date) => {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return '';

  const parts = {};
  dayFormatter.formatToParts(value).forEach(part => { parts[part.type] = part.value; });
  return `${parts.year}-${parts.month}-${parts.day}`;
};

// Bir öğrencinin ders kullanımını hesaplar.
// İş kuralları (sahibin kararı):
// - Kullanılan = SADECE 'attended' (Katıldı) + 'no_show' (Gelmedi).
//   'scheduled' henüz harcanmamış hak; 'makeup' planlı devamsızlık telafisi, hak yakmaz;
//   'postponed'/'cancelled' yakmaz.
// - Sayım güncel paket dönemine bakar: yalnızca dersin event_date'i
//   package_start_date ve SONRASI olan satırlar sayılır (uzatma yapılınca sayaç sıfırlanır).
// - Kota = paket tipi kotası + önceki dönemden devreden kullanılmamış dersler
//   (options.carried, bkz. computeCarriedLessons). Sayaç uzatmada sıfırlanır ama
//   ödenmiş hak kaybolmaz.
// - Ücretsiz katılımda kota yoktur: total/remaining null döner, sayım dönem-kapsamına girmez
//   (paket dönemi kavramı yok; ücretliden dönüştürülmüşse eski başlangıç tarihi geçmişi keserdi).
// rows: [{ status, events: { event_date } | null }] — events null ise (silinmiş etkinlik) sayılmaz.
// options.before verilirse yalnızca o andan ÖNCEKİ dersler sayılır; bir dönemi, sonraki
// dönemin başladığı anda kesmek için kullanılır (normal gösterimde üst sınır yoktur).
// unmarkedPast: günü geçmiş olduğu halde hâlâ 'scheduled' duran dersler (bugünküler hariç).
// Hak yakmazlar (otomatik sayım yok); yoklaması unutulmuş dersleri göstermek içindir.
export const computeLessonUsage = (registration, rows, options = {}) => {
  const free = isFreePackage(registration.package_type);
  const carried = free ? 0 : Math.max(Number(options.carried) || 0, 0);
  const total = free ? null : getPackageLessonTotal(registration.package_type) + carried;
  const periodStart = !free && registration.package_start_date
    ? new Date(registration.package_start_date)
    : null;
  const periodEnd = !free && options.before ? new Date(options.before) : null;

  const now = new Date();

  const counts = {
    attended: 0,
    noShow: 0,
    makeup: 0,
    scheduled: 0,
    postponed: 0,
    unmarkedPast: 0
  };

  (rows || []).forEach(row => {
    if (!row.events || !row.events.event_date) return;
    const eventDate = new Date(row.events.event_date);
    if (periodStart && eventDate < periodStart) return;
    if (periodEnd && eventDate >= periodEnd) return;

    switch (row.status) {
      case 'attended': counts.attended += 1; break;
      case 'no_show': counts.noShow += 1; break;
      case 'makeup': counts.makeup += 1; break;
      case 'scheduled':
        counts.scheduled += 1;
        if (isAttendanceOverdue(row.status, eventDate, now)) counts.unmarkedPast += 1;
        break;
      case 'postponed': counts.postponed += 1; break;
      default: break;
    }
  });

  const used = counts.attended + counts.noShow;

  return {
    isFree: free,
    total,
    carried,
    used,
    remaining: free ? null : Math.max(total - used, 0),
    ...counts
  };
};

// Yeni dönem, kapanan dönemden daha ileri bir günde mi başlıyor?
// "Uzat" yalnızca yeni paket için kullanılmıyor: aynı paketin taksidi de, deneme dersinin
// pakete çevrilmesi de dönemi ilerletmeden "Uzat" ile kaydediliyor (uzatmaların ~%16'sı).
// Dönem ilerlemediyse ortada yeni bir paket yoktur.
const startsLaterDay = (nextPeriodStart, periodStart) => {
  const next = dayKey(nextPeriodStart);
  const current = dayKey(periodStart);
  return next !== '' && current !== '' && next > current;
};

// Başlangıcı ile bitişi aynı gün olan çok dersli "dönem" gerçek bir paket dönemi değildir:
// uzatma ekranı varsayılan tarihlerle (başlangıç = bitiş = eski bitiş) kaydedildiğinde oluşan
// yer tutucudur ve aynı paketin ikinci ödemesini temsil eder. Kendi kotası olmaz.
// (Tek seferlik katılımda tek günlük dönem normaldir.)
const isPlaceholderPeriod = (period) =>
  period.package_type !== 'tek-seferlik' &&
  Boolean(period.package_end_date) &&
  !startsLaterDay(period.package_end_date, period.package_start_date);

// Bir dönem kapanırken sonraki döneme devreden kullanılmamış ders sayısı.
// period: { package_type, package_start_date, package_end_date }
// carriedIn: bu döneme daha eskilerden devretmiş ders sayısı.
// Dönem, sonraki dönemin başladığı anda kesilir; böylece her ders ya eski ya yeni
// döneme yazılır, ikisine birden değil.
const closePeriod = (period, carriedIn, nextPeriodStart, rows) => {
  const carried = Math.max(Number(carriedIn) || 0, 0);

  // Dönem ilerlemedi (taksit / deneme dersinin pakete çevrilmesi) ya da ücretsiz dönem:
  // bu dönemin kendi kotası devretmez, yalnızca ona devretmiş olan aynen geçer.
  if (isFreePackage(period.package_type) || !startsLaterDay(nextPeriodStart, period.package_start_date)) {
    return carried;
  }

  const ownQuota = isPlaceholderPeriod(period) ? 0 : getPackageLessonTotal(period.package_type);
  const used = computeLessonUsage(period, rows, { before: nextPeriodStart }).used;

  return Math.max(carried + ownQuota - used, 0);
};

// Bir kaydın devir zinciri: devri canlı hesaplanacak dönemleri tarif eden uzatma satırları.
// extensions: kaydın uzatma satırları, EN YENİDEN ESKİYE sıralı. Her satır, o uzatmayla
// kapanan dönemi tarif eder (previous_package_type, previous_start_date, previous_end_date)
// ve o döneme daha eskilerden devretmiş ders sayısını (previous_carried_lessons) taşır.
// - En yeni satırın previous_start_date'i boşsa uzatma devir özelliğinden önce yapılmıştır:
//   zincir boştur, devir uygulanmaz (geçmişe dönük düzeltme yok).
// - previous_carried_lessons uzatma kaydedilirken sabitlenir. Satır, kapattığı dönem
//   başladıktan SONRA kaydedildiyse bu sayıya güvenilir (daha eski dönemlerin dersleri o an
//   geçmişte kalmıştı) ve zincir orada biter. Henüz başlamamış bir paketin üstüne yapılan
//   uzatmada ise erken sabitlenmiştir; bir önceki satıra inilip oradan canlı hesaplanır.
//   Sabitlenmiş bir sayı, o tarihten sonra çok eski bir dersin yoklaması değiştirilse de değişmez.
const getCarryChain = (extensions) => {
  const chain = [];

  for (const extension of extensions || []) {
    if (!extension.previous_start_date) break;
    chain.push(extension);
    if (new Date(extension.created_at) >= new Date(extension.previous_start_date)) break;
  }

  return chain;
};

// Önceki paket dönemlerinden güncel döneme devreden kullanılmamış ders sayısı.
// Sahibin kuralları: devir birikir, süresi dolmaz, paket tipi değişse de geçerlidir.
// Güncel döneme devir, en son kapanan dönemin kullanımından her seferinde yeniden hesaplanır:
// paket bitmeden uzatma yapıldığında (uzatmaların ~%30'u) eski dönemde sonradan yapılan
// dersler de böylece devirden düşer.
// extensions: kaydın uzatma satırları, EN YENİDEN ESKİYE sıralı (bkz. getCarryChain).
export const computeCarriedLessons = (registration, extensions, rows) => {
  if (isFreePackage(registration.package_type) || !registration.package_start_date) return 0;

  const chain = getCarryChain(extensions);
  if (chain.length === 0) return 0;

  // En eski halkanın sabitlenmiş devrinden başlayıp güncel döneme doğru ilerle
  let carried = chain[chain.length - 1].previous_carried_lessons;

  for (let i = chain.length - 1; i >= 0; i--) {
    const period = {
      package_type: chain[i].previous_package_type,
      package_start_date: chain[i].previous_start_date,
      package_end_date: chain[i].previous_end_date
    };
    const nextPeriodStart = i === 0
      ? registration.package_start_date
      : chain[i - 1].previous_start_date;

    carried = closePeriod(period, carried, nextPeriodStart, rows);
  }

  return Math.max(Number(carried) || 0, 0);
};

const PAGE_SIZE = 1000; // PostgREST tek seferde en fazla 1000 satır döndürür

// Katılım satırlarını sayfalamalı çeker
// (sayfalama yokken ~550 satır sessizce düşüyordu).
const fetchParticipantRows = async (ids, minStart) => {
  const allRows = [];
  let from = 0;

  for (;;) {
    let query = supabase
      .from('event_participants')
      .select('status, registration_id, events!inner(event_date)')
      .in('registration_id', ids)
      .order('id')
      .range(from, from + PAGE_SIZE - 1);

    if (minStart) {
      query = query.gte('events.event_date', minStart.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;

    allRows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allRows;
};

// Kayıtların uzatma satırlarını getirir, kayıt başına EN YENİDEN ESKİYE sıralı.
// Devir öncesi satırlar da çekilir: en yeni satır onlardan biriyse devir uygulanmamalı.
// Dönüş: { [registrationId]: extensionRow[] }
const fetchExtensionsByRegistration = async (ids) => {
  const extensionsByRegistration = {};
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from('extension_history')
      .select('registration_id, created_at, previous_package_type, previous_start_date, previous_end_date, previous_carried_lessons')
      .in('registration_id', ids)
      .order('created_at', { ascending: false })
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;

    (data || []).forEach(row => {
      if (!extensionsByRegistration[row.registration_id]) {
        extensionsByRegistration[row.registration_id] = [];
      }
      extensionsByRegistration[row.registration_id].push(row);
    });

    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return extensionsByRegistration;
};

// Kullanım hesabının girdilerini (uzatma satırları + katılım satırları) toplu getirir.
const fetchUsageInputs = async (registrations) => {
  const ids = registrations.map(reg => reg.id);
  const extensionsByRegistration = await fetchExtensionsByRegistration(ids);

  // Sunucu tarafı tarih filtresi: en erken dönem başlangıcından itibaren çek.
  // Devri olan kayıtlarda devir zincirindeki eski dönemlerin dersleri de gerektiği
  // için alt sınıra o dönemlerin başlangıçları da katılır.
  // Kayıtlardan biri ücretsizse veya start'ı yoksa filtre atlanır — aksi halde
  // ücretsiz öğrencinin kayıt gününden önceki dersleri sunucuda elenir ve
  // istatistik sayaçları sıfırlanırdı (istemci tarafı kapsam yine uygulanır).
  const startDates = registrations
    .flatMap(reg => [
      reg.package_start_date,
      ...getCarryChain(extensionsByRegistration[reg.id]).map(extension => extension.previous_start_date)
    ])
    .filter(Boolean)
    .map(date => new Date(date));
  const hasUnscopedRegistration = registrations.some(
    reg => !reg.package_start_date || isFreePackage(reg.package_type)
  );
  const minStart = !hasUnscopedRegistration && startDates.length > 0
    ? new Date(Math.min(...startDates.map(date => date.getTime())))
    : null;

  const allRows = await fetchParticipantRows(ids, minStart);

  // Satırları kayda göre grupla
  const rowsByRegistration = {};
  allRows.forEach(row => {
    if (!rowsByRegistration[row.registration_id]) {
      rowsByRegistration[row.registration_id] = [];
    }
    rowsByRegistration[row.registration_id].push(row);
  });

  return { extensionsByRegistration, rowsByRegistration };
};

// Birden çok kayıt için ders kullanımını toplu sorgularla getirir.
// Dönüş: { [registrationId]: usage }
export const fetchLessonUsageMap = async (registrations) => {
  const usageMap = {};
  if (!registrations || registrations.length === 0) return usageMap;

  const { extensionsByRegistration, rowsByRegistration } = await fetchUsageInputs(registrations);

  // Satırı olmayan kayıtlar da haritada yer alır (remaining = total)
  registrations.forEach(registration => {
    const rows = rowsByRegistration[registration.id] || [];
    const carried = computeCarriedLessons(registration, extensionsByRegistration[registration.id], rows);
    usageMap[registration.id] = computeLessonUsage(registration, rows, { carried });
  });

  return usageMap;
};

// Uzatma kaydedilirken gereken devir bilgisini getirir: kaydın güncel dönemi, katılım
// satırları ve güncel döneme devretmiş ders sayısı (uzatma satırına
// previous_carried_lessons olarak yazılır).
// Kayıt veritabanından TAZE okunur; ekrandaki kayıt bayat olabilir.
export const fetchCarryOverSource = async (registrationId) => {
  const { data: registration, error } = await supabase
    .from('registrations')
    .select('id, package_type, package_start_date, package_end_date')
    .eq('id', registrationId)
    .single();
  if (error) throw error;

  const { extensionsByRegistration, rowsByRegistration } = await fetchUsageInputs([registration]);
  const rows = rowsByRegistration[registration.id] || [];
  const carried = computeCarriedLessons(registration, extensionsByRegistration[registration.id], rows);

  return { registration, rows, carried };
};

// Uzatma newStartDate'te başlarsa yeni döneme devredecek ders sayısı
// (kaydettikten hemen sonra ekranda "devir" olarak görünecek değer).
// source: fetchCarryOverSource sonucu.
export const computeCarryOverPreview = (source, newStartDate) => {
  if (!source || !newStartDate) return 0;
  return closePeriod(source.registration, source.carried, newStartDate, source.rows);
};

// Seçilen başlangıç tarihi yeni bir paket dönemi başlatıyor mu?
// Başlatmıyorsa (güncel dönemle aynı gün ya da daha erken) ders sayımı sıfırlanmaz ve
// önceki paketin kotası devretmez: kayıt, aynı dönem için ek ödeme ya da deneme dersinin
// pakete çevrilmesidir.
export const startsNewPeriod = (currentPeriodStart, newStartDate) => {
  if (!currentPeriodStart || !newStartDate) return false;
  return startsLaterDay(newStartDate, currentPeriodStart);
};
