import type { Widen } from '../types'

// The panel's words around the WhatsApp messages. The messages themselves stay Turkish (parents
// read Turkish) and their variables keep their Turkish names in every language.

const tr = {
  title: 'Mesajlar',
  body: 'Velilere WhatsApp’tan giden metinler. Süslü parantezdeki değişkenler her çocuğun bilgisiyle dolar.',
  kinds: {
    lesson: 'Ders hatırlatma',
    payment: 'Ödeme hatırlatma',
    package_end: 'Paket bitişi',
    custom: 'Serbest mesaj'
  },
  kindHints: {
    lesson: 'Yarınki derslerde “Hatırlat” bunu gönderir',
    payment: 'Ödeme bekleyen ailelere gider',
    package_end: 'Paketi biten ya da bitecek ailelere gider',
    custom: 'Çocuğun sayfasından istediğin zaman gönderilir'
  },
  inUse: 'Kullanılıyor',
  add: 'Yeni mesaj',
  workshop: {
    title: 'Atölye bilgileri',
    meta: '{place} · {duration}',
    body: 'Mesajlardaki {yer}, {konum} ve {süre} buradan dolar; değişince bütün mesajlar kendiliğinden güncellenir.',
    place: 'Yer',
    map: 'Konum bağlantısı',
    mapHint: 'Haritalar uygulamasındaki “Paylaş” bağlantısı',
    duration: 'Ders süresi',
    saved: 'Atölye bilgileri kaydedildi.',
    failed: 'Kaydedilemedi. Bağlantını kontrol edip tekrar dene.'
  },
  form: {
    newTitle: 'Yeni mesaj',
    editTitle: 'Mesajı düzenle',
    kind: 'Ne için',
    name: 'Mesajın adı',
    namePlaceholder: 'Örneğin: Kısa ders hatırlatma',
    nameHint: 'Yalnız sen görürsün; listede bu adla durur.',
    text: 'Metin',
    variables: 'Değişken ekle',
    variablesHint: 'Bir değişkene dokun, imlecin olduğu yere eklenir.',
    unknown: 'Tanınmayan değişken: {names}. Mesajda yazıldığı gibi kalır.',
    preview: 'Önizleme',
    previewFor: 'Önizlenecek çocuk',
    previewNote: 'Ders mesajlarında yarın saat 10:00’daki bir ders örnek alınır.',
    noChild: 'Önizleme için kayıtlı çocuk yok.',
    inUseNote: 'Bu metin şu an kullanılıyor.',
    useThis: 'Bunu kullan',
    restore: 'İlk metne dön',
    delete: 'Sil',
    deleteTitle: 'Bu mesaj silinsin mi?',
    deleteBody: 'Silinen mesaj geri gelmez. Daha önce gönderilenler etkilenmez.',
    saved: 'Mesaj kaydedildi.',
    added: 'Mesaj eklendi.',
    deleted: 'Mesaj silindi.',
    nowInUse: 'Artık bu metin kullanılıyor.',
    failed: 'Kaydedilemedi. Bağlantını kontrol edip tekrar dene.',
    notFound: 'Bu mesaj başka bir yerde silinmiş; liste yenilendi.',
    tooLong: 'Metin en fazla 4000 karakter olabilir.'
  },
  variables: {
    veli: 'Veli adı',
    çocuk: 'Çocuk adı',
    tarih: 'Ders tarihi',
    gün: 'Yarın / bugün',
    saat: 'Ders saati',
    ders: 'Ders türü',
    yer: 'Atölye yeri',
    konum: 'Konum bağlantısı',
    süre: 'Ders süresi',
    paket: 'Paket adı',
    kalan: 'Kalan ders',
    bitiş: 'Paket bitişi',
    'bitiş durumu': 'Sona erecek / erdi',
    tutar: 'Beklenen tutar'
  },
  send: {
    button: 'Mesaj gönder',
    label: '{name} ailesine WhatsApp’tan mesaj gönder',
    noPhone: 'Velinin numarası WhatsApp için okunamıyor.',
    history: 'Gönderilen mesajlar',
    historyEmpty: 'Bu aileye panelden henüz mesaj gönderilmedi.',
    manage: 'Mesajları düzenle',
    template: 'Hangi mesaj',
    nextLesson: 'Sonraki ders: {when}',
    noLesson: 'Yaklaşan dersi yok; ders hatırlatması gönderilemez.',
    text: 'Gidecek metin',
    textHint: 'Yalnız bu mesaj için değiştirebilirsin; kayıtlı metin aynı kalır.',
    reset: 'Metni baştan yaz',
    open: 'WhatsApp’ta aç',
    copy: 'Kopyala',
    copied: 'Metin kopyalandı.',
    copyFailed: 'Kopyalanamadı. Metni seçip kendin kopyala.',
    logged: 'Mesaj WhatsApp’ta açıldı ve gönderilenlere eklendi.',
    showAll: 'Tümünü göster',
    blank: 'Kendim yazacağım',
    menuHint: 'Metin WhatsApp’ta hazır açılır; göndermeden önce değiştirebilirsin.'
  },
  inOrder: {
    button: 'Sıradakine gönder',
    label: 'Sıradaki veliye hatırlatma gönder: {name}',
    next: 'Sıradaki: {name}',
    done: 'Herkese hatırlatıldı'
  },
  logFailed: 'Hatırlatma kaydedilemedi; diğer ekranlarda gönderilmemiş görünebilir.',
  undo: 'Gönderilmedi say',
  reminded: {
    today: 'Bugün hatırlatıldı',
    yesterday: 'Dün hatırlatıldı',
    days: { one: '{count} gün önce hatırlatıldı', other: '{count} gün önce hatırlatıldı' }
  },
  evening: {
    channel: 'Ders hatırlatmaları',
    title: 'Yarınki dersler',
    body: { one: '{count} aileye daha hatırlatma gitmedi. Bugün ekranından sırayla gönderebilirsin.', other: '{count} aileye daha hatırlatma gitmedi. Bugün ekranından sırayla gönderebilirsin.' }
  }
}

const en: Widen<typeof tr> = {
  title: 'Messages',
  body: 'The texts parents get on WhatsApp. Variables in braces are filled in with each child’s details.',
  kinds: {
    lesson: 'Lesson reminder',
    payment: 'Payment reminder',
    package_end: 'Package ending',
    custom: 'Free message'
  },
  kindHints: {
    lesson: '“Remind” on tomorrow’s lessons sends this',
    payment: 'Goes to families with a payment due',
    package_end: 'Goes to families whose package ends or has ended',
    custom: 'Sent from a child’s page whenever you like'
  },
  inUse: 'In use',
  add: 'New message',
  workshop: {
    title: 'Workshop details',
    meta: '{place} · {duration}',
    body: '{yer}, {konum} and {süre} in the messages come from here; change them once and every message follows.',
    place: 'Place',
    map: 'Map link',
    mapHint: 'The “Share” link from your maps app',
    duration: 'Lesson length',
    saved: 'Workshop details saved.',
    failed: 'Could not save. Check your connection and try again.'
  },
  form: {
    newTitle: 'New message',
    editTitle: 'Edit message',
    kind: 'Used for',
    name: 'Name',
    namePlaceholder: 'For example: Short lesson reminder',
    nameHint: 'Only you see it; the list shows the message by this name.',
    text: 'Text',
    variables: 'Add a variable',
    variablesHint: 'Tap a variable to put it where the cursor is.',
    unknown: 'Unknown variable: {names}. It stays in the message as written.',
    preview: 'Preview',
    previewFor: 'Preview for',
    previewNote: 'Lesson messages use a lesson tomorrow at 10:00 as the example.',
    noChild: 'There is no registered child to preview with.',
    inUseNote: 'This text is in use now.',
    useThis: 'Use this one',
    restore: 'Back to the original text',
    delete: 'Delete',
    deleteTitle: 'Delete this message?',
    deleteBody: 'A deleted message does not come back. Messages already sent are not affected.',
    saved: 'Message saved.',
    added: 'Message added.',
    deleted: 'Message deleted.',
    nowInUse: 'This text is now in use.',
    failed: 'Could not save. Check your connection and try again.',
    notFound: 'This message was deleted elsewhere; the list was refreshed.',
    tooLong: 'The text can be at most 4000 characters.'
  },
  variables: {
    veli: 'Parent name',
    çocuk: 'Child name',
    tarih: 'Lesson date',
    gün: 'Tomorrow / today',
    saat: 'Lesson time',
    ders: 'Lesson type',
    yer: 'Workshop place',
    konum: 'Map link',
    süre: 'Lesson length',
    paket: 'Package name',
    kalan: 'Lessons left',
    bitiş: 'Package end',
    'bitiş durumu': 'Will end / has ended',
    tutar: 'Amount expected'
  },
  send: {
    button: 'Send a message',
    label: 'Send the family of {name} a WhatsApp message',
    noPhone: 'The parent’s number cannot be read for WhatsApp.',
    history: 'Messages sent',
    historyEmpty: 'No message has been sent to this family from the panel yet.',
    manage: 'Edit messages',
    template: 'Message',
    nextLesson: 'Next lesson: {when}',
    noLesson: 'No lesson coming up, so a lesson reminder cannot be sent.',
    text: 'Text to send',
    textHint: 'Change it for this message only; the saved text stays the same.',
    reset: 'Write the text again',
    open: 'Open in WhatsApp',
    copy: 'Copy',
    copied: 'Text copied.',
    copyFailed: 'Could not copy. Select the text and copy it yourself.',
    logged: 'The message opened in WhatsApp and was added to the messages sent.',
    showAll: 'Show all',
    blank: 'I’ll write it myself',
    menuHint: 'The text opens ready in WhatsApp; you can change it before sending.'
  },
  inOrder: {
    button: 'Send the next one',
    label: 'Send the next parent a reminder: {name}',
    next: 'Next: {name}',
    done: 'Everyone was reminded'
  },
  logFailed: 'The reminder could not be recorded; other screens may show it as not sent.',
  undo: 'Mark as not sent',
  reminded: {
    today: 'Reminded today',
    yesterday: 'Reminded yesterday',
    days: { one: 'Reminded {count} day ago', other: 'Reminded {count} days ago' }
  },
  evening: {
    channel: 'Lesson reminders',
    title: 'Tomorrow’s lessons',
    body: { one: '{count} family has not been reminded yet. Send them in order from Today.', other: '{count} families have not been reminded yet. Send them in order from Today.' }
  }
}

const uk: Widen<typeof tr> = {
  title: 'Повідомлення',
  body: 'Тексти, які батьки отримують у WhatsApp. Змінні у фігурних дужках заповнюються даними кожної дитини.',
  kinds: {
    lesson: 'Нагадування про заняття',
    payment: 'Нагадування про оплату',
    package_end: 'Закінчення пакета',
    custom: 'Довільне повідомлення'
  },
  kindHints: {
    lesson: 'Кнопка «Нагадати» для завтрашніх занять надсилає саме його',
    payment: 'Надходить родинам, які мають оплатити',
    package_end: 'Надходить родинам, чий пакет закінчується або закінчився',
    custom: 'Надсилається зі сторінки дитини будь-коли'
  },
  inUse: 'Використовується',
  add: 'Нове повідомлення',
  workshop: {
    title: 'Дані майстерні',
    meta: '{place} · {duration}',
    body: '{yer}, {konum} і {süre} у повідомленнях беруться звідси; змініть один раз — і всі повідомлення оновляться.',
    place: 'Місце',
    map: 'Посилання на карту',
    mapHint: 'Посилання «Поділитися» з вашого застосунку карт',
    duration: 'Тривалість заняття',
    saved: 'Дані майстерні збережено.',
    failed: 'Не вдалося зберегти. Перевірте з’єднання і спробуйте знову.'
  },
  form: {
    newTitle: 'Нове повідомлення',
    editTitle: 'Редагувати повідомлення',
    kind: 'Для чого',
    name: 'Назва',
    namePlaceholder: 'Наприклад: Коротке нагадування',
    nameHint: 'Бачите лише ви; у списку повідомлення має цю назву.',
    text: 'Текст',
    variables: 'Додати змінну',
    variablesHint: 'Торкніться змінної, щоб вставити її там, де курсор.',
    unknown: 'Невідома змінна: {names}. Вона залишиться в повідомленні як є.',
    preview: 'Попередній перегляд',
    previewFor: 'Перегляд для',
    previewNote: 'Для повідомлень про заняття як приклад береться заняття завтра о 10:00.',
    noChild: 'Немає записаної дитини для перегляду.',
    inUseNote: 'Цей текст зараз використовується.',
    useThis: 'Використовувати цей',
    restore: 'Повернути початковий текст',
    delete: 'Видалити',
    deleteTitle: 'Видалити це повідомлення?',
    deleteBody: 'Видалене повідомлення не повернеться. Уже надіслані це не змінить.',
    saved: 'Повідомлення збережено.',
    added: 'Повідомлення додано.',
    deleted: 'Повідомлення видалено.',
    nowInUse: 'Тепер використовується цей текст.',
    failed: 'Не вдалося зберегти. Перевірте з’єднання і спробуйте знову.',
    notFound: 'Це повідомлення видалили в іншому місці; список оновлено.',
    tooLong: 'Текст може містити щонайбільше 4000 символів.'
  },
  variables: {
    veli: 'Ім’я батьків',
    çocuk: 'Ім’я дитини',
    tarih: 'Дата заняття',
    gün: 'Завтра / сьогодні',
    saat: 'Час заняття',
    ders: 'Тип заняття',
    yer: 'Місце майстерні',
    konum: 'Посилання на карту',
    süre: 'Тривалість заняття',
    paket: 'Назва пакета',
    kalan: 'Залишилось занять',
    bitiş: 'Кінець пакета',
    'bitiş durumu': 'Закінчиться / закінчився',
    tutar: 'Очікувана сума'
  },
  send: {
    button: 'Надіслати повідомлення',
    label: 'Надіслати родині {name} повідомлення у WhatsApp',
    noPhone: 'Номер батьків не вдається прочитати для WhatsApp.',
    history: 'Надіслані повідомлення',
    historyEmpty: 'Цій родині ще не надсилали повідомлень із панелі.',
    manage: 'Редагувати повідомлення',
    template: 'Повідомлення',
    nextLesson: 'Наступне заняття: {when}',
    noLesson: 'Найближчих занять немає, тож нагадування про заняття не надіслати.',
    text: 'Текст до надсилання',
    textHint: 'Змінюйте лише для цього повідомлення; збережений текст не зміниться.',
    reset: 'Написати текст заново',
    open: 'Відкрити у WhatsApp',
    copy: 'Копіювати',
    copied: 'Текст скопійовано.',
    copyFailed: 'Не вдалося скопіювати. Виділіть текст і скопіюйте самі.',
    logged: 'Повідомлення відкрито у WhatsApp і додано до надісланих.',
    showAll: 'Показати всі',
    blank: 'Напишу сам(а)',
    menuHint: 'Текст відкриється у WhatsApp готовим; перед надсиланням його можна змінити.'
  },
  inOrder: {
    button: 'Надіслати наступному',
    label: 'Надіслати нагадування наступним батькам: {name}',
    next: 'Наступні: {name}',
    done: 'Нагадали всім'
  },
  logFailed: 'Не вдалося записати нагадування; на інших екранах воно може виглядати ненадісланим.',
  undo: 'Позначити як ненадіслане',
  reminded: {
    today: 'Нагадали сьогодні',
    yesterday: 'Нагадали вчора',
    days: { one: 'Нагадали {count} день тому', few: 'Нагадали {count} дні тому', many: 'Нагадали {count} днів тому', other: 'Нагадали {count} дня тому' }
  },
  evening: {
    channel: 'Нагадування про заняття',
    title: 'Завтрашні заняття',
    body: {
      one: 'Ще {count} родині не нагадали. Надішліть по черзі з екрана «Сьогодні».',
      few: 'Ще {count} родинам не нагадали. Надішліть по черзі з екрана «Сьогодні».',
      many: 'Ще {count} родинам не нагадали. Надішліть по черзі з екрана «Сьогодні».',
      other: 'Ще {count} родини не нагадали. Надішліть по черзі з екрана «Сьогодні».'
    }
  }
}

export const messages = { tr, en, uk }
