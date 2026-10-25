// Telefon numarası yardımcıları.
//
// Numaralar veritabanında yazıldığı gibi durur: çoğu "05xxxxxxxxx", bir kısmı başında
// sıfır olmadan "5xxxxxxxxx", birkaçı ülke koduyla ("90…", yurt dışı "380…").

// Yalnızca rakamlar (aramada ve karşılaştırmada kullanılır)
export const phoneDigits = (phone) => String(phone ?? '').replace(/\D/g, '');

// Kaydederken tek biçime getirir: Türkiye cep numaraları "05xxxxxxxxx" olur
// ("5xxxxxxxxx", "905xxxxxxxxx", "00905xxxxxxxxx" → "05xxxxxxxxx"). Aynı numaranın
// farklı yazımları ayrı numara sayılıp mükerrer kayıt denetiminden kaçıyordu.
// Diğer numaralar (yurt dışı, sabit hat) yalnızca rakamlarıyla, yazıldığı gibi kalır.
export const normalizePhone = (phone) => {
  const digits = phoneDigits(phone);
  if (/^5\d{9}$/.test(digits)) return '0' + digits;
  if (/^905\d{9}$/.test(digits)) return '0' + digits.slice(2);
  if (/^00905\d{9}$/.test(digits)) return '0' + digits.slice(4);
  return digits;
};

// Telefon 10-15 haneli olmalı (5xx…, 05xx…, 905xx… ve yurt dışı numaralar bu aralıktadır)
export const isValidPhone = (phone) => {
  const length = phoneDigits(phone).length;
  return length >= 10 && length <= 15;
};

// WhatsApp bağlantısı için uluslararası numara (başında + olmadan); numara güvenilir
// biçimde çıkarılamıyorsa null.
// Önceden her numaranın başına körlemesine 90 ekleniyordu; ülke koduyla kayıtlı
// numaralarda (ör. 905…, 380…) bağlantı var olmayan bir numaraya gidiyordu.
export const toWhatsAppNumber = (phone) => {
  const raw = String(phone ?? '').trim();
  let digits = phoneDigits(raw);
  if (!digits) return null;

  if (raw.startsWith('+')) {                                             // +90…, +380…
    return digits.length >= 8 && digits.length <= 15 ? digits : null;
  }
  if (digits.startsWith('00')) digits = digits.slice(2);                 // 0090…, 0049…
  if (digits.length === 13 && digits.startsWith('900')) digits = '90' + digits.slice(3); // 90 0532… (iki önek birden)

  if (digits.length === 11 && digits.startsWith('0')) return '90' + digits.slice(1);     // 05321234567
  if (digits.length === 10 && !digits.startsWith('0')) return '90' + digits;             // 5321234567
  if (digits.length === 12 && digits.startsWith('90')) return digits;                    // 905321234567
  // Kendi ülke koduyla yazılmış yurt dışı numarası
  if (digits.length >= 11 && digits.length <= 15 && !digits.startsWith('0') && !digits.startsWith('90')) return digits;
  return null;
};

// WhatsApp sohbet bağlantısı; text verilirse mesaj kutusuna hazır yazılır.
// Numara çıkarılamıyorsa null döner (düğme gösterilmez).
export const whatsAppLink = (phone, text) => {
  const number = toWhatsAppNumber(phone);
  if (!number) return null;

  const base = `https://wa.me/${number}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
};
