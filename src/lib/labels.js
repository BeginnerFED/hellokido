// Veritabanındaki anahtarların ekranda gösterilen karşılıkları (Türkçe / İngilizce).
//
// Etiketler anahtarın baş harfi büyütülerek üretildiğinde Türkçe karakterler kayboluyordu
// ("Maas", "Diger", "Internet") ve İngilizce arayüzde Türkçe kalıyordu. Tek kaynak burasıdır.

const pick = (labels, key, language) => {
  const pair = labels[key];
  if (!pair) return key ?? '';
  return language === 'tr' ? pair[0] : pair[1];
};

// Gider kategorileri (veritabanındaki expenses.expense_type değerleri, gösterim sırasıyla)
const EXPENSE_TYPE_LABELS = {
  kira: ['Kira', 'Rent'],
  elektrik: ['Elektrik', 'Electricity'],
  su: ['Su', 'Water'],
  dogalgaz: ['Doğalgaz', 'Natural Gas'],
  internet: ['İnternet', 'Internet'],
  maas: ['Maaş', 'Salary'],
  malzeme: ['Malzeme', 'Materials'],
  mutfak: ['Mutfak', 'Kitchen'],
  reklam: ['Reklam', 'Advertising'],
  filament: ['Filament', 'Filament'],
  diger: ['Diğer', 'Other']
};

export const EXPENSE_TYPES = Object.keys(EXPENSE_TYPE_LABELS);

export const expenseTypeLabel = (type, language) => pick(EXPENSE_TYPE_LABELS, type, language);

const PAYMENT_METHOD_LABELS = {
  banka: ['Banka', 'Bank'],
  nakit: ['Nakit', 'Cash'],
  kart: ['Kredi Kartı', 'Credit Card'],
  belirlenmedi: ['Belirlenmedi', 'Not specified']
};

export const paymentMethodLabel = (method, language) => pick(PAYMENT_METHOD_LABELS, method, language);

const PAYMENT_STATUS_LABELS = {
  odendi: ['Ödendi', 'Paid'],
  beklemede: ['Beklemede', 'Pending'],
  ucretsiz: ['Ücretsiz', 'Free']
};

export const paymentStatusLabel = (status, language) => pick(PAYMENT_STATUS_LABELS, status, language);

// Tablolarda kullanılan kısa paket adları
const PACKAGE_SHORT_LABELS = {
  'tek-seferlik': ['Tek Seferlik', 'One Time'],
  'hafta-1': ['Haftada 1', '1 Day/Week'],
  'hafta-2': ['Haftada 2', '2 Days/Week'],
  'hafta-3': ['Haftada 3', '3 Days/Week'],
  'hafta-4': ['Haftada 4', '4 Days/Week'],
  '3ay-hafta-1': ['3 Aylık - 12 Atölye', '3 Months - 12 Workshops'],
  '3ay-hafta-2': ['3 Aylık - 24 Atölye', '3 Months - 24 Workshops'],
  ucretsiz: ['Ücretsiz', 'Free']
};

export const packageShortLabel = (type, language) => pick(PACKAGE_SHORT_LABELS, type, language);
