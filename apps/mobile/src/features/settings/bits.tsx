import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { capitalFirst, type Names } from '@hellokido/core/view'
import { useI18n } from '../../providers/I18n'
import { Mark } from '../../ui/Bits'
import { TextField } from '../../ui/Fields'
import { Text } from '../../ui/Text'

/** A name in the three languages: Turkish is required, the others fall back to it. */
export function NameFields({ value, onChange, error, autoFocus }: { value: Names; onChange: (next: Names) => void; error?: string; autoFocus?: boolean }) {
  const { t } = useI18n()
  const field = (lang: keyof Names, extra?: { error?: string; autoFocus?: boolean }) => (
    <TextField
      label={t.settings.names[lang]}
      value={value[lang]}
      onChangeText={(typed) => onChange({ ...value, [lang]: capitalFirst(typed, lang) })}
      autoCapitalize="sentences"
      autoComplete="off"
      autoCorrect={false}
      returnKeyType="next"
      {...extra}
    />
  )
  return (
    <>
      {field('tr', { error, autoFocus })}
      {field('en')}
      <View>
        {field('uk')}
        <Text variant="foot" tone="ink3" style={styles.hint}>
          {t.settings.names.hint}
        </Text>
      </View>
    </>
  )
}

/** The name of a row in a settings list; a hidden or paused one steps back and says so. */
export function SettingTitle({ children, mark }: { children: ReactNode; mark?: string | false }) {
  return (
    <View style={styles.titleLine}>
      <Text variant="body" tone={mark ? 'ink2' : 'ink'} numberOfLines={1} style={styles.shrink}>
        {children}
      </Text>
      {mark && <Mark tone="neutral">{mark}</Mark>}
    </View>
  )
}

const styles = StyleSheet.create({
  hint: { marginTop: 6, paddingHorizontal: 2 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shrink: { flexShrink: 1 }
})
