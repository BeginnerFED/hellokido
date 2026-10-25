import { useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, useColorScheme, View, type TextInputInstance } from 'react-native'
import { Image } from 'expo-image'
import { LANGUAGE_NAMES, LOCALES, type Messages } from '@hellokido/core/i18n'
import { supabase } from '../lib/supabase'
import { useI18n } from '../providers/I18n'
import { useColors } from '../theme/colors'
import { Notice } from '../ui/Bits'
import { Button } from '../ui/Button'
import { TextField } from '../ui/Fields'
import { Icon } from '../ui/Icon'
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
  const scheme = useColorScheme()
  const { t, locale, setLocale, fmt } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [shown, setShown] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const passwordRef = useRef<TextInputInstance>(null)

  const submit = async () => {
    if (busy || !email.trim() || !password) return
    setBusy(true)
    setError(null)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (signInError) setError(readableError(signInError.message, t.login.errors))
    } catch (caught) {
      setError(readableError(String((caught as Error)?.message ?? ''), t.login.errors))
    } finally {
      setBusy(false)
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.page, { backgroundColor: c.ground }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          <Image source={scheme === 'dark' ? LOGO_DARK : LOGO} style={styles.logo} contentFit="contain" accessibilityLabel="Hello Kido" />
          <Text variant="title" align="center" accessibilityRole="header" style={styles.title}>
            {t.login.title}
          </Text>
          <TextField
            label={t.login.email}
            value={email}
            onChangeText={setEmail}
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
            label={t.login.password}
            value={password}
            onChangeText={setPassword}
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
          {error && <Notice tone="negative">{error}</Notice>}
          <Button variant="primary" size="lg" onPress={() => void submit()} busy={busy} disabled={!email.trim() || !password}>
            {t.login.submit}
          </Button>
        </View>
        <View style={styles.footer}>
          <View style={styles.languages} accessibilityRole="radiogroup" accessibilityLabel={t.shell.account.language}>
            <Icon name="language" size={16} color={c.ink3} />
            {LOCALES.map((code) => (
              <Pressable
                key={code}
                onPress={() => setLocale(code)}
                accessibilityRole="radio"
                accessibilityState={{ checked: code === locale }}
                hitSlop={8}
                style={({ pressed }) => [styles.language, code === locale && { backgroundColor: c.well }, pressed && { opacity: 0.6 }]}
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
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 96, paddingBottom: 36 },
  form: { gap: 18, width: '100%', maxWidth: 420, alignSelf: 'center' },
  logo: { width: 168, height: 96, alignSelf: 'center', marginBottom: 6 },
  title: { marginBottom: 8 },
  footer: { gap: 14, marginTop: 40, alignItems: 'center' },
  languages: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  language: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 }
})
