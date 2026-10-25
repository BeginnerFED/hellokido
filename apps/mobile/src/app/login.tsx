import { useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type TextInputInstance } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LANGUAGE_NAMES, LOCALES, type Locale, type Messages } from '@hellokido/core/i18n'
import { supabase } from '../lib/supabase'
import { useI18n } from '../providers/I18n'
import { useColors } from '../theme/colors'
import { useScheme } from '../providers/Theme'
import { Notice } from '../ui/Bits'
import { Button } from '../ui/Button'
import { TextField } from '../ui/Fields'
import { Icon } from '../ui/Icon'
import { Card } from '../ui/Screen'
import { Text } from '../ui/Text'

const LOGO = require('../../assets/images/hellokido-logo.svg')
const LOGO_DARK = require('../../assets/images/hellokido-logo-dark.svg')

function readableError(message: string, errors: Messages['login']['errors']) {
  const text = message.toLowerCase()
  if (text.includes('invalid login') || text.includes('invalid email or password')) return errors.invalid
  if (text.includes('not confirmed')) return errors.notConfirmed
  if (text.includes('network') || text.includes('fetch')) return errors.network
  if (text.includes('too many') || text.includes('rate limit')) return errors.tooMany
  return errors.generic
}

export default function Login() {
  const c = useColors()
  const scheme = useScheme()
  const insets = useSafeAreaInsets()
  // A small phone (SE, mini) keeps the form high enough that the button stays above the keyboard
  const compact = useWindowDimensions().height < 740
  const { t, locale, setLocale, fmt } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [shown, setShown] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const passwordRef = useRef<TextInputInstance>(null)

  const fail = (message: string) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    setError(readableError(message, t.login.errors))
  }

  const submit = async () => {
    if (busy || !email.trim() || !password) return
    setBusy(true)
    setError(null)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (signInError) fail(signInError.message)
    } catch (caught) {
      fail(String((caught as Error)?.message ?? ''))
    } finally {
      setBusy(false)
    }
  }

  const chooseLanguage = (code: Locale) => {
    if (code === locale) return
    void Haptics.selectionAsync()
    setLocale(code)
  }

  return (
    <View style={[styles.page, { backgroundColor: c.page }]}>
      {/* The iPhone lifts the form above the keyboard and scrolls the box being typed in into view */}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + (compact ? 24 : 56), paddingBottom: insets.bottom + 20 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        {/* The logo alone, centred over the form: it is the page's heading, read out with what the page is for */}
        <View style={[styles.middle, compact && styles.middleCompact]}>
          <View accessible accessibilityRole="header" accessibilityLabel={`Hello Kido. ${t.login.title}`} style={styles.logoPlace}>
            <Image source={scheme === 'dark' ? LOGO_DARK : LOGO} style={[styles.logo, compact && styles.logoCompact]} contentFit="contain" />
          </View>
          <View style={styles.form}>
            {/* Both boxes in one card, as the phone's own sign-in asks; each box is named by its placeholder */}
            <Card>
              <TextField
                accessibilityLabel={t.login.email}
                placeholder={t.login.email}
                value={email}
                onChangeText={setEmail}
                editable={!busy}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="username"
                keyboardType="email-address"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                submitBehavior="submit"
              />
              <TextField
                ref={passwordRef}
                accessibilityLabel={t.login.password}
                placeholder={t.login.password}
                value={password}
                onChangeText={setPassword}
                editable={!busy}
                secureTextEntry={!shown}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={() => void submit()}
                trailing={
                  <Pressable
                    onPress={() => setShown((value) => !value)}
                    accessibilityRole="button"
                    accessibilityLabel={shown ? t.login.hidePassword : t.login.showPassword}
                    hitSlop={10}
                  >
                    <Text variant="sub" weight="600" tone="accentInk">
                      {shown ? t.login.hidePassword : t.login.showPassword}
                    </Text>
                  </Pressable>
                }
              />
            </Card>
            {/* As every form says it: felt with a red dot, never a red block */}
            {error && (
              <View accessibilityLiveRegion="polite">
                <Notice tone="negative">{error}</Notice>
              </View>
            )}
            <Button variant="primary" size="lg" onPress={() => void submit()} busy={busy} disabled={!email.trim() || !password}>
              {t.login.submit}
            </Button>
          </View>
        </View>
        <View style={styles.footer}>
          <View style={styles.languages} accessibilityRole="radiogroup" accessibilityLabel={t.shell.account.language}>
            <Icon name="language" size={16} color={c.ink3} />
            {LOCALES.map((code) => (
              <Pressable
                key={code}
                onPress={() => chooseLanguage(code)}
                accessibilityRole="radio"
                accessibilityState={{ checked: code === locale }}
                hitSlop={8}
                style={({ pressed }) => [styles.language, code === locale && { backgroundColor: c.felt }, pressed && { opacity: 0.6 }]}
              >
                <Text variant="foot" weight={code === locale ? '600' : '400'} tone={code === locale ? 'ink' : 'ink2'}>
                  {LANGUAGE_NAMES[code]}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text variant="caption" tone="ink3" align="center">
            {fmt(t.login.footer, { year: new Date().getFullYear() })}
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: 24 },
  // The logo centred over the form, both high enough that the button stays above the keyboard; the languages at the foot
  middle: { gap: 36, width: '100%', maxWidth: 420, alignSelf: 'center' },
  middleCompact: { gap: 24 },
  logoPlace: { alignSelf: 'center' },
  form: { gap: 14 },
  // The logo's own proportions (912 × 523)
  logo: { width: 216, height: 124 },
  logoCompact: { width: 160, height: 92 },
  footer: { gap: 14, marginTop: 32, alignItems: 'center' },
  languages: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 6 },
  // Pressed things are pills
  language: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 }
})
