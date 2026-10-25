import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../providers/Auth'
import { useI18n } from '../providers/I18n'
import { useToast } from '../providers/Toasts'
import { Logo } from '../ui/Bits'
import { Button } from '../ui/Button'

export function NoAccess() {
  const { t, fmt } = useI18n()
  const { user, signOut } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  return (
    <main className="grid min-h-dvh place-items-center bg-ground px-6 py-12 text-ink">
      <div className="w-full max-w-sm text-center">
        <Logo className="mx-auto w-36" />
        <h1 className="mt-8 text-xl font-semibold text-balance">{t.shell.noAccess.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-2 text-pretty">
          {fmt(t.shell.noAccess.body, { email: user?.email ?? '' })}
        </p>
        <Button
          variant="secondary"
          className="mt-6"
          isPending={busy}
          onPress={async () => {
            setBusy(true)
            const ok = await signOut()
            setBusy(false)
            // On failure the session is still in place, so going to sign-in would be pointless
            if (ok) navigate('/login')
            else toast({ tone: 'error', title: t.shell.signOutFailed })
          }}
        >
          {t.shell.noAccess.signOut}
        </Button>
      </div>
    </main>
  )
}
