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
  return (
    <View style={[styles.page, { backgroundColor: c.ground }]}>
      <Icon name="lock" size={34} color={c.ink3} />
      <Text variant="title" align="center" accessibilityRole="header">
        {t.shell.noAccess.title}
      </Text>
      <Text variant="body" tone="ink2" align="center">
        {fmt(t.shell.noAccess.body, { email: user?.email ?? '' })}
      </Text>
      {failed && <Notice tone="negative">{t.shell.signOutFailed}</Notice>}
      <Button variant="tinted" size="lg" onPress={async () => setFailed(!(await signOut()))} style={styles.button}>
        {t.shell.noAccess.signOut}
      </Button>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 28 },
  button: { alignSelf: 'stretch', marginTop: 10 }
})
