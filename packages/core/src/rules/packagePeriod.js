import { addDays, addMonths, startOfDay } from 'date-fns';

// Paketin son günü sorulmaz: atölye kalan derse bakar, aileler paketi çoğu zaman planlanandan
// geç bitirir. Dersler başlangıç gününden, sonraki dönem başlayana dek sayılır (bkz. lessonUsage.js).
//
// Veritabanı yine de bir bitiş günü tutar. Pakete göre başlangıçtan hesaplanır ve hiçbir yerde
// gösterilmez: aylık paket 1 ay, 3 aylık paket (yarım ödemesi de) 3 ay, tek seferlik katılım aynı gün.
// Çok dersli pakette bitiş, başlangıçtan en az iki gün sonra olmalıdır; daha kısa dönem yer tutucu
// sayılır (bkz. getPlaceholderDays).
export const packageEndFor = (packageType, startDate) => {
  const start = startOfDay(new Date(startDate));
  const months = packageType?.startsWith('3ay-') ? 3 : packageType?.startsWith('hafta-') ? 1 : 0;
  return months ? addDays(addMonths(start, months), -1) : start;
};
