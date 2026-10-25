import { useRef, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, View, type TextInputInstance } from 'react-native'
import { capitalFirst, type Names } from '@hellokido/core/view'
import { useI18n } from '../../providers/I18n'
import { useColors } from '../../theme/colors'
import { Mark } from '../../ui/Bits'
import { TextField } from '../../ui/Fields'
import { Icon } from '../../ui/Icon'
import { Text } from '../../ui/Text'

const LANGS = ['tr', 'en', 'uk'] as const

/**
 * The name, in Turkish. English and Ukrainian names wait behind a closed row: empty, they show the
 * Turkish name, so most rows never need them.
 */
export function NameFields({ value, onChange, error, autoFocus }: { value: Names; onChange: (next: Names) => void; error?: string; autoFocus?: boolean }) {
  const c = useColors()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const langs = open ? LANGS : (['tr'] as const)
  // "Next" on the keyboard goes on to the following language; the last one closes the keyboard
  const refs = useRef<Partial<Record<keyof Names, TextInputInstance | null>>>({})
  const field = (lang: keyof Names, extra?: { error?: string; autoFocus?: boolean }) => {
    const next = langs[langs.indexOf(lang as never) + 1]
    return (
      <TextField
        ref={(input) => {
          refs.current[lang] = input
        }}
        label={lang === 'tr' ? t.settings.names.name : t.settings.names[lang]}
        value={value[lang]}
        onChangeText={(typed) => onChange({ ...value, [lang]: capitalFirst(typed, lang) })}
        autoCapitalize="sentences"
        autoComplete="off"
        autoCorrect={false}
        returnKeyType={next ? 'next' : 'done'}
        submitBehavior={next ? 'submit' : 'blurAndSubmit'}
        onSubmitEditing={next ? () => refs.current[next]?.focus() : undefined}
        {...extra}
      />
    )
  }
  return (
    <>
      {field('tr', { error, autoFocus })}
      {open ? (
        <>
          {field('en')}
          <View>
            {field('uk')}
            <Text variant="foot" tone="ink3" style={styles.hint}>
              {t.settings.names.hint}
            </Text>
          </View>
        </>
      ) : (
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityHint={t.settings.names.hint}
          hitSlop={8}
          style={({ pressed }) => [styles.more, pressed && { opacity: 0.6 }]}
        >
          <Text variant="sub" weight="500" tone="accentInk">
            {t.settings.names.more}
          </Text>
          <Icon name="chevronDown" size={12} color={c.accentInk} weight="semibold" />
        </Pressable>
      )}
    </>
  )
}

/** The name of a row in a settings list; a hidden or paused one steps back and says so. A long name wraps once. */
export function SettingTitle({ children, mark }: { children: ReactNode; mark?: string | false }) {
  return (
    <View style={styles.titleLine}>
      <Text variant="body" tone={mark ? 'ink2' : 'ink'} numberOfLines={2} style={styles.shrink}>
        {children}
      </Text>
      {mark && <Mark tone="neutral">{mark}</Mark>}
    </View>
  )
}

const styles = StyleSheet.create({
  hint: { marginTop: 6, paddingHorizontal: 2 },
  more: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 44, marginTop: -8, paddingHorizontal: 2 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shrink: { flexShrink: 1 }
})
