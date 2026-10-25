// Ders yaş gruplarının TEK kaynağı.
//
// Bu liste veritabanındaki CHECK kısıtı (events.valid_age_group) ile BİREBİR
// aynı olmak zorunda. Buraya bir grup eklenir/çıkarılırsa mutlaka migration da
// gerekiyor, yoksa kayıt sırasında kısıt hatası alınır.
//
// Sıra alt sınıra göre: 12-18 → 16-24 → 18-24 → 24-36 → 30+ → 3+ Yaş.
// 12-18 / 16-24 / 18-24 aralıklarının örtüşmesi bilinçli: eski dersler kendi
// etiketiyle kalırken yeni kayıtlar 16-24'e açılıyor.
export const AGE_GROUPS = [
  '12-18 Aylık',
  '16-24 Aylık',
  '18-24 Aylık',
  '24-36 Aylık',
  '30+ Aylık',
  '3+ Yaş'
]
