import { PhoneIcon, WhatsappLogoIcon } from '@phosphor-icons/react'
import { phoneDigits, whatsAppLink } from '@hellokido/core/rules/phone.js'
import { useI18n } from '../providers/I18n'
import { IconLink } from './Button'
import { cx } from './cx'

/** Turkish mobiles read in groups (0532 123 45 67); anything else stays as stored. */
export function displayPhone(phone: string | null | undefined) {
  const digits = phoneDigits(phone)
  if (/^05\d{9}$/.test(digits)) return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9)}`
  return phone ?? ''
}

/** A ready-made WhatsApp message to a parent; nothing when the number cannot be read as international. */
export function WhatsAppLink({
  phone,
  text,
  label,
  className,
  onPress
}: {
  phone: string
  text: string
  label: string
  className?: string
  /** Called as the chat opens, e.g. to record the reminder. */
  onPress?: () => void
}) {
  const chat = whatsAppLink(phone, text)
  if (!chat) return null
  return (
    <IconLink href={chat} target="_blank" rel="noopener noreferrer" label={label} variant="secondary" size="sm" className={className} onPress={onPress}>
      <WhatsappLogoIcon aria-hidden className="size-4 text-whatsapp" />
    </IconLink>
  )
}

/** Call and WhatsApp for a parent; WhatsApp only when the number can be read as international. */
export function PhoneActions({ phone, text, className }: { phone: string; text?: string; className?: string }) {
  const { t } = useI18n()
  const digits = phoneDigits(phone)
  const chat = whatsAppLink(phone, text)
  if (!digits) return null
  return (
    <div className={cx('flex items-center gap-1', className)}>
      <IconLink href={`tel:${digits}`} label={t.children.detail.callParent} variant="secondary">
        <PhoneIcon aria-hidden className="size-[1.125rem]" />
      </IconLink>
      {chat && (
        <IconLink href={chat} target="_blank" rel="noopener noreferrer" label={t.children.detail.whatsapp} variant="secondary">
          <WhatsappLogoIcon aria-hidden className="size-[1.125rem] text-whatsapp" />
        </IconLink>
      )}
    </div>
  )
}
