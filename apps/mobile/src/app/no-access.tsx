import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useAuth } from '../providers/Auth'
import { useI18n } from '../providers/I18n'
import { useColors } from '../theme/colors'
import { Notice } from '../ui/Bits'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { Text } from '../ui/Text'

/** Signed in, but the account is not an admin: say so and offer another account. */
export default function NoAccess() {
  const c = useColors()
  const { t, fmt } = useI18n()
  const { user, signOut } = useAuth()
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)

  const leave = async () => {
    if (busy) return
    setBusy(true)
    setFailed(false)
    // On success the sign-in screen takes over; this page goes with it
    const done = await signOut()
    if (!done) {
      setBusy(false)
      setFailed(true)
    }
  }

  return (
    <View style={[styles.page, { backgroundColor: c.ground }]}>
      <View style={styles.body}>
        <View style={[styles.tile, { backgroundColor: c.surface2, borderColor: c.line }]}>
          <Icon name="lock" size={26} color={c.ink2} />
        </View>
        <Text variant="title" align="center" accessibilityRole="header">
          {t.shell.noAccess.title}
        </Text>
        <Text variant="body" tone="ink2" align="center">
          {fmt(t.shell.noAccess.body, { email: user?.email ?? '' })}
        </Text>
        {failed && (
          <Notice tone="negative" style={styles.stretch}>
            {t.shell.signOutFailed}
          </Notice>
        )}
        <Button variant="tinted" size="lg" busy={busy} onPress={() => void leave()} style={[styles.stretch, styles.button]}>
          {t.shell.noAccess.signOut}
        </Button>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  body: { width: '100%', maxWidth: 420, alignItems: 'center', gap: 14 },
  tile: { width: 56, height: 56, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  stretch: { alignSelf: 'stretch' },
  button: { marginTop: 10 }
})
