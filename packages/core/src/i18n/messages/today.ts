import type { Widen } from '../types'

const tr = {
  title: 'Bugün',
  waiting: { one: '{count} iş seni bekliyor', other: '{count} iş seni bekliyor' },
  nothingWaiting: 'Bekleyen iş yok',
  overview: {
    title: 'Gün özeti',
    body: 'Bugünkü dersler ve bütün kayıtlardan bekleyen işler; bir kutuya tıklayınca oraya gider.',
    lessons: 'Bugünkü dersler',
    running: 'Biri şu an sürüyor',
    attendance: 'Yoklama',
    pastUnmarked: { one: 'Geçmiş derslerden {count} tane girilmedi', other: 'Geçmiş derslerden {count} tane girilmedi' },
    pastDone: 'Geçmiş derslerin hepsi girildi',
    payments: 'Ödeme bekliyor',
    paymentsHint: '{packages} paket, {fees} ek ücret',
    renewals: 'Paket yenileme',
    renewalsEnded: { one: '{count} tanesi bitti', other: '{count} tanesi bitti' },
    renewalsSoon: { one: '{count} tanesi bu hafta bitiyor', other: '{count} tanesi bu hafta bitiyor' },
    none: 'Yok'
  },
  lessonsCard: {
    today: 'Bugün',
    past: 'Girilmemiş',
    which: 'Hangi dersler',
    todayBody: '{day} · yoklamayı satırdan gir',
    pastBody: 'Geçmiş derslerde yoklaması girilmemiş çocuklar',
    child: 'Çocuk',
    package: 'Paket',
    left: 'Kalan ders',
    attendance: 'Yoklama',
    parent: 'Veli',
    marked: '{marked}/{total} girildi',
    done: 'Yoklama tamam',
    later: 'Başlamadı',
    seatsShort: '{count}/{capacity} yer',
    foot: '{marked}/{total} yoklama girildi · işaretlenince kalan ders hemen düşer',
    pastFoot: 'Girilene kadar kalan dersten düşmez · son 30 gün',
    allDone: 'Geçmiş yoklamaların hepsi girildi',
    allDoneBody: 'Kalan dersler çocukların sayfalarında güncellendi.',
    inCalendar: 'Takvimde aç',
    parentOf: 'Veli {name}'
  },
  work: {
    title: 'Ödemeler ve paketler',
    which: 'Hangi işler',
    pay: 'Ödeme',
    renew: 'Yenileme',
    payBody: 'Bekleyen paket ödemeleri ve ek ücretler',
    renewBody: 'Biten ya da 7 gün içinde bitecek paketler',
    payFoot: { one: '{count} aileden ödeme bekleniyor', other: '{count} aileden ödeme bekleniyor' },
    renewFoot: 'Yenilenene ya da arşive kalkana kadar burada',
    package: 'Paket ödemesi',
    dueOn: 'Son gün {date}',
    toFinance: 'Gelir-Gider',
    toChildren: 'Çocuklar'
  },
  lessonsTitle: 'Dersler',
  lessonCount: { one: '{count} ders', other: '{count} ders' },
  childCount: { one: '{count} çocuk', other: '{count} çocuk' },
  noLessons: 'Bugün ders yok',
  noLessonsBody: 'Ders eklemek ya da haftayı planlamak için takvimi aç.',
  openCalendar: 'Takvimi aç',
  lessonsFailed: 'Dersler yüklenemedi.',
  emptyLesson: 'Bu derste henüz çocuk yok.',
  seats: '{count}/{capacity} yer dolu',
  now: 'Şimdi',
  otherStatus: 'Diğer',
  archived: 'Arşivde',
  lessonGone: 'Bu ders başka bir yerde değişmiş; liste yenilendi.',
  strip: {
    label: 'Bekleyen işler',
    payments: { one: '{count} ödeme bekliyor', other: '{count} ödeme bekliyor' },
    ending: { one: '{count} paket yenileme bekliyor', other: '{count} paket yenileme bekliyor' },
    unmarked: { one: '{count} yoklama girilmedi', other: '{count} yoklama girilmedi' }
  },
  unmarked: {
    title: { one: 'Geçmiş derslerde {count} yoklama girilmedi', other: 'Geçmiş derslerde {count} yoklama girilmedi' },
    body: 'Girilene kadar kalan dersten düşmez. Son 30 gün gösterilir.',
    show: 'Göster',
    hide: 'Gizle'
  },
  tomorrow: {
    title: 'Yarın',
    empty: 'Yarın ders yok.',
    remind: 'Hatırlat',
    remindLabel: '{name} için WhatsApp’tan hatırlatma gönder',
    sent: 'Gönderildi',
    progress: '{sent}/{total} hatırlatıldı',
    foot: 'Hatırlatma veliye WhatsApp’tan gider'
  },
  payments: {
    title: 'Ödeme bekleyenler',
    empty: 'Bekleyen ödeme yok.',
    remindLabel: '{name} için ödeme hatırlatması gönder',
    collect: 'Tahsil et',
    expected: '{amount} bekleniyor'
  },
  ending: {
    title: 'Süresi dolan paketler',
    empty: 'Süresi dolan ya da 7 gün içinde dolacak paket yok.',
    remindLabel: '{name} için paket bitiş bilgisi gönder',
    renew: 'Yenile',
    soon: 'Bitmek üzere',
    ended: 'Bitti',
    showMore: { one: '{count} paket daha göster', other: '{count} paket daha göster' }
  }
}

const en: Widen<typeof tr> = {
  title: 'Today',
  waiting: { one: '{count} task is waiting for you', other: '{count} tasks are waiting for you' },
  nothingWaiting: 'Nothing is waiting',
  overview: {
    title: 'The day at a glance',
    body: 'Today’s lessons and what waits across all registrations; select a box to go there.',
    lessons: 'Lessons today',
    running: 'One is running now',
    attendance: 'Attendance',
    pastUnmarked: { one: '{count} from past lessons not marked', other: '{count} from past lessons not marked' },
    pastDone: 'All past lessons are marked',
    payments: 'Payments due',
    paymentsHint: '{packages} packages, {fees} fees',
    renewals: 'Renewals',
    renewalsEnded: { one: '{count} has ended', other: '{count} have ended' },
    renewalsSoon: { one: '{count} ends this week', other: '{count} end this week' },
    none: 'None'
  },
  lessonsCard: {
    today: 'Today',
    past: 'Not marked',
    which: 'Which lessons',
    todayBody: '{day} · mark attendance in the row',
    pastBody: 'Children whose attendance in past lessons is not marked',
    child: 'Child',
    package: 'Package',
    left: 'Lessons left',
    attendance: 'Attendance',
    parent: 'Parent',
    marked: '{marked}/{total} marked',
    done: 'Attendance done',
    later: 'Not started',
    seatsShort: '{count}/{capacity} seats',
    foot: '{marked}/{total} marked · a lesson comes off the package as soon as it is marked',
    pastFoot: 'Not deducted until marked · last 30 days',
    allDone: 'All past attendance is marked',
    allDoneBody: 'Lessons left are up to date on the children’s pages.',
    inCalendar: 'Open in calendar',
    parentOf: 'Parent {name}'
  },
  work: {
    title: 'Payments and packages',
    which: 'Which tasks',
    pay: 'Payments',
    renew: 'Renewals',
    payBody: 'Unpaid packages and expected fees',
    renewBody: 'Packages that ended or end within 7 days',
    payFoot: { one: '{count} family owes a payment', other: '{count} families owe a payment' },
    renewFoot: 'They stay here until renewed or archived',
    package: 'Package payment',
    dueOn: 'Due {date}',
    toFinance: 'Finance',
    toChildren: 'Children'
  },
  lessonsTitle: 'Lessons',
  lessonCount: { one: '{count} lesson', other: '{count} lessons' },
  childCount: { one: '{count} child', other: '{count} children' },
  noLessons: 'No lessons today',
  noLessonsBody: 'Open the calendar to add a lesson or plan the week.',
  openCalendar: 'Open calendar',
  lessonsFailed: 'Could not load the lessons.',
  emptyLesson: 'No children in this lesson yet.',
  seats: '{count}/{capacity} seats taken',
  now: 'Now',
  otherStatus: 'Other',
  archived: 'Archived',
  lessonGone: 'This lesson changed elsewhere; the list was refreshed.',
  strip: {
    label: 'Waiting for you',
    payments: { one: '{count} payment due', other: '{count} payments due' },
    ending: { one: '{count} package to renew', other: '{count} packages to renew' },
    unmarked: { one: '{count} attendance not marked', other: '{count} attendances not marked' }
  },
  unmarked: {
    title: { one: '{count} attendance from past lessons is not marked', other: '{count} attendances from past lessons are not marked' },
    body: 'They are not deducted until marked. The last 30 days are shown.',
    show: 'Show',
    hide: 'Hide'
  },
  tomorrow: {
    title: 'Tomorrow',
    empty: 'No lessons tomorrow.',
    remind: 'Remind',
    remindLabel: 'Send {name} a reminder on WhatsApp',
    sent: 'Sent',
    progress: '{sent}/{total} reminded',
    foot: 'Reminders go to the parent on WhatsApp'
  },
  payments: {
    title: 'Payments due',
    empty: 'No payments due.',
    remindLabel: 'Send a payment reminder for {name}',
    collect: 'Collect',
    expected: '{amount} expected'
  },
  ending: {
    title: 'Packages ending',
    empty: 'No package has ended or ends within 7 days.',
    remindLabel: 'Tell the family of {name} the package ends',
    renew: 'Renew',
    soon: 'Ending soon',
    ended: 'Ended',
    showMore: { one: 'Show {count} more package', other: 'Show {count} more packages' }
  }
}

const uk: Widen<typeof tr> = {
  title: 'Сьогодні',
  waiting: { one: '{count} справа чекає на вас', few: '{count} справи чекають на вас', many: '{count} справ чекають на вас', other: '{count} справи чекає на вас' },
  nothingWaiting: 'Нічого не чекає',
  overview: {
    title: 'Огляд дня',
    body: 'Сьогоднішні заняття і справи з усіх записів; натисніть блок, щоб перейти.',
    lessons: 'Заняття сьогодні',
    running: 'Одне триває зараз',
    attendance: 'Відвідування',
    pastUnmarked: { one: 'Не відмічено з минулих занять: {count}', few: 'Не відмічено з минулих занять: {count}', many: 'Не відмічено з минулих занять: {count}', other: 'Не відмічено з минулих занять: {count}' },
    pastDone: 'Усі минулі заняття відмічено',
    payments: 'Очікують оплати',
    paymentsHint: 'Пакетів: {packages}, зборів: {fees}',
    renewals: 'Поновлення',
    renewalsEnded: { one: 'Закінчився: {count}', few: 'Закінчилися: {count}', many: 'Закінчилися: {count}', other: 'Закінчилися: {count}' },
    renewalsSoon: { one: 'Закінчується цього тижня: {count}', few: 'Закінчуються цього тижня: {count}', many: 'Закінчуються цього тижня: {count}', other: 'Закінчуються цього тижня: {count}' },
    none: 'Немає'
  },
  lessonsCard: {
    today: 'Сьогодні',
    past: 'Не відмічено',
    which: 'Які заняття',
    todayBody: '{day} · відмічайте відвідування в рядку',
    pastBody: 'Діти, чиє відвідування минулих занять не відмічено',
    child: 'Дитина',
    package: 'Пакет',
    left: 'Залишилось занять',
    attendance: 'Відвідування',
    parent: 'Батьки',
    marked: 'Відмічено {marked}/{total}',
    done: 'Відвідування відмічено',
    later: 'Ще не почалося',
    seatsShort: 'Місць {count}/{capacity}',
    foot: 'Відмічено {marked}/{total} · заняття списується одразу після відмітки',
    pastFoot: 'Доки не відмічено, не списується · останні 30 днів',
    allDone: 'Усі минулі відвідування відмічено',
    allDoneBody: 'Залишок занять оновлено на сторінках дітей.',
    inCalendar: 'Відкрити в календарі',
    parentOf: 'Батьки: {name}'
  },
  work: {
    title: 'Оплати й пакети',
    which: 'Які справи',
    pay: 'Оплати',
    renew: 'Поновлення',
    payBody: 'Неоплачені пакети та очікувані збори',
    renewBody: 'Пакети, що закінчилися або закінчаться протягом 7 днів',
    payFoot: { one: 'Оплату очікуємо від {count} родини', few: 'Оплату очікуємо від {count} родин', many: 'Оплату очікуємо від {count} родин', other: 'Оплату очікуємо від {count} родини' },
    renewFoot: 'Залишаються тут, доки їх не поновлять або не перенесуть в архів',
    package: 'Оплата пакета',
    dueOn: 'До {date}',
    toFinance: 'Фінанси',
    toChildren: 'Діти'
  },
  lessonsTitle: 'Заняття',
  lessonCount: { one: '{count} заняття', few: '{count} заняття', many: '{count} занять', other: '{count} заняття' },
  childCount: { one: '{count} дитина', few: '{count} дитини', many: '{count} дітей', other: '{count} дитини' },
  noLessons: 'Сьогодні занять немає',
  noLessonsBody: 'Відкрийте календар, щоб додати заняття або спланувати тиждень.',
  openCalendar: 'Відкрити календар',
  lessonsFailed: 'Не вдалося завантажити заняття.',
  emptyLesson: 'У цьому занятті ще немає дітей.',
  seats: 'Зайнято місць: {count}/{capacity}',
  now: 'Зараз',
  otherStatus: 'Інше',
  archived: 'В архіві',
  lessonGone: 'Це заняття змінили в іншому місці; список оновлено.',
  strip: {
    label: 'Чекає на вас',
    payments: {
      one: '{count} оплата очікується',
      few: '{count} оплати очікуються',
      many: '{count} оплат очікується',
      other: '{count} оплати очікується'
    },
    ending: {
      one: '{count} пакет чекає поновлення',
      few: '{count} пакети чекають поновлення',
      many: '{count} пакетів чекають поновлення',
      other: '{count} пакета чекає поновлення'
    },
    unmarked: {
      one: '{count} відвідування не відмічено',
      few: '{count} відвідування не відмічено',
      many: '{count} відвідувань не відмічено',
      other: '{count} відвідування не відмічено'
    }
  },
  unmarked: {
    title: {
      one: 'Не відмічено відвідування минулих занять: {count}',
      few: 'Не відмічено відвідування минулих занять: {count}',
      many: 'Не відмічено відвідування минулих занять: {count}',
      other: 'Не відмічено відвідування минулих занять: {count}'
    },
    body: 'Доки не відмічено, заняття не списуються. Показано останні 30 днів.',
    show: 'Показати',
    hide: 'Сховати'
  },
  tomorrow: {
    title: 'Завтра',
    empty: 'Завтра занять немає.',
    remind: 'Нагадати',
    remindLabel: 'Надіслати нагадування для {name} у WhatsApp',
    sent: 'Надіслано',
    progress: 'Нагадано: {sent}/{total}',
    foot: 'Нагадування надходить батькам у WhatsApp'
  },
  payments: {
    title: 'Очікують оплати',
    empty: 'Немає очікуваних оплат.',
    remindLabel: 'Надіслати нагадування про оплату для {name}',
    collect: 'Отримати',
    expected: 'Очікується {amount}'
  },
  ending: {
    title: 'Пакети, що закінчуються',
    empty: 'Немає пакетів, що закінчилися або закінчаться протягом 7 днів.',
    remindLabel: 'Повідомити родину {name} про закінчення пакета',
    renew: 'Поновити',
    soon: 'Скоро закінчуються',
    ended: 'Закінчилися',
    showMore: {
      one: 'Показати ще {count} пакет',
      few: 'Показати ще {count} пакети',
      many: 'Показати ще {count} пакетів',
      other: 'Показати ще {count} пакета'
    }
  }
}

export const today = { tr, en, uk }
