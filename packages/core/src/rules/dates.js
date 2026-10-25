import { format, startOfWeek } from 'date-fns';

// Tarayıcının yerel saatine göre gün anahtarı ('YYYY-AA-GG').
// toISOString().split('T')[0] UTC gününü verir: Türkiye'de gece 00:00-03:00 arasında
// bir önceki günü döndürür ve "bugün" bilgisi üç saat geç değişir.
export const localDateKey = (date = new Date()) => format(date, 'yyyy-MM-dd');

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// İki tarihin haftaları arasındaki fark, hafta cinsinden (hafta Pazartesi başlar).
// Hedef daha ilerideyse pozitif, aynı haftadaysa 0. Yaz/kış saati geçişindeki bir saatlik
// kayma yuvarlanır. Geçersiz ya da boş tarihte null döner.
export const weeksBetween = (sourceDate, targetDate) => {
  if (!sourceDate || !targetDate) return null;

  const source = startOfWeek(new Date(sourceDate), { weekStartsOn: 1 }).getTime();
  const target = startOfWeek(new Date(targetDate), { weekStartsOn: 1 }).getTime();
  if (Number.isNaN(source) || Number.isNaN(target)) return null;

  return Math.round((target - source) / WEEK_MS);
};
