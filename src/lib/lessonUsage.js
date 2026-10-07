import { supabase } from './supabase';
import { isAttendanceOverdue } from './attendance';

// Ücretsiz katılım: ödeme alınmayan, ders kotası olmayan paket türü
export const FREE_PACKAGE_TYPE = 'ucretsiz';

export const isFreePackage = (packageType) => packageType === FREE_PACKAGE_TYPE;

// Paket tipine göre toplam ders hakkı
// 3ay-* paketleri 12 haftalık uzun dönem paketleridir (haftada 1 → 12, haftada 2 → 24 atölye).
// 3ay-yarim-* bu paketlerin yarım ödemesidir: aileler 3 aylık paketi iki ödemede ödediğinde
// her ödeme paketin yarısı kadar ders ekler (bkz. getPackageQuota).
export const PACKAGE_LESSON_TOTALS = {
  'hafta-1': 4,
  'hafta-2': 8,
  'hafta-3': 12,
  'hafta-4': 16,
  '3ay-hafta-1': 12,
  '3ay-hafta-2': 24,
  '3ay-yarim-hafta-1': 6,
  '3ay-yarim-hafta-2': 12,
  'tek-seferlik': 1
};

// Yarım ödemenin ait olduğu tam paket
const HALF_PACKAGE_PARENTS = {
  '3ay-yarim-hafta-1': '3ay-hafta-1',
  '3ay-yarim-hafta-2': '3ay-hafta-2'
};

export const isHalfPackage = (packageType) => typeof HALF_PACKAGE_PARENTS[packageType] === 'string';

export const getPackageLessonTotal = (packageType) => {
  // Ücretsizde kota kavramı yok (null), bilinmeyen tipler 0
  if (isFreePackage(packageType)) return null;
  return PACKAGE_LESSON_TOTALS[packageType] || 0;
};

// Aynı pakete yapılmış önceki bir ödemenin o pakete kattığı ders. Yalnızca 3 aylık paket
// ailesinde (tam paket ya da yarım ödemesi) geçerlidir; deneme dersi ve aylık paketlerin
// önceki ödemesi ders eklemez.
const getSharedQuota = (packageType) =>
  typeof packageType === 'string' && packageType.startsWith('3ay-')
    ? getPackageLessonTotal(packageType)
    : 0;

// Bir paketin ders hakkı, aynı pakete yapılmış önceki ödemelerle birlikte.
// earlierQuota: o ödemelerin kattığı ders (bkz. getEarlierPaymentsQuota).
// Yarım ödemeler birleşir ama ait oldukları tam paketi aşamaz (6 + 6 = 12, 12 + 12 = 24);
// diğer türlerde önceki ödeme ders eklemez. Böylece iki ödeme hangi türlerle kaydedilirse
// kaydedilsin (yarım + yarım, tam + tam, tam + yarım) paket bir kez sayılır.
const getPackageQuota = (packageType, earlierQuota = 0) => {
  const own = getPackageLessonTotal(packageType) || 0;
  const cap = isHalfPackage(packageType)
    ? getPackageLessonTotal(HALF_PACKAGE_PARENTS[packageType])
    : own;
  return Math.min(own + Math.max(Number(earlierQuota) || 0, 0), cap);
};

// Bir pakete ek olarak verilebilecek en fazla ders (veritabanındaki denetimle aynı)
export const MAX_EXTRA_LESSONS = 99;

// Ekstra ders sayısını negatif olmayan tam sayıya çevirir (boş ya da geçersiz değerde 0)
const toExtraCount = (value) => Math.max(Math.trunc(Number(value)) || 0, 0);

// Pakete ek olarak verilmiş dersler. Her ekstra ders tek bir yerde durur: kayıtta güncel
// paketinkiler (registrations.extra_lessons), uzatma satırında o satırın kapattığı dönemde
// kalanlar (extension_history.previous_extra_lessons, bkz. closedPeriodOf).
const getExtraLessons = (period) => toExtraCount(period?.extra_lessons);

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
// - Kota = paketin ders hakkı + önceki dönemden devreden kullanılmamış dersler
//   (options.carried, bkz. computeCarriedLessons). Sayaç uzatmada sıfırlanır ama
//   ödenmiş hak kaybolmaz.
// - Paketin ders hakkı paket tipinin kotasıdır; yarım ödemede aynı pakete yapılmış önceki
//   ödeme de eklenir (options.earlierQuota, bkz. getEarlierPaymentsQuota).
// - Pakete ek olarak verilen dersler (registration.extra_lessons) kotaya eklenir.
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
  const extra = free ? 0 : getExtraLessons(registration);
  const packageTotal = free ? null : getPackageQuota(registration.package_type, options.earlierQuota);
  const total = free ? null : packageTotal + carried + extra;
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
    // Paketin ders hakkı (devir ve ekstra hariç) ve bunun, aynı pakete yapılmış önceki ödemeden gelen kısmı
    packageTotal,
    earlierPaymentLessons: free ? 0 : packageTotal - (getPackageLessonTotal(registration.package_type) || 0),
    carried,
    // Pakete ek olarak verilen dersler
    extra,
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

// İki tarih arasındaki takvim günü farkı (atölyenin saat diliminde); geçersiz tarihte NaN
const dayDifference = (from, to) => {
  const fromKey = dayKey(from);
  const toKey = dayKey(to);
  if (fromKey === '' || toKey === '') return NaN;
  return Math.round((Date.parse(toKey) - Date.parse(fromKey)) / 86400000);
};

// Çok dersli bir paketin en çok bir günlük "dönemi" gerçek bir paket dönemi değildir; ödemenin
// kaydedildiği yer tutucudur ve kendi kotası devretmez. İki biçimi vardır:
// - Başlangıcı ile bitişi aynı gün: uzatma ekranı varsayılan tarihlerle (başlangıç = bitiş =
//   eski bitiş) kaydedilmiştir; biten paketin ikinci ödemesidir.
// - Bitişi başlangıcın ertesi günü ("öncü"): ilk ödeme bir günlük dönemle kaydedilmiş, paketin
//   gerçek tarihleri ikinci ödemeyle girilmiştir. Sonraki dönemle aynı pakettir.
// (Tek seferlik katılımda tek günlük dönem normaldir.)
// Dönüş: yer tutucunun gün sayısı (0 ya da 1); gerçek dönemde null.
const getPlaceholderDays = (period) => {
  if (period.package_type === 'tek-seferlik' || !period.package_end_date) return null;
  const days = dayDifference(period.package_start_date, period.package_end_date);
  if (days > 1) return null;
  return days === 1 ? 1 : 0;
};

const isPlaceholderPeriod = (period) => getPlaceholderDays(period) !== null;

const isLeadingPlaceholder = (period) => getPlaceholderDays(period) === 1;

// Kapanan dönem ile onu izleyen dönem aynı pakete mi ait?
// Dönem ileri bir güne taşınmadıysa (aynı paketin ödemesi, deneme dersinin pakete çevrilmesi)
// ya da kapanan dönem öncü yer tutucuysa ortada yeni bir paket yoktur.
const continuesSamePackage = (period, nextPeriodStart) =>
  !startsLaterDay(nextPeriodStart, period.package_start_date) || isLeadingPlaceholder(period);

// Uzatma satırının kapattığı dönem
const closedPeriodOf = (extension) => ({
  package_type: extension.previous_package_type,
  package_start_date: extension.previous_start_date,
  package_end_date: extension.previous_end_date,
  extra_lessons: extension.previous_extra_lessons
});

// Bir dönemin paketine daha önce yapılmış ödemelerin o pakete kattığı ders.
// periodStart: dönemin başlangıcı. closingExtensions: o dönemden ÖNCEKİ dönemleri kapatan
// uzatma satırları, EN YENİDEN ESKİYE (ilk satır, dönemin hemen öncesindeki dönemi kapatır).
// Aynı pakete ait dönemler geriye doğru izlenir; yeni bir paketin başladığı yerde ya da
// kapattığı dönemin başlangıcı kayıtlı olmayan satırda (devir özelliğinden önce yapılmış
// uzatma) durulur.
const getEarlierPaymentsQuota = (periodStart, closingExtensions) => {
  if (!periodStart) return 0;

  let quota = 0;
  let nextPeriodStart = periodStart;

  for (const extension of closingExtensions || []) {
    if (!extension.previous_start_date) break;

    const period = closedPeriodOf(extension);
    if (isFreePackage(period.package_type) || !continuesSamePackage(period, nextPeriodStart)) break;

    quota += getSharedQuota(period.package_type);
    nextPeriodStart = period.package_start_date;
  }

  return quota;
};

// Bir dönem kapanırken sonraki döneme devreden kullanılmamış ders sayısı.
// period: { package_type, package_start_date, package_end_date }
// carriedIn: bu döneme daha eskilerden devretmiş ders sayısı.
// earlierQuota: bu dönemin paketine daha önce yapılmış ödemelerin kattığı ders.
// Dönem, sonraki dönemin başladığı anda kesilir; böylece her ders ya eski ya yeni
// döneme yazılır, ikisine birden değil.
// Dönemde kalan ekstra dersler (period.extra_lessons) kotası gibi işlem görür.
const closePeriod = (period, carriedIn, earlierQuota, nextPeriodStart, rows) => {
  const carried = Math.max(Number(carriedIn) || 0, 0);
  const extra = getExtraLessons(period);

  // Dönem ilerlemedi (aynı paketin ödemesi / deneme dersinin pakete çevrilmesi) ya da ücretsiz
  // dönem: bu dönemin kendi kotası devretmez, yalnızca ona devretmiş olan aynen geçer.
  // Aynı paketin ödemesinde ekstralar kayıtta kalır, satırda ekstra olmaz; satırda varsa
  // (dönem tarihleri sonradan düzeltilmişse) kaybolmasın diye onlar da aynen geçer.
  if (isFreePackage(period.package_type) || !startsLaterDay(nextPeriodStart, period.package_start_date)) {
    return carried + extra;
  }

  // Yer tutucunun kendi kotası yoktur: ödediği paket önceki ya da sonraki dönemde sayılır
  const ownQuota = isPlaceholderPeriod(period) ? 0 : getPackageQuota(period.package_type, earlierQuota);
  const used = computeLessonUsage(period, rows, { before: nextPeriodStart }).used;

  return Math.max(carried + ownQuota + extra - used, 0);
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
    const period = closedPeriodOf(chain[i]);
    const nextPeriodStart = i === 0
      ? registration.package_start_date
      : chain[i - 1].previous_start_date;
    // Zincir, uzatma listesinin başıdır: bu dönemden öncekileri sonraki satırlar kapatır
    const earlierQuota = getEarlierPaymentsQuota(period.package_start_date, extensions.slice(i + 1));

    carried = closePeriod(period, carried, earlierQuota, nextPeriodStart, rows);
  }

  return Math.max(Number(carried) || 0, 0);
};

// Bir kaydın güncel dönemindeki ders kullanımı: devir ve aynı pakete yapılmış önceki ödemeler
// dahil. Ekranda görünen sayıların tek kaynağıdır.
// extensions: kaydın uzatma satırları, EN YENİDEN ESKİYE sıralı. rows: katılım satırları.
export const computeRegistrationUsage = (registration, extensions, rows) => {
  const carried = computeCarriedLessons(registration, extensions, rows);
  const earlierQuota = isFreePackage(registration.package_type)
    ? 0
    : getEarlierPaymentsQuota(registration.package_start_date, extensions);

  return computeLessonUsage(registration, rows, { carried, earlierQuota });
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
      .select('registration_id, created_at, previous_package_type, previous_start_date, previous_end_date, previous_carried_lessons, previous_extra_lessons')
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

// Ekstra ders alanı olmadan gelen kayıtlar (alanları tek tek seçen sorgular) için alanı
// veritabanından tamamlar; yoksa ekstra dersler sessizce sayılmazdı.
const withExtraLessons = async (registrations) => {
  const missingIds = registrations
    .filter(registration => registration.extra_lessons === undefined)
    .map(registration => registration.id);
  if (missingIds.length === 0) return registrations;

  const { data, error } = await supabase
    .from('registrations')
    .select('id, extra_lessons')
    .in('id', missingIds);
  if (error) throw error;

  const extraById = new Map((data || []).map(row => [row.id, row.extra_lessons]));
  return registrations.map(registration => (
    registration.extra_lessons === undefined
      ? { ...registration, extra_lessons: extraById.get(registration.id) ?? 0 }
      : registration
  ));
};

// Birden çok kayıt için ders kullanımını toplu sorgularla getirir.
// Dönüş: { [registrationId]: usage }
export const fetchLessonUsageMap = async (registrations) => {
  const usageMap = {};
  if (!registrations || registrations.length === 0) return usageMap;

  const [completeRegistrations, { extensionsByRegistration, rowsByRegistration }] = await Promise.all([
    withExtraLessons(registrations),
    fetchUsageInputs(registrations)
  ]);

  // Satırı olmayan kayıtlar da haritada yer alır (remaining = total)
  completeRegistrations.forEach(registration => {
    usageMap[registration.id] = computeRegistrationUsage(
      registration,
      extensionsByRegistration[registration.id],
      rowsByRegistration[registration.id] || []
    );
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
    .select('id, package_type, package_start_date, package_end_date, extra_lessons')
    .eq('id', registrationId)
    .single();
  if (error) throw error;

  const { extensionsByRegistration, rowsByRegistration } = await fetchUsageInputs([registration]);
  const rows = rowsByRegistration[registration.id] || [];
  const extensions = extensionsByRegistration[registration.id] || [];
  const carried = computeCarriedLessons(registration, extensions, rows);

  return { registration, rows, extensions, carried };
};

// Uzatma bu tür ve başlangıç tarihiyle kaydedilirse kaydın yeni dönemi nasıl görünecek?
// Kaydedildikten sonra oluşacak durum kurulur ve ekrandaki hesapla aynı yoldan hesaplanır;
// önizleme ile kayıttan sonra görünen sayı birbirinden farklı çıkamaz.
// source: fetchCarryOverSource sonucu. addedExtraLessons: bu ödemeyle verilen ekstra dersler.
// Dönüş: yeni dönemin kullanımı (bkz. computeLessonUsage) ve samePackage: kayıt yeni bir
// paket başlatmıyor, güncel paketin ödemesi olarak mı sayılacak? Girdiler eksikse null.
export const computeExtensionPreview = (source, newPackageType, newStartDate, addedExtraLessons = 0) => {
  if (!source || !newPackageType || !newStartDate) return null;

  const closing = source.registration;
  // Ekstra dersler, veritabanındaki kuralla (extend_registration) aynı yere yazılır: dönem ileri
  // bir güne taşınıyorsa kayıttakiler kapanan dönemde kalır ve yeni paket bu ödemeyle
  // verilenlerle başlar; taşınmıyorsa kayıttakiler durur, verilenler eklenir.
  const movesForward = startsLaterDay(newStartDate, closing.package_start_date);
  const closingExtra = getExtraLessons(closing);
  const addedExtra = toExtraCount(addedExtraLessons);

  const extensions = [
    {
      created_at: new Date().toISOString(),
      previous_package_type: closing.package_type,
      previous_start_date: closing.package_start_date,
      previous_end_date: closing.package_end_date,
      previous_carried_lessons: source.carried,
      previous_extra_lessons: movesForward ? closingExtra : 0
    },
    ...(source.extensions || [])
  ];
  const next = {
    package_type: newPackageType,
    package_start_date: newStartDate,
    extra_lessons: movesForward ? addedExtra : closingExtra + addedExtra
  };

  return {
    ...computeRegistrationUsage(next, extensions, source.rows),
    samePackage: !isFreePackage(closing.package_type) && continuesSamePackage(closing, newStartDate)
  };
};

// Seçilen başlangıç tarihi yeni bir paket dönemi başlatıyor mu?
// Başlatmıyorsa (güncel dönemle aynı gün ya da daha erken) ders sayımı sıfırlanmaz ve
// önceki paketin kotası devretmez: kayıt, aynı dönem için ek ödeme ya da deneme dersinin
// pakete çevrilmesidir.
export const startsNewPeriod = (currentPeriodStart, newStartDate) => {
  if (!currentPeriodStart || !newStartDate) return false;
  return startsLaterDay(newStartDate, currentPeriodStart);
};
