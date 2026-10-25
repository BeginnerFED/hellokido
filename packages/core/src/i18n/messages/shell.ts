import type { Widen } from '../types'

const tr = {
  nav: {
    today: 'Bugün',
    calendar: 'Takvim',
    children: 'Çocuklar',
    finance: 'Gelir-Gider',
    waitlist: 'Bekleme listesi',
    notes: 'Notlar',
    settings: 'Ayarlar',
    main: 'Ana menü',
    more: 'Diğer',
    root: 'Panel',
    crumbs: 'Bulunduğun yer',
    collapse: 'Menüyü daralt',
    expand: 'Menüyü genişlet'
  },
  workshop: 'HelloKido Atölye',
  role: 'Yönetici',
  quickAdd: {
    button: 'Yeni',
    title: 'Hızlı ekle',
    payment: 'Ödeme al',
    expense: 'Gider ekle',
    income: 'Başka gelir ekle',
    registration: 'Yeni kayıt',
    lesson: 'Ders ekle',
    note: 'Not yaz',
    waitlist: 'Bekleme listesine ekle'
  },
  palette: {
    open: 'Ara ya da bir işe git',
    placeholder: 'Çocuk, veli, telefon ya da bir iş yaz…',
    pages: 'Sayfalar',
    actions: 'İşler',
    people: 'Çocuklar',
    hint: 'Gitmek için Enter, kapatmak için Esc',
    shortcut: 'Ctrl K'
  },
  account: {
    signedInAs: '{email} ile giriş yapıldı',
    signOut: 'Çıkış yap',
    theme: 'Görünüm',
    themeLight: 'Açık',
    themeDark: 'Koyu',
    themeSystem: 'Cihaza göre',
    language: 'Dil',
    open: 'Hesap'
  },
  signOutFailed: 'Çıkış yapılamadı. Bağlantını kontrol edip tekrar dene.',
  offline: 'İnternet bağlantısı yok. Bağlantı gelince bilgiler kendiliğinden yenilenir.',
  errors: {
    title: 'Bir şeyler ters gitti',
    body: 'Bu sayfa açılırken bir hata oldu. Sayfayı yenilemek çoğu zaman yeter; girdiğin kayıtlar kaybolmaz.',
    reload: 'Sayfayı yenile',
    notFound: 'Bu sayfa bulunamadı'
  },
  noAccess: {
    title: 'Bu hesabın panele erişimi yok',
    body: '{email} ile giriş yaptın ama bu hesap henüz yönetici değil. Bir yöneticiden Ayarlar › Erişim bölümünden seni eklemesini iste.',
    signOut: 'Başka bir hesapla giriş yap'
  }
}

const en: Widen<typeof tr> = {
  nav: {
    today: 'Today',
    calendar: 'Calendar',
    children: 'Children',
    finance: 'Finance',
    waitlist: 'Waitlist',
    notes: 'Notes',
    settings: 'Settings',
    main: 'Main menu',
    more: 'More',
    root: 'Panel',
    crumbs: 'You are here',
    collapse: 'Collapse the menu',
    expand: 'Expand the menu'
  },
  workshop: 'HelloKido Workshop',
  role: 'Admin',
  quickAdd: {
    button: 'New',
    title: 'Quick add',
    payment: 'Take a payment',
    expense: 'Add an expense',
    income: 'Add other income',
    registration: 'New registration',
    lesson: 'Add a lesson',
    note: 'Write a note',
    waitlist: 'Add to the waitlist'
  },
  palette: {
    open: 'Search or jump to a task',
    placeholder: 'Type a child, parent, phone or a task…',
    pages: 'Pages',
    actions: 'Tasks',
    people: 'Children',
    hint: 'Enter to go, Esc to close',
    shortcut: 'Ctrl K'
  },
  account: {
    signedInAs: 'Signed in as {email}',
    signOut: 'Sign out',
    theme: 'Appearance',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeSystem: 'Match device',
    language: 'Language',
    open: 'Account'
  },
  signOutFailed: 'Could not sign out. Check your connection and try again.',
  offline: 'No internet connection. Everything refreshes by itself once you are back online.',
  errors: {
    title: 'Something went wrong',
    body: 'This page hit an error while opening. Reloading usually fixes it; nothing you saved is lost.',
    reload: 'Reload the page',
    notFound: 'Page not found'
  },
  noAccess: {
    title: 'This account has no access to the panel',
    body: 'You signed in as {email}, but this account is not an admin yet. Ask an admin to add you under Settings › Access.',
    signOut: 'Sign in with another account'
  }
}

const uk: Widen<typeof tr> = {
  nav: {
    today: 'Сьогодні',
    calendar: 'Календар',
    children: 'Діти',
    finance: 'Фінанси',
    waitlist: 'Список очікування',
    notes: 'Нотатки',
    settings: 'Налаштування',
    main: 'Головне меню',
    more: 'Ще',
    root: 'Панель',
    crumbs: 'Ви тут',
    collapse: 'Згорнути меню',
    expand: 'Розгорнути меню'
  },
  workshop: 'Майстерня HelloKido',
  role: 'Адміністратор',
  quickAdd: {
    button: 'Нове',
    title: 'Швидко додати',
    payment: 'Прийняти оплату',
    expense: 'Додати витрату',
    income: 'Додати інший дохід',
    registration: 'Новий запис',
    lesson: 'Додати заняття',
    note: 'Написати нотатку',
    waitlist: 'Додати до списку очікування'
  },
  palette: {
    open: 'Пошук або перехід до дії',
    placeholder: 'Введіть дитину, батьків, телефон або дію…',
    pages: 'Сторінки',
    actions: 'Дії',
    people: 'Діти',
    hint: 'Enter — перейти, Esc — закрити',
    shortcut: 'Ctrl K'
  },
  account: {
    signedInAs: 'Ви увійшли як {email}',
    signOut: 'Вийти',
    theme: 'Вигляд',
    themeLight: 'Світлий',
    themeDark: 'Темний',
    themeSystem: 'Як у системі',
    language: 'Мова',
    open: 'Обліковий запис'
  },
  signOutFailed: 'Не вдалося вийти. Перевірте з’єднання і спробуйте знову.',
  offline: 'Немає з’єднання з інтернетом. Дані оновляться самі, щойно з’єднання повернеться.',
  errors: {
    title: 'Щось пішло не так',
    body: 'Під час відкриття сторінки сталася помилка. Зазвичай допомагає оновлення сторінки; збережені записи не зникнуть.',
    reload: 'Оновити сторінку',
    notFound: 'Сторінку не знайдено'
  },
  noAccess: {
    title: 'Цей обліковий запис не має доступу до панелі',
    body: 'Ви увійшли як {email}, але цей обліковий запис ще не є адміністратором. Попросіть адміністратора додати вас у розділі Налаштування › Доступ.',
    signOut: 'Увійти з іншим обліковим записом'
  }
}

export const shell = { tr, en, uk }
