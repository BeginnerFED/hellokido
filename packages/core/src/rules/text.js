// Türkçe'ye duyarlı metin yardımcıları.
//
// JavaScript'in varsayılan toUpperCase/toLowerCase'i Türkçe'de yanlıştır: 'i' → 'I',
// 'I' → 'i' ve 'İ' → 'i̇' (i + görünmez birleşik nokta) üretir. Bu yüzden "ipek" yazınca
// "Ipek" kaydediliyor, "İpek" aramada bulunamıyordu.
const TURKISH = 'tr-TR';

// Metnin yalnızca ilk harfini büyütür (notlar, başlıklar)
export const upperFirst = (text) => {
  if (!text) return text;
  return text.charAt(0).toLocaleUpperCase(TURKISH) + text.slice(1);
};

// Ad soyad yazımı: her kelimenin ilk harfi büyük, kalanı küçük ("ipek ışıl" → "İpek Işıl")
export const capitalizeName = (text) => {
  if (!text) return text;
  return text
    .split(' ')
    .map(word => word.charAt(0).toLocaleUpperCase(TURKISH) + word.slice(1).toLocaleLowerCase(TURKISH))
    .join(' ');
};

// Her kelimenin yalnızca ilk harfini büyütür, kalanına dokunmaz ("24 aylık" → "24 Aylık")
export const capitalizeWords = (text) => {
  if (!text) return text;
  return text
    .split(' ')
    .map(word => word.charAt(0).toLocaleUpperCase(TURKISH) + word.slice(1))
    .join(' ');
};

// Aramada karşılaştırma için sadeleştirir: büyük/küçük harf, İ/I/ı/i ve işaretli harfler
// (ç, ğ, ö, ş, ü) fark etmez; baştaki/sondaki boşluk yok sayılır.
// "ipek", "İPEK" ve eski kayıtlardaki "i̇pek" aynı sonucu verir.
export const foldForSearch = (text) =>
  String(text ?? '')
    .toLocaleLowerCase(TURKISH)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/\s+/g, ' ')
    .trim();

// haystack içinde needle geçiyor mu (Türkçe'ye duyarlı, bkz. foldForSearch)
export const matchesSearch = (haystack, needle) =>
  foldForSearch(haystack).includes(foldForSearch(needle));
