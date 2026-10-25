import { useState, type FormEvent } from 'react'
import { Form } from 'react-aria-components'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { EyeIcon, EyeSlashIcon } from '@phosphor-icons/react'
import { LANGUAGE_NAMES, LOCALES, type Locale } from '@hellokido/core/i18n'
import { setRememberSession, supabase } from '../../lib/supabase'
import { useAuth } from '../providers/Auth'
import { useI18n } from '../providers/I18n'
import { Logo } from '../ui/Bits'
import { Button, IconButton } from '../ui/Button'
import { Checkbox, Segmented } from '../ui/Choice'
import { TextField } from '../ui/Field'

type LoginErrors = ReturnType<typeof useI18n>['t']['login']['errors']

function readableError(message: string, errors: LoginErrors) {
  const text = message.toLowerCase()
  if (text.includes('invalid login') || text.includes('invalid email or password')) return errors.invalid
  if (text.includes('not confirmed')) return errors.notConfirmed
  if (text.includes('failed to fetch') || text.includes('network')) return errors.network
  if (text.includes('too many') || text.includes('rate limit')) return errors.tooMany
  return errors.generic
}

export default function Login() {
  const { t, fmt, locale, setLocale } = useI18n()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (user && !submitting) return <Navigate to={returnTo} replace />

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    // Must come first: it decides where the new session is stored
    setRememberSession(remember)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setSubmitting(false)
    if (signInError) setError(readableError(signInError.message, t.login.errors))
    else navigate(returnTo, { replace: true })
  }

  return (
    <main className="flex min-h-dvh flex-col bg-ground px-5 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-ink">
      <div className="mx-auto flex w-full max-w-[22rem] flex-1 flex-col justify-center">
        <Logo className="mx-auto w-40" />
        <h1 className="mt-9 text-center text-[1.375rem] font-semibold text-balance">{t.login.title}</h1>
        <Form onSubmit={onSubmit} className="mt-7 flex flex-col gap-4">
          <TextField
            label={t.login.email}
            type="email"
            value={email}
            onChange={setEmail}
            isRequired
            autoComplete="username"
            inputMode="email"
            autoFocus
          />
          <TextField
            label={t.login.password}
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={setPassword}
            isRequired
            autoComplete="current-password"
            endSlot={
              <IconButton
                label={showPassword ? t.login.hidePassword : t.login.showPassword}
                size="sm"
                onPress={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeSlashIcon aria-hidden className="size-[1.125rem]" /> : <EyeIcon aria-hidden className="size-[1.125rem]" />}
              </IconButton>
            }
          />
          <Checkbox isSelected={remember} onChange={setRemember}>
            <span className="block">{t.login.remember}</span>
            <span className="mt-0.5 block text-[0.8125rem] text-ink-3">{t.login.rememberHint}</span>
          </Checkbox>
          {error && (
            <p role="alert" className="rounded-control bg-negative-wash px-3 py-2.5 text-sm text-negative-ink">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" size="lg" isPending={submitting} className="mt-1 w-full">
            {submitting ? t.login.submitting : t.login.submit}
          </Button>
        </Form>
      </div>
      <div className="mx-auto mt-10 flex w-full max-w-[22rem] flex-col items-center gap-4">
        <Segmented<Locale>
          aria-label={t.shell.account.language}
          size="sm"
          value={locale}
          onChange={setLocale}
          options={LOCALES.map((id) => ({ id, label: LANGUAGE_NAMES[id] }))}
        />
        <p className="text-[0.8125rem] text-ink-3">{fmt(t.login.footer, { year: new Date().getFullYear() })}</p>
      </div>
    </main>
  )
}
