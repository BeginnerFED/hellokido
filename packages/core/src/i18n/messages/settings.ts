import type { Widen } from '../types'

const tr = {
  title: 'Ayarlar',
  sections: 'Ayar bölümleri',
  hidden: 'Gizli',
  appearance: {
    title: 'Görünüm',
    body: 'Yalnız bu cihazda geçerli; diğer yönetici kendi cihazında ayrı seçer.',
    theme: 'Tema'
  },
  card: {
    title: 'Kart ödemeleri',
    body: 'Kartla alınan para bankaya birkaç hafta sonra geçer. Gelir-Gider ekranı bankaya geçecek parayı bu iki ayarla hesaplar.',
    days: 'Bankaya geçme süresi',
    daysUnit: 'gün',
    daysInvalid: '0 ile 120 arasında bir gün sayısı yaz.',
    commission: 'Banka komisyonu',
    commissionPlaceholder: 'Örn. 2,49',
    commissionHint: 'Komisyon yoksa 0 bırak.',
    commissionInvalid: '0 ile 100 arasında bir oran yaz (ör. 2,49).',
    example: 'Örnek: bugün kartla alınan {amount}, {date} günü bankaya {net} olarak geçer.',
    saved: 'Kart ayarları kaydedildi',
    failed: 'Kaydedilemedi. Bağlantını kontrol edip tekrar dene.'
  },
  packages: {
    title: 'Paketler',
    body: 'Fiyatı girilen paket, ödeme alırken tutarı kendiliğinden önerir. Kullanılmayan paketi gizleyebilirsin; o paketteki çocuklar etkilenmez.',
    noPrice: 'Fiyat yok',
    form: {
      title: 'Paketi düzenle',
      price: 'Önerilen fiyat',
      priceHint: 'Ödeme alırken bu tutar hazır gelir. Boş bırakırsan tutar önerilmez.',
      active: 'Yeni kayıtlarda göster',
      activeHint: 'Gizlenen paket yeni kayıtta seçilemez; bu paketteki çocuklar olduğu gibi kalır.',
      saved: 'Paket kaydedildi',
      failed: 'Kaydedilemedi; paket değişmedi.',
      notFound: 'Bu paket bulunamadı. Liste yenilendi.'
    }
  },
  names: {
    name: 'Ad',
    tr: 'Türkçe adı',
    en: 'İngilizce adı',
    uk: 'Ukraynaca adı',
    more: 'Başka dillerde ad',
    hint: 'Uygulama İngilizce ya da Ukraynaca kullanılınca görünür. Boş kalırsa orada da Türkçe ad görünür.'
  },
  categories: {
    expenseTitle: 'Gider kategorileri',
    expenseBody: 'Giderler bu türlere ayrılır; Gelir-Gider ekranı paranın nereye gittiğini bunlarla gösterir.',
    incomeTitle: 'Gelir kategorileri',
    incomeBody: 'Paket dışındaki gelirler (etkinlik, doğum günü, satış) bu türlere ayrılır.',
    add: 'Kategori ekle',
    form: {
      newTitle: 'Yeni kategori',
      editTitle: 'Kategoriyi düzenle',
      expenseKind: 'Gider kategorisi',
      incomeKind: 'Gelir kategorisi',
      duplicate: 'Bu adla bir kategori zaten var.',
      active: 'Listelerde göster',
      activeHint: 'Gizlenen kategori yeni kayıtta seçilemez; eski kayıtlarda adı görünmeye devam eder.',
      saved: '“{name}” eklendi',
      updated: 'Kategori kaydedildi',
      failed: 'Kaydedilemedi; hiçbir şey değişmedi.',
      notFound: 'Bu kategori bulunamadı. Liste yenilendi.',
      delete: 'Kategoriyi sil',
      deleteTitle: 'Bu kategori silinsin mi?',
      deleteBody: '“{name}” listeden kalkar. Bir kayıtta kullanıldıysa silinmez, gizlenir.',
      deleted: 'Kategori silindi',
      hiddenInstead: '“{name}” kullanıldığı için silinmedi, gizlendi',
      deleteFailed: 'Silinemedi.'
    }
  },
  monthly: {
    title: 'Aylık giderler',
    body: 'Kira, maaş, faturalar: bir kez tanımla, her ay Gelir-Gider ekranında tek dokunuşla kaydet. Durdurulan gider orada görünmez.'
  },
  access: {
    title: 'Panel erişimi',
    body: 'Panele yalnız bu listedeki hesaplar girebilir.',
    you: 'Sen',
    remove: 'Kaldır',
    removeLabel: '{email}: kaldır',
    removeTitle: 'Erişim kaldırılsın mı?',
    removeBody: '{email} bir daha panele giremez. İstersen sonra yeniden ekleyebilirsin.',
    removed: 'Erişim kaldırıldı',
    removeFailed: 'Erişim kaldırılamadı.',
    cannotRemoveSelf: 'Kendi erişimini kaldıramazsın.',
    email: 'Eklenecek hesabın e-postası',
    emailPlaceholder: 'ornek@eposta.com',
    emailInvalid: 'Geçerli bir e-posta adresi yaz.',
    grant: 'Erişim ver',
    granted: '{email} artık panele girebilir',
    userNotFound: 'Bu e-postayla bir hesap yok. Hesap önce Supabase panelinde açılmalı (Authentication › Users).',
    grantFailed: 'Erişim verilemedi.'
  },
  about: {
    title: 'Uygulama',
    updated: 'Son güncelleme'
  }
}

const en: Widen<typeof tr> = {
  title: 'Settings',
  sections: 'Settings sections',
  hidden: 'Hidden',
  appearance: {
    title: 'Appearance',
    body: 'Applies to this device only; the other admin chooses on their own device.',
    theme: 'Theme'
  },
  card: {
    title: 'Card payments',
    body: 'Money taken by card reaches the bank a few weeks later. The Finance screen works out the money on its way with these two settings.',
    days: 'Time until it reaches the bank',
    daysUnit: 'days',
    daysInvalid: 'Enter a number of days from 0 to 120.',
    commission: 'Bank commission',
    commissionPlaceholder: 'E.g. 2.49',
    commissionHint: 'Leave 0 if there is none.',
    commissionInvalid: 'Enter a rate from 0 to 100 (e.g. 2.49).',
    example: 'Example: {amount} taken by card today reaches the bank on {date} as {net}.',
    saved: 'Card settings saved',
    failed: 'Could not save. Check the connection and try again.'
  },
  packages: {
    title: 'Packages',
    body: 'A package with a price suggests the amount when taking a payment. You can hide a package that is no longer used; children on it are not affected.',
    noPrice: 'No price',
    form: {
      title: 'Edit package',
      price: 'Suggested price',
      priceHint: 'This amount is filled in when taking a payment. Leave it empty and no amount is suggested.',
      active: 'Show for new registrations',
      activeHint: 'A hidden package cannot be picked for a new registration; children on it stay as they are.',
      saved: 'Package saved',
      failed: 'Could not save; the package did not change.',
      notFound: 'This package was not found. The list was refreshed.'
    }
  },
  names: {
    name: 'Name (in Turkish)',
    tr: 'Turkish name',
    en: 'English name',
    uk: 'Ukrainian name',
    more: 'Names in other languages',
    hint: 'Shown when the app is used in English or Ukrainian. Left empty, the Turkish name is shown there too.'
  },
  categories: {
    expenseTitle: 'Expense categories',
    expenseBody: 'Expenses are sorted into these types; the Finance screen shows where the money went by them.',
    incomeTitle: 'Income categories',
    incomeBody: 'Income outside the packages (events, birthday parties, sales) is sorted into these types.',
    add: 'Add a category',
    form: {
      newTitle: 'New category',
      editTitle: 'Edit category',
      expenseKind: 'Expense category',
      incomeKind: 'Income category',
      duplicate: 'A category with this name already exists.',
      active: 'Show in lists',
      activeHint: 'A hidden category cannot be picked for new entries; old entries keep showing its name.',
      saved: '“{name}” was added',
      updated: 'Category saved',
      failed: 'Could not save; nothing changed.',
      notFound: 'This category was not found. The list was refreshed.',
      delete: 'Delete category',
      deleteTitle: 'Delete this category?',
      deleteBody: '“{name}” leaves the list. If an entry uses it, it is hidden instead of deleted.',
      deleted: 'Category deleted',
      hiddenInstead: '“{name}” is in use, so it was hidden instead',
      deleteFailed: 'Could not delete.'
    }
  },
  monthly: {
    title: 'Monthly expenses',
    body: 'Rent, salaries, bills: set them up once, then record each one with a single tap on the Finance screen every month. A paused one does not show there.'
  },
  access: {
    title: 'Panel access',
    body: 'Only the accounts in this list can enter the panel.',
    you: 'You',
    remove: 'Remove',
    removeLabel: 'Remove {email}',
    removeTitle: 'Remove access?',
    removeBody: '{email} will no longer be able to enter the panel. You can add it again later.',
    removed: 'Access removed',
    removeFailed: 'Access could not be removed.',
    cannotRemoveSelf: 'You cannot remove your own access.',
    email: 'Email of the account to add',
    emailPlaceholder: 'name@example.com',
    emailInvalid: 'Enter a valid email address.',
    grant: 'Give access',
    granted: '{email} can now enter the panel',
    userNotFound: 'There is no account with this email. Create it first in the Supabase dashboard (Authentication › Users).',
    grantFailed: 'Access could not be given.'
  },
  about: {
    title: 'App',
    updated: 'Last updated'
  }
}

const uk: Widen<typeof tr> = {
  title: 'Налаштування',
  sections: 'Розділи налаштувань',
  hidden: 'Приховано',
  appearance: {
    title: 'Вигляд',
    body: 'Діє лише на цьому пристрої; інший адміністратор обирає на своєму.',
    theme: 'Режим'
  },
  card: {
    title: 'Оплати карткою',
    body: 'Гроші, отримані карткою, надходять у банк через кілька тижнів. Екран «Фінанси» рахує гроші в дорозі за цими двома налаштуваннями.',
    days: 'Строк надходження в банк',
    daysUnit: 'дн.',
    daysInvalid: 'Вкажіть кількість днів від 0 до 120.',
    commission: 'Комісія банку',
    commissionPlaceholder: 'Напр. 2,49',
    commissionHint: 'Якщо комісії немає, залиште 0.',
    commissionInvalid: 'Вкажіть ставку від 0 до 100 (напр. 2,49).',
    example: 'Приклад: {amount}, отримані карткою сьогодні, надійдуть у банк {date} як {net}.',
    saved: 'Налаштування карток збережено',
    failed: 'Не вдалося зберегти. Перевірте з’єднання і спробуйте ще раз.'
  },
  packages: {
    title: 'Пакети',
    body: 'Пакет із ціною сам підказує суму під час оплати. Пакет, який більше не використовується, можна приховати; діти на ньому не зміняться.',
    noPrice: 'Без ціни',
    form: {
      title: 'Редагувати пакет',
      price: 'Рекомендована ціна',
      priceHint: 'Під час оплати ця сума з’явиться сама. Якщо залишити порожнім, сума не підказується.',
      active: 'Показувати для нових реєстрацій',
      activeHint: 'Прихований пакет не можна вибрати для нової реєстрації; діти на ньому залишаються як є.',
      saved: 'Пакет збережено',
      failed: 'Не вдалося зберегти; пакет не змінився.',
      notFound: 'Цей пакет не знайдено. Список оновлено.'
    }
  },
  names: {
    name: 'Назва (турецькою)',
    tr: 'Назва турецькою',
    en: 'Назва англійською',
    uk: 'Назва українською',
    more: 'Назви іншими мовами',
    hint: 'Показуються, коли застосунок англійською чи українською. Якщо порожньо, там теж показується турецька назва.'
  },
  categories: {
    expenseTitle: 'Категорії витрат',
    expenseBody: 'Витрати розподіляються за цими видами; екран «Фінанси» показує за ними, куди пішли гроші.',
    incomeTitle: 'Категорії доходів',
    incomeBody: 'Доходи поза пакетами (заходи, дні народження, продажі) розподіляються за цими видами.',
    add: 'Додати категорію',
    form: {
      newTitle: 'Нова категорія',
      editTitle: 'Редагувати категорію',
      expenseKind: 'Категорія витрат',
      incomeKind: 'Категорія доходів',
      duplicate: 'Категорія з такою назвою вже є.',
      active: 'Показувати в списках',
      activeHint: 'Приховану категорію не можна вибрати для нових записів; у старих записах її назва залишається.',
      saved: '«{name}» додано',
      updated: 'Категорію збережено',
      failed: 'Не вдалося зберегти; нічого не змінилося.',
      notFound: 'Цю категорію не знайдено. Список оновлено.',
      delete: 'Видалити категорію',
      deleteTitle: 'Видалити цю категорію?',
      deleteBody: '«{name}» зникне зі списку. Якщо її вже використано в записі, її буде приховано, а не видалено.',
      deleted: 'Категорію видалено',
      hiddenInstead: '«{name}» використовується, тому її приховано',
      deleteFailed: 'Не вдалося видалити.'
    }
  },
  monthly: {
    title: 'Щомісячні витрати',
    body: 'Оренда, зарплати, рахунки: визначте один раз, а потім щомісяця записуйте одним дотиком на екрані «Фінанси». Призупинена витрата там не з’являється.'
  },
  access: {
    title: 'Доступ до панелі',
    body: 'До панелі можуть увійти лише облікові записи з цього списку.',
    you: 'Ви',
    remove: 'Прибрати',
    removeLabel: 'Прибрати {email}',
    removeTitle: 'Прибрати доступ?',
    removeBody: '{email} більше не зможе увійти до панелі. Пізніше доступ можна надати знову.',
    removed: 'Доступ прибрано',
    removeFailed: 'Не вдалося прибрати доступ.',
    cannotRemoveSelf: 'Не можна прибрати власний доступ.',
    email: 'Email облікового запису, який треба додати',
    emailPlaceholder: 'name@example.com',
    emailInvalid: 'Вкажіть правильну адресу email.',
    grant: 'Надати доступ',
    granted: '{email} тепер може входити до панелі',
    userNotFound: 'Облікового запису з цим email немає. Спершу створіть його в панелі Supabase (Authentication › Users).',
    grantFailed: 'Не вдалося надати доступ.'
  },
  about: {
    title: 'Застосунок',
    updated: 'Останнє оновлення'
  }
}

export const settings = { tr, en, uk }
