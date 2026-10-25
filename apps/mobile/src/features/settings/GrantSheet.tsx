import { useEffect, useState } from 'react'
import * as Haptics from 'expo-haptics'
import { grantAdmin } from '@hellokido/core/api'
import { useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { Button } from '../../ui/Button'
import { TextField } from '../../ui/Fields'
import { SheetActions, SheetScreen, useSheet } from '../../ui/Sheet'
import { useToast } from '../../ui/Toast'
import type { FormState } from '../payment/fields'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const IDLE: FormState = { dirty: false, busy: false }

/** Gives an existing account access to the panel; the account itself is made in the Supabase dashboard. */
export function GrantSheet() {
  const { t } = useI18n()
  const [state, setState] = useState(IDLE)
  return (
    <SheetScreen title={t.settings.access.grant} subtitle={t.settings.access.title} dirty={state.dirty} busy={state.busy}>
      <GrantForm onStateChange={setState} />
    </SheetScreen>
  )
}

function GrantForm({ onStateChange }: { onStateChange: (state: FormState) => void }) {
  const { t, fmt } = useI18n()
  const toast = useToast()
  const refresh = useRefresh()
  const sheet = useSheet()
  const copy = t.settings.access
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)

  useEffect(() => onStateChange({ dirty: email.trim() !== '', busy }), [email, busy, onStateChange])

  const grant = async () => {
    const value = email.trim()
    if (busy || !value) return
    if (!EMAIL.test(value)) {
      setError(copy.emailInvalid)
      return
    }
    setBusy(true)
    setError(undefined)
    try {
      await grantAdmin(value)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      toast({ title: fmt(copy.granted, { email: value }) })
      void refresh.admins()
      sheet.finish()
    } catch (failure) {
      setError(String((failure as Error)?.message).includes('user_not_found') ? copy.userNotFound : copy.grantFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <TextField
        label={copy.email}
        placeholder={copy.emailPlaceholder}
        value={email}
        onChangeText={(text) => {
          setEmail(text)
          setError(undefined)
        }}
        keyboardType="email-address"
        inputMode="email"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        autoFocus
        returnKeyType="done"
        onSubmitEditing={() => void grant()}
        error={error}
      />
      <SheetActions>
        <Button variant="primary" size="lg" disabled={!email.trim()} busy={busy} onPress={() => void grant()}>
          {copy.grant}
        </Button>
      </SheetActions>
    </>
  )
}
