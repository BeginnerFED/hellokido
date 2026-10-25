// Para tutarı girişleri.
//
// Tutar kutularına hem "4.450" (Türkçe binlik ayraç) hem "35.97" / "35,97" (kuruş) yazılıyor.
// parseFloat noktayı her zaman ondalık saydığı için "4.450" girişi 4,45 ₺ olarak
// kaydediliyordu (1000 kat küçük). Buradaki kural:
// - Hem nokta hem virgül varsa: en sondaki ondalık ayraçtır ("1.234,56" ve "1,234.56").
// - Aynı ayraç birden çok kez geçiyorsa: binlik ayraçtır ("1.234.567").
// - Tek ayraç ve ardından TAM 3 rakam varsa: binlik ayraçtır ("4.450" → 4450).
//   Lira tutarlarında 3 ondalık hane kullanılmaz. ("0.500" gibi sıfırla başlayan giriş
//   binlik gruplama olamayacağı için ondalık sayılır.)
// - Diğer durumlarda ayraç ondalıktır ("35.97", "12,5").
// Geçersiz ya da boş girişte null döner.
export const parseAmount = (input) => {
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  if (typeof input !== 'string') return null;

  const text = input.replace(/[\s₺]/g, '').replace(/tl$/i, '');
  if (!/^\d[\d.,]*$|^[.,]\d+$/.test(text)) return null;

  const dots = (text.match(/\./g) || []).length;
  const commas = (text.match(/,/g) || []).length;
  let normalized;

  if (dots > 0 && commas > 0) {
    // En sondaki ayraç ondalık, diğeri binlik
    const decimal = text.lastIndexOf('.') > text.lastIndexOf(',') ? '.' : ',';
    const thousands = decimal === '.' ? ',' : '.';
    if (text.split(decimal).length !== 2) return null;
    normalized = text.split(thousands).join('').replace(decimal, '.');
  } else if (dots + commas > 1) {
    // Aynı ayraç birden çok kez: yalnızca düzgün binlik gruplama kabul edilir
    if (!/^[1-9]\d{0,2}([.,]\d{3})+$/.test(text)) return null;
    normalized = text.replace(/[.,]/g, '');
  } else if (dots + commas === 1) {
    normalized = /^[1-9]\d{0,2}[.,]\d{3}$/.test(text)
      ? text.replace(/[.,]/, '')
      : text.replace(',', '.');
  } else {
    normalized = text;
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
};

// Formlarda "geçerli bir tutar girildi mi" kontrolü (0 dahil, negatif hariç).
export const isValidAmount = (input) => {
  const value = parseAmount(input);
  return value !== null && value >= 0;
};

// Tahsil edilmiş ödeme / gider tutarı: sıfırdan büyük olmalı.
export const isPositiveAmount = (input) => {
  const value = parseAmount(input);
  return value !== null && value > 0;
};

// Tutar kutusuna yalnızca rakam, nokta ve virgül yazılabilir (yapıştırılan "₺5.000 TL" → "5.000").
export const sanitizeAmountInput = (text) => String(text ?? '').replace(/[^\d.,]/g, '');

// Tutarı Türkçe yazımla gösterir: 13850 → "13.850", 13.85 → "13,85". Kart ve listelerde
// ham sayı basıldığında 13.85 ile 13850 birbirine karışıyordu.
const moneyFormatter = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });
export const formatMoney = (value) => {
  const number = Number(value);
  if (value === null || value === undefined || value === '' || !Number.isFinite(number)) return '0';
  return moneyFormatter.format(number);
};

// Kayıtlı bir tutarı düzenleme kutusuna geri yazarken kullanılır: yeniden okunduğunda
// aynı değeri veren, binlik ayraçsız ve virgüllü yazım ("4450", "35,97").
// Kuruşa yuvarlanır; böylece ayraçtan sonra 3 hane oluşup binlik sanılamaz.
export const formatAmountForInput = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return String(Math.round(number * 100) / 100).replace('.', ',');
};
