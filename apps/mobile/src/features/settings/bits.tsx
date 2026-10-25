import { useRef, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, type TextInputInstance } from 'react-native'
import { capitalFirst, type Names } from '@hellokido/core/view'
import { useI18n } from '../../providers/I18n'
import { useColors } from '../../theme/colors'
import { TextField } from '../../ui/Fields'
import { Icon } from '../../ui/Icon'
import { FormGroup } from '../../ui/Screen'
import { Text } from '../../ui/Text'

const LANGS = ['tr', 'en', 'uk'] as const

/**
 * The name, in Turkish, as one group of rows. English and Ukrainian names wait behind a row of their
 * own: empty, they show the Turkish name, so most names never need them. A name already given in
 * another language is shown at once.
 */
export function NameFields({ value, onChange, error, autoFocus }: { value: Names; onChange: (next: Names) => void; error?: string; autoFocus?: boolean }) {
  const c = useColors()
  const { t } = useI18n()
  const [open, setOpen] = useState(() => Boolean(value.en.trim() || value.uk.trim()))
  const langs = open ? LANGS : (['tr'] as const)
  // "Next" on the keyboard goes on to the following language; the last one closes the keyboard
  const refs = useRef<Partial<Record<keyof Names, TextInputInstance | null>>>({})
  const field = (lang: keyof Names, extra?: { error?: string; autoFocus?: boolean }) => {
    const next = langs[langs.indexOf(lang as never) + 1]
    return (
      <TextField
        key={lang}
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
    <FormGroup footer={open ? t.settings.names.hint : undefined}>
      {field('tr', { error, autoFocus })}
      {open ? (
        [field('en'), field('uk')]
      ) : (
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityHint={t.settings.names.hint}
          style={({ pressed }) => [styles.moreRow, pressed && { backgroundColor: c.pressed }]}
        >
          <Text variant="body" tone="accentInk" numberOfLines={2} style={styles.flex}>
            {t.settings.names.more}
          </Text>
          <Icon name="chevronDown" size={13} color={c.accentInk} weight="semibold" />
        </Pressable>
      )}
    </FormGroup>
  )
}

/** The name of a row in a settings list; a hidden or paused one steps back (its subtitle says why). A long name wraps once. */
export function SettingTitle({ children, dimmed }: { children: ReactNode; dimmed?: boolean }) {
  return (
    <Text variant="body" tone={dimmed ? 'ink2' : 'ink'} numberOfLines={2}>
      {children}
    </Text>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  moreRow: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 12 }
})
