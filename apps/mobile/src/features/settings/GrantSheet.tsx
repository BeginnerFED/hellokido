import { useState } from 'react'
import * as Haptics from 'expo-haptics'
import { grantAdmin } from '@hellokido/core/api'
import { useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { TextField } from '../../ui/Fields'
import { FormGroup } from '../../ui/Screen'
import { SheetScreen, useSheet } from '../../ui/Sheet'
import { useToast } from '../../ui/Toast'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Gives an existing account access to the panel; the account itself is made in the Supabase dashboard. */
export function GrantSheet() {
  const { t, fmt } = useI18n()
  const toast = useToast()
  const refresh = useRefresh()
  // This form draws its own SheetScreen, so the bar's action closes the sheet it is in through this
  const sheet = useSheet()
  const copy = t.settings.access
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)

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
    <SheetScreen
      title={copy.grant}
      subtitle={copy.title}
      dirty={email.trim() !== ''}
      busy={busy}
      action={{ label: copy.grant, disabled: !email.trim(), onPress: () => void grant() }}
    >
      {/* The long label heads the group; the row is all address, as in the phone's own sign-in forms */}
      <FormGroup title={copy.email} footer={copy.body}>
        <TextField
          accessibilityLabel={copy.email}
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
      </FormGroup>
    </SheetScreen>
  )
}
