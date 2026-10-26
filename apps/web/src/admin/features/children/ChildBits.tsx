import { remainingTone, type Usage } from '@hellokido/core/api'
import { beadsLabel, remainingText } from '@hellokido/core/view'
import { useI18n } from '../../providers/I18n'
import { BeadString } from '../../ui/signature'
import { cx } from '../../ui/cx'

// The words are shared with the phone app
export { beadsLabel, formatPeriod, lessonsLeftText, remainingText, shortDate } from '@hellokido/core/view'

// Running low and running out both ask for a new package: the colour of things to act on, not of danger
export function remainingClass(usage: Usage | undefined) {
  const tone = remainingTone(usage)
  return tone === 'out' || tone === 'low' ? 'font-semibold text-action-ink' : 'text-ink-2'
}

/**
 * "Veli: Havva Nur" with the name underlined, so the parent reads as a label and a name and never
 * runs into the line before it. The words come from the message ("Veli: {name}").
 */
export function ParentName({ template, name }: { template: string; name: string | null | undefined }) {
  const trimmed = name?.trim()
  if (!trimmed) return null
  const [before = '', after = ''] = template.split('{name}')
  return (
    <>
      {before}
      <span className="underline decoration-1 underline-offset-[3px]">{trimmed}</span>
      {after}
    </>
  )
}

/** The share bar with the remaining count next to it; free participation shows the word instead. */
export function UsageLine({ usage, size = 'sm', className }: { usage: Usage | undefined; size?: 'sm' | 'md'; className?: string }) {
  const i18n = useI18n()
  if (!usage) return <span className={cx('block h-1.5 w-[5.25rem] animate-shimmer rounded-full bg-well', className)} aria-hidden />
  return (
    <span className={cx('flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1', className)}>
      <BeadString usage={usage} size={size} label={beadsLabel(i18n, usage)} />
      <span className={cx('text-[0.8125rem] whitespace-nowrap tabular', usage.isFree ? 'text-ink-3' : remainingClass(usage))}>
        {remainingText(i18n, usage)}
      </span>
    </span>
  )
}
