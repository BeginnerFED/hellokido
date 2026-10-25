import type { Widen } from '../types'

// Names of the codes stored in the database. The catalogs (package_types, expense_categories,
// income_categories) carry their own names; these are the fallback while they load.
const tr = {
  packages: {
    'tek-seferlik': 'Tek seferlik katılım',
    'hafta-1': 'Haftada 1 gün',
    'hafta-2': 'Haftada 2 gün',
    'hafta-3': 'Haftada 3 gün',
    'hafta-4': 'Haftada 4 gün',
    '3ay-hafta-1': '3 aylık - 12 atölye',
    '3ay-hafta-2': '3 aylık - 24 atölye',
    '3ay-yarim-hafta-1': '3 aylık yarım - 6 atölye',
    '3ay-yarim-hafta-2': '3 aylık yarım - 12 atölye',
    ucretsiz: 'Ücretsiz katılım',
    belirsiz: 'Henüz belli değil'
  } as Record<string, string>,
  methods: {
    banka: 'Banka',
    nakit: 'Nakit',
    kart: 'Kredi kartı',
    belirlenmedi: 'Belirlenmedi'
  } as Record<string, string>,
  paymentStatus: {
    odendi: 'Ödendi',
    beklemede: 'Bekliyor',
    ucretsiz: 'Ücretsiz'
  } as Record<string, string>,
  attendance: {
    scheduled: 'Planlandı',
    attended: 'Katıldı',
    no_show: 'Gelmedi',
    postponed: 'Ertelendi',
    makeup: 'Telafi',
    cancelled: 'İptal'
  } as Record<string, string>,
  lessonTypes: {
    duyusal: 'Duyusal',
    ingilizce: 'İngilizce',
    ozel: 'Özel'
  } as Record<string, string>,
  ageGroups: {
    '12-18 Aylık': '12-18 aylık',
    '16-24 Aylık': '16-24 aylık',
    '18-24 Aylık': '18-24 aylık',
    '24-36 Aylık': '24-36 aylık',
    '30+ Aylık': '30+ aylık',
    '3+ Yaş': '3+ yaş'
  } as Record<string, string>,
  expenseTypes: {
    kira: 'Kira',
    elektrik: 'Elektrik',
    su: 'Su',
    dogalgaz: 'Doğalgaz',
    internet: 'İnternet',
    maas: 'Maaş',
    malzeme: 'Malzeme',
    mutfak: 'Mutfak',
    reklam: 'Reklam',
    filament: 'Filament',
    diger: 'Diğer'
  } as Record<string, string>,
  incomeCategories: {
    etkinlik: 'Etkinlik',
    'dogum-gunu': 'Doğum günü',
    satis: 'Satış',
    diger: 'Diğer'
  } as Record<string, string>,
  waitlistStatus: {
    beklemede: 'Bekliyor',
    'iletisime-gecildi': 'Konuşuldu'
  } as Record<string, string>
}

const en: Widen<typeof tr> = {
  packages: {
    'tek-seferlik': 'One-time visit',
    'hafta-1': '1 day a week',
    'hafta-2': '2 days a week',
    'hafta-3': '3 days a week',
    'hafta-4': '4 days a week',
    '3ay-hafta-1': '3 months - 12 workshops',
    '3ay-hafta-2': '3 months - 24 workshops',
    '3ay-yarim-hafta-1': '3 months, half - 6 workshops',
    '3ay-yarim-hafta-2': '3 months, half - 12 workshops',
    ucretsiz: 'Free',
    belirsiz: 'Not decided yet'
  },
  methods: {
    banka: 'Bank transfer',
    nakit: 'Cash',
    kart: 'Credit card',
    belirlenmedi: 'Not set'
  },
  paymentStatus: {
    odendi: 'Paid',
    beklemede: 'Unpaid',
    ucretsiz: 'Free'
  },
  attendance: {
    scheduled: 'Scheduled',
    attended: 'Attended',
    no_show: 'Absent',
    postponed: 'Postponed',
    makeup: 'Make-up',
    cancelled: 'Cancelled'
  },
  lessonTypes: {
    duyusal: 'Sensory',
    ingilizce: 'English',
    ozel: 'Special'
  },
  ageGroups: {
    '12-18 Aylık': '12-18 months',
    '16-24 Aylık': '16-24 months',
    '18-24 Aylık': '18-24 months',
    '24-36 Aylık': '24-36 months',
    '30+ Aylık': '30+ months',
    '3+ Yaş': '3+ years'
  },
  expenseTypes: {
    kira: 'Rent',
    elektrik: 'Electricity',
    su: 'Water',
    dogalgaz: 'Natural gas',
    internet: 'Internet',
    maas: 'Salary',
    malzeme: 'Materials',
    mutfak: 'Kitchen',
    reklam: 'Advertising',
    filament: 'Filament',
    diger: 'Other'
  },
  incomeCategories: {
    etkinlik: 'Event',
    'dogum-gunu': 'Birthday party',
    satis: 'Sales',
    diger: 'Other'
  },
  waitlistStatus: {
    beklemede: 'Waiting',
    'iletisime-gecildi': 'Contacted'
  }
}

const uk: Widen<typeof tr> = {
  packages: {
    'tek-seferlik': 'Разове відвідування',
    'hafta-1': '1 день на тиждень',
    'hafta-2': '2 дні на тиждень',
    'hafta-3': '3 дні на тиждень',
    'hafta-4': '4 дні на тиждень',
    '3ay-hafta-1': '3 місяці - 12 занять',
    '3ay-hafta-2': '3 місяці - 24 заняття',
    '3ay-yarim-hafta-1': '3 місяці, половина - 6 занять',
    '3ay-yarim-hafta-2': '3 місяці, половина - 12 занять',
    ucretsiz: 'Безкоштовно',
    belirsiz: 'Ще не вирішено'
  },
  methods: {
    banka: 'Банківський переказ',
    nakit: 'Готівка',
    kart: 'Кредитна картка',
    belirlenmedi: 'Не вказано'
  },
  paymentStatus: {
    odendi: 'Оплачено',
    beklemede: 'Не оплачено',
    ucretsiz: 'Безкоштовно'
  },
  attendance: {
    scheduled: 'Заплановано',
    attended: 'Був(ла)',
    no_show: 'Не був(ла)',
    postponed: 'Перенесено',
    makeup: 'Відпрацювання',
    cancelled: 'Скасовано'
  },
  lessonTypes: {
    duyusal: 'Сенсорне',
    ingilizce: 'Англійська',
    ozel: 'Особливе'
  },
  ageGroups: {
    '12-18 Aylık': '12-18 місяців',
    '16-24 Aylık': '16-24 місяці',
    '18-24 Aylık': '18-24 місяці',
    '24-36 Aylık': '24-36 місяців',
    '30+ Aylık': '30+ місяців',
    '3+ Yaş': '3+ роки'
  },
  expenseTypes: {
    kira: 'Оренда',
    elektrik: 'Електроенергія',
    su: 'Вода',
    dogalgaz: 'Газ',
    internet: 'Інтернет',
    maas: 'Зарплата',
    malzeme: 'Матеріали',
    mutfak: 'Кухня',
    reklam: 'Реклама',
    filament: 'Філамент',
    diger: 'Інше'
  },
  incomeCategories: {
    etkinlik: 'Захід',
    'dogum-gunu': 'День народження',
    satis: 'Продаж',
    diger: 'Інше'
  },
  waitlistStatus: {
    beklemede: 'Очікує',
    'iletisime-gecildi': 'Зв’язалися'
  }
}

export const labels = { tr, en, uk }
