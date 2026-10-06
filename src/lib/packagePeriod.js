import { differenceInCalendarDays, startOfDay } from 'date-fns';

// Paket dönemi (başlangıç - bitiş) ile ilgili form kuralları.
//
// Ders hakkı yalnızca paket türünden hesaplanır (bkz. lessonUsage.js); tür ile dönem
// birbirini tutmadığında "kalan ders" yanlış çıkar. Kayıtlarda en sık görülen iki hata:
// - Takvimde tek tıklamayla kaydedilen tek günlük "aylık paket" (bitiş seçilmemiş),
// - 3 aylık dönemin "Haftada 1/2 Gün" türüyle ya da paketin "Tek Seferlik" türüyle kalması
//   (uzatma ekranı eski türü hazır getirir).

export const SINGLE_LESSON_PACKAGE = 'tek-seferlik';

// Dönemin gün farkı (aynı gün = 0)
export const periodDays = (startDate, endDate) =>
  differenceInCalendarDays(new Date(endDate), new Date(startDate));

// Bitiş tarihi seçilmemiş mi? Tek seferlik katılım tek gün olabilir; diğer paketlerde
// bitiş, başlangıçtan sonraki bir gün olmalıdır.
export const isMissingPeriodEnd = (packageType, startDate, endDate) => {
  if (!packageType || packageType === 'ucretsiz') return false;
  const days = periodDays(startDate, endDate);
  return packageType === SINGLE_LESSON_PACKAGE ? days < 0 : days < 1;
};

// Tür ile dönem uzunluğu birbirini tutmuyorsa kısa bir uyarı metni döner (engellemez).
// Eşikler kayıtlardan: aylık paketler 15-45 gün, 3 aylık paketler 70+ gün sürüyor.
export const getPeriodTypeHint = (packageType, startDate, endDate, language = 'tr') => {
  if (!packageType || packageType === 'ucretsiz') return null;
  const days = periodDays(startDate, endDate);
  const tr = language === 'tr';

  if (packageType === SINGLE_LESSON_PACKAGE && days > 14) {
    return tr
      ? `Seçilen dönem ${days} gün. Paket alındıysa paket türünü de değiştirin.`
      : `The selected period is ${days} days. If a package was bought, change the package type too.`;
  }
  if (packageType.startsWith('hafta-') && days > 45) {
    return tr
      ? `Seçilen dönem ${days} gün. 3 aylık paketse paket türünü de değiştirin.`
      : `The selected period is ${days} days. If this is a 3-month package, change the package type too.`;
  }
  if (packageType.startsWith('3ay-') && days >= 1 && days < 46) {
    return tr
      ? `Seçilen dönem ${days} gün. Aylık paketse paket türünü de değiştirin.`
      : `The selected period is ${days} days. If this is a monthly package, change the package type too.`;
  }
  return null;
};

// Takvimden gelen tarihi günün başına sabitler (saat bilgisi taşımasın)
export const toDayStart = (date) => startOfDay(new Date(date));
