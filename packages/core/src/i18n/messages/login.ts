import type { Widen } from '../types'

const tr = {
  title: 'Yönetim paneline giriş',
  email: 'E-posta',
  password: 'Şifre',
  showPassword: 'Şifreyi göster',
  hidePassword: 'Şifreyi gizle',
  remember: 'Bu cihazda açık kalsın',
  rememberHint: 'İşaretli değilse sekmeyi kapatınca çıkış yapılır.',
  submit: 'Giriş yap',
  submitting: 'Giriş yapılıyor…',
  footer: 'Hello Kido Oyun Atölyesi © {year}',
  errors: {
    invalid: 'E-posta ya da şifre yanlış.',
    notConfirmed: 'Bu e-posta adresi henüz onaylanmamış.',
    network: 'Sunucuya ulaşılamadı. İnternet bağlantını kontrol et.',
    tooMany: 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.',
    generic: 'Giriş yapılamadı. Biraz sonra tekrar dene.'
  }
}

const en: Widen<typeof tr> = {
  title: 'Sign in to the admin panel',
  email: 'Email',
  password: 'Password',
  showPassword: 'Show password',
  hidePassword: 'Hide password',
  remember: 'Keep me signed in on this device',
  rememberHint: 'If unticked, closing the tab signs you out.',
  submit: 'Sign in',
  submitting: 'Signing in…',
  footer: 'Hello Kido Play Workshop © {year}',
  errors: {
    invalid: 'The email or password is wrong.',
    notConfirmed: 'This email address has not been confirmed yet.',
    network: 'The server could not be reached. Check your internet connection.',
    tooMany: 'Too many attempts. Wait a moment and try again.',
    generic: 'Could not sign in. Try again in a moment.'
  }
}

const uk: Widen<typeof tr> = {
  title: 'Вхід до панелі керування',
  email: 'Ел. пошта',
  password: 'Пароль',
  showPassword: 'Показати пароль',
  hidePassword: 'Сховати пароль',
  remember: 'Залишатися в системі на цьому пристрої',
  rememberHint: 'Якщо не позначено, вихід відбудеться після закриття вкладки.',
  submit: 'Увійти',
  submitting: 'Вхід…',
  footer: 'Hello Kido Ігрова майстерня © {year}',
  errors: {
    invalid: 'Неправильна ел. пошта або пароль.',
    notConfirmed: 'Цю адресу ел. пошти ще не підтверджено.',
    network: 'Не вдалося з’єднатися із сервером. Перевірте підключення до інтернету.',
    tooMany: 'Забагато спроб. Зачекайте трохи й спробуйте знову.',
    generic: 'Не вдалося увійти. Спробуйте трохи пізніше.'
  }
}

export const login = { tr, en, uk }
