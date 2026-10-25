import type { Widen } from '../types'

// Words only the iPhone app needs; everything else is shared with the web panel
const tr = {
  periodStart: 'İlk gün',
  periodEnd: 'Son gün',
  clearSearch: 'Aramayı temizle',
  // Archiving asks in the phone's own alert, so the seat question becomes two buttons
  archiveSeats: { one: 'İleri tarihli {count} derste yeri var.', other: 'İleri tarihli {count} derste yeri var.' },
  archiveReleaseHint: 'Derslerden de çıkarırsan yapılmamış derslerdeki yeri boşalır; geçmiş dersler değişmez.',
  archiveRelease: 'Arşive kaldır, derslerden çıkar',
  archiveOnly: 'Yalnızca arşive kaldır',
  // The web's words speak of a wrong address; the phone has none to type
  childMissing: 'Bu çocuğun kaydı bulunamadı.',
  lessonStatus: 'Durumu değiştir',
  paymentActions: 'Ödeme işlemleri',
  // The lesson page acts at once (no save button), so it asks and reports in its own words
  lessonActions: 'Ders işlemleri',
  editLesson: 'Dersi düzenle',
  copyLesson: 'Başka güne kopyala',
  removeChildTitle: '{name} dersten çıkarılsın mı?',
  removeChild: 'Dersten çıkar',
  childRemoved: '{name} dersten çıkarıldı',
  childrenAdded: { one: '{count} çocuk derse eklendi', other: '{count} çocuk derse eklendi' },
  addChildrenCount: { one: '{count} çocuğu ekle', other: '{count} çocuğu ekle' },
  alreadyIn: { one: '{count} çocuk zaten bu derste', other: '{count} çocuk zaten bu derste' },
  removeTheme: 'Konuyu kaldır',
  // "Asked 3 weeks ago" in words of its own: the phone's engine may come without Intl.RelativeTimeFormat
  ago: {
    today: 'bugün',
    yesterday: 'dün',
    days: { one: '{count} gün önce', other: '{count} gün önce' },
    lastWeek: 'geçen hafta',
    weeks: { one: '{count} hafta önce', other: '{count} hafta önce' },
    lastMonth: 'geçen ay',
    months: { one: '{count} ay önce', other: '{count} ay önce' },
    lastYear: 'geçen yıl',
    years: { one: '{count} yıl önce', other: '{count} yıl önce' }
  },
  percent: '%{rate}',
  account: 'Hesap',
  signOutTitle: 'Bu telefonda çıkış yapılsın mı?',
  signOutBody: 'Yeniden girmek için e-posta adresin ve şifren gerekir.',
  version: 'Sürüm'
}

const en: Widen<typeof tr> = {
  periodStart: 'First day',
  periodEnd: 'Last day',
  clearSearch: 'Clear search',
  archiveSeats: { one: 'Holds a seat in {count} upcoming lesson.', other: 'Holds a seat in {count} upcoming lessons.' },
  archiveReleaseHint: 'Freeing the seats takes the child out of lessons still to come; past lessons do not change.',
  archiveRelease: 'Archive and free the seats',
  archiveOnly: 'Archive only',
  childMissing: 'This child’s record could not be found.',
  lessonStatus: 'Change status',
  paymentActions: 'Payment actions',
  lessonActions: 'Lesson actions',
  editLesson: 'Edit lesson',
  copyLesson: 'Copy to another day',
  removeChildTitle: 'Remove {name} from this lesson?',
  removeChild: 'Remove from lesson',
  childRemoved: '{name} was removed from the lesson',
  childrenAdded: { one: '{count} child added to the lesson', other: '{count} children added to the lesson' },
  addChildrenCount: { one: 'Add {count} child', other: 'Add {count} children' },
  alreadyIn: { one: '{count} child is already in this lesson', other: '{count} children are already in this lesson' },
  removeTheme: 'Remove theme',
  ago: {
    today: 'today',
    yesterday: 'yesterday',
    days: { one: '{count} day ago', other: '{count} days ago' },
    lastWeek: 'last week',
    weeks: { one: '{count} week ago', other: '{count} weeks ago' },
    lastMonth: 'last month',
    months: { one: '{count} month ago', other: '{count} months ago' },
    lastYear: 'last year',
    years: { one: '{count} year ago', other: '{count} years ago' }
  },
  percent: '{rate}%',
  account: 'Account',
  signOutTitle: 'Sign out on this phone?',
  signOutBody: 'Signing in again needs your email address and password.',
  version: 'Version'
}

const uk: Widen<typeof tr> = {
  periodStart: 'Перший день',
  periodEnd: 'Останній день',
  clearSearch: 'Очистити пошук',
  archiveSeats: {
    one: 'Має місце на {count} майбутньому занятті.',
    few: 'Має місце на {count} майбутніх заняттях.',
    many: 'Має місце на {count} майбутніх заняттях.',
    other: 'Має місце на {count} майбутнього заняття.'
  },
  archiveReleaseHint: 'Якщо звільнити місця, дитину буде прибрано із занять, які ще не відбулися; минулі заняття не зміняться.',
  archiveRelease: 'В архів і звільнити місця',
  archiveOnly: 'Лише в архів',
  childMissing: 'Запис цієї дитини не знайдено.',
  lessonStatus: 'Змінити статус',
  paymentActions: 'Дії з оплатою',
  lessonActions: 'Дії із заняттям',
  editLesson: 'Редагувати заняття',
  copyLesson: 'Копіювати на інший день',
  removeChildTitle: 'Прибрати {name} з цього заняття?',
  removeChild: 'Прибрати із заняття',
  childRemoved: '{name} прибрано із заняття',
  childrenAdded: {
    one: '{count} дитину додано до заняття',
    few: '{count} дитини додано до заняття',
    many: '{count} дітей додано до заняття',
    other: '{count} дитини додано до заняття'
  },
  addChildrenCount: { one: 'Додати {count} дитину', few: 'Додати {count} дитини', many: 'Додати {count} дітей', other: 'Додати {count} дитини' },
  alreadyIn: {
    one: '{count} дитина вже на цьому занятті',
    few: '{count} дитини вже на цьому занятті',
    many: '{count} дітей вже на цьому занятті',
    other: '{count} дитини вже на цьому занятті'
  },
  removeTheme: 'Прибрати тему',
  ago: {
    today: 'сьогодні',
    yesterday: 'учора',
    days: { one: '{count} день тому', few: '{count} дні тому', many: '{count} днів тому', other: '{count} дня тому' },
    lastWeek: 'минулого тижня',
    weeks: { one: '{count} тиждень тому', few: '{count} тижні тому', many: '{count} тижнів тому', other: '{count} тижня тому' },
    lastMonth: 'минулого місяця',
    months: { one: '{count} місяць тому', few: '{count} місяці тому', many: '{count} місяців тому', other: '{count} місяця тому' },
    lastYear: 'минулого року',
    years: { one: '{count} рік тому', few: '{count} роки тому', many: '{count} років тому', other: '{count} року тому' }
  },
  percent: '{rate}%',
  account: 'Обліковий запис',
  signOutTitle: 'Вийти на цьому телефоні?',
  signOutBody: 'Щоб увійти знову, знадобляться ваша електронна адреса й пароль.',
  version: 'Версія'
}

export const mobile = { tr, en, uk }
