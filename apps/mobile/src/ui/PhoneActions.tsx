import { Linking, StyleSheet, View } from 'react-native'
import { phoneDigits, whatsAppLink } from '@hellokido/core/rules/phone.js'
import { useI18n } from '../providers/I18n'
import { useColors } from '../theme/colors'
import { IconButton } from './Button'

/** Turkish mobiles read in groups (0532 123 45 67); anything else stays as stored. */
export function displayPhone(phone: string | null | undefined) {
  const digits = phoneDigits(phone)
  if (/^05\d{9}$/.test(digits)) return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9)}`
  return phone ?? ''
}

const open = (url: string) => Linking.openURL(url).catch(() => undefined)

/** A ready-made WhatsApp message to a parent; nothing when the number cannot be read as international. */
export function WhatsAppButton({ phone, text, label, onSent }: { phone: string; text: string; label: string; onSent?: () => void }) {
  const c = useColors()
  const chat = whatsAppLink(phone, text)
  if (!chat) return null
  return (
    <IconButton
      icon="chat"
      label={label}
      variant="well"
      color={c.positiveInk}
      onPress={() => {
        onSent?.()
        void open(chat)
      }}
    />
  )
}

/**
 * Call and WhatsApp for a parent; WhatsApp only when the number can be read as international.
 * With `onWhatsApp` the chat button asks what to send instead of opening an empty chat.
 */
export function PhoneActions({ phone, text, size = 40, onWhatsApp, whatsAppLabel }: { phone: string; text?: string; size?: number; onWhatsApp?: () => void; whatsAppLabel?: string }) {
  const c = useColors()
  const { t } = useI18n()
  const digits = phoneDigits(phone)
  const chat = whatsAppLink(phone, text)
  if (!digits) return null
  return (
    <View style={styles.row}>
      <IconButton icon="call" label={t.children.detail.callParent} size={size} onPress={() => void open(`tel:${digits}`)} />
      {chat && (
        <IconButton icon="chat" label={whatsAppLabel ?? t.children.detail.whatsapp} size={size} color={c.positiveInk} onPress={onWhatsApp ?? (() => void open(chat))} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 }
})
