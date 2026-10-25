import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { grantAdmin, listAdmins, revokeAdmin, type Admin } from '@hellokido/core/api'
import { keys, useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useToast } from '../../providers/Toasts'
import { initialsOf, LoadError, Mark } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { TextField } from '../../ui/Field'
import { ListSkeleton } from '../finance/bits'
import { SettingList } from './bits'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// "ayse.yilmaz@…" gives "AY", the way the account button shows it
const initialsOfEmail = (email: string) => initialsOf((email.split('@')[0] ?? '').replace(/[._-]+/g, ' '))

const failedWith = (error: unknown, code: string) => String((error as Error)?.message).includes(code)

/**
 * Who may enter the panel. Accounts themselves are made in the Supabase dashboard; here an
 * existing account gets access or loses it.
 */
export function Access() {
  const { t, fmt } = useI18n()
  const toast = useToast()
  const refresh = useRefresh()
  const admins = useQuery({ queryKey: keys.admins, queryFn: listAdmins })
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [granting, setGranting] = useState(false)
  const [removing, setRemoving] = useState<Admin | null>(null)
  const [revoking, setRevoking] = useState(false)
  const copy = t.settings.access

  const grant = async (event: FormEvent) => {
    event.preventDefault()
    const value = email.trim()
    if (granting || !value) return
    if (!EMAIL.test(value)) {
      setError(copy.emailInvalid)
      return
    }
    setGranting(true)
    setError(undefined)
    try {
      await grantAdmin(value)
      toast({ tone: 'success', title: fmt(copy.granted, { email: value }) })
      setEmail('')
    } catch (failure) {
      if (failedWith(failure, 'user_not_found')) setError(copy.userNotFound)
      else toast({ tone: 'error', title: copy.grantFailed })
    } finally {
      setGranting(false)
      void refresh.admins()
    }
  }

  const revoke = async () => {
    if (!removing) return
    setRevoking(true)
    try {
      await revokeAdmin(removing.user_id)
      toast({ tone: 'success', title: copy.removed })
      setRemoving(null)
    } catch (failure) {
      toast({ tone: 'error', title: failedWith(failure, 'cannot_revoke_self') ? copy.cannotRemoveSelf : copy.removeFailed })
    } finally {
      setRevoking(false)
      void refresh.admins()
    }
  }

  return (
    <>
      {admins.isError ? (
        <LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={() => void admins.refetch()} />
      ) : !admins.data ? (
        <ListSkeleton rows={2} />
      ) : (
        <SettingList>
          {admins.data.map((admin) => (
            <li key={admin.user_id} className="flex min-h-14 items-center gap-3 py-2">
              <span
                aria-hidden
                className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-wash-2 text-[0.75rem] font-semibold text-accent-ink"
              >
                {initialsOfEmail(admin.email)}
              </span>
              <span className="min-w-0 flex-1 truncate text-[0.9375rem] text-ink">{admin.email}</span>
              {admin.is_self ? (
                <Mark tone="neutral">{copy.you}</Mark>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="-mr-3 shrink-0 max-lg:h-10"
                  aria-label={fmt(copy.removeLabel, { email: admin.email })}
                  onPress={() => setRemoving(admin)}
                >
                  {copy.remove}
                </Button>
              )}
            </li>
          ))}
        </SettingList>
      )}

      <form onSubmit={(event) => void grant(event)} noValidate className="mt-5 flex max-w-[28rem] flex-col items-start gap-3">
        <TextField
          type="email"
          label={copy.email}
          placeholder={copy.emailPlaceholder}
          value={email}
          onChange={(text) => {
            setEmail(text)
            setError(undefined)
          }}
          inputMode="email"
          autoComplete="off"
          validationBehavior="aria"
          errorMessage={error}
          className="w-full"
        />
        <Button type="submit" variant="secondary" isDisabled={!email.trim()} isPending={granting}>
          {copy.grant}
        </Button>
      </form>

      <ConfirmDialog
        isOpen={removing !== null}
        onOpenChange={(open) => !open && !revoking && setRemoving(null)}
        title={copy.removeTitle}
        body={removing && fmt(copy.removeBody, { email: removing.email })}
        confirmLabel={copy.remove}
        tone="danger"
        isPending={revoking}
        onConfirm={() => void revoke()}
      />
    </>
  )
}
