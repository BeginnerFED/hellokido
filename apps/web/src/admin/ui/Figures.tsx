import type { ReactNode } from 'react'
import { Button as AriaButton, Link } from 'react-aria-components'
import { cx } from './cx'

/** Figure tiles side by side: separate felt tiles in a balanced grid. */
export function FigureGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('grid grid-cols-[repeat(auto-fit,minmax(min(12rem,100%),1fr))] gap-3.5', className)}>{children}</div>
}

type FigureProps = {
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  /** A second line under the hint. */
  hint2?: ReactNode
  /** The colour of the dot before the label, as a background class (e.g. `bg-sky`). */
  dot?: string
  /** The figure opens what it counts. */
  onPress?: () => void
  href?: string
  'aria-label'?: string
  className?: string
}

const tileClass =
  '@container relative flex min-w-0 flex-col items-start gap-0.5 rounded-tile bg-quiet px-[1.125rem] py-4 text-left text-ink no-underline outline-none'

/** One tile: a dot and label, the figure (26/600), then up to two lines of context. The whole tile is the button. */
export function Figure({ label, value, hint, hint2, dot, onPress, href, className, ...aria }: FigureProps) {
  const body = (
    <>
      <span className="flex items-center gap-[7px] text-[0.9375rem] leading-5 font-medium text-ink-2">
        {dot && <span aria-hidden className={cx('size-[7px] shrink-0 rounded-full', dot)} />}
        {label}
      </span>
      {/* 26px, shrinking with a narrow tile (two side by side on a phone) so "120.283,95 ₺" never drops its ₺ */}
      <span className="mt-1 text-[length:clamp(1.125rem,14cqi,1.625rem)] leading-8 font-semibold tracking-[-0.02em] tabular">{value}</span>
      {hint && <span className="text-[0.84375rem] leading-[1.125rem] text-ink-3">{hint}</span>}
      {hint2 && <span className="text-[0.84375rem] leading-[1.125rem] text-ink-3">{hint2}</span>}
    </>
  )
  const interactive =
    'transition-[background-color,scale] duration-150 data-hovered:bg-[color-mix(in_oklab,var(--quiet)_94%,var(--ink))] data-pressed:scale-[0.99] data-focus-visible:ring-2 data-focus-visible:ring-focus'
  if (href)
    return (
      <Link href={href} aria-label={aria['aria-label']} className={cx(tileClass, interactive, className)}>
        {body}
      </Link>
    )
  if (onPress)
    return (
      <AriaButton onPress={onPress} aria-label={aria['aria-label']} className={cx(tileClass, interactive, className)}>
        {body}
      </AriaButton>
    )
  return <div className={cx(tileClass, className)}>{body}</div>
}

type TabOption<K extends string> = { id: K; label: string; count?: ReactNode; countTone?: 'muted' | 'action' }

/**
 * Two to four views of one card, as a pill track; the counts ride along in each piece (amber when
 * overdue). `fill` spreads the pieces across the card.
 */
export function CardTabs<K extends string>({
  options,
  value,
  onChange,
  label,
  fill,
  className
}: {
  options: TabOption<K>[]
  value: K
  onChange: (value: K) => void
  label: string
  fill?: boolean
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cx(
        // A phone-wide card can't hold four labels in one track: there the pieces come apart into
        // chips that scroll sideways under the card's edge (pass the card's inset as max-sm padding)
        fill
          ? 'flex w-full gap-1.5 overflow-x-auto py-1 [scrollbar-width:none] sm:gap-0.5 sm:rounded-full sm:bg-track sm:p-[3px]'
          : 'inline-flex shrink-0 gap-0.5 rounded-full bg-track p-[3px]',
        className
      )}
    >
      {options.map((option) => {
        const on = option.id === value
        return (
          <AriaButton
            key={option.id}
            aria-pressed={on}
            onPress={() => onChange(option.id)}
            className={cx(
              'relative inline-flex h-8 shrink-0 items-center justify-center gap-[5px] rounded-full text-sm font-medium whitespace-nowrap outline-none transition-[background-color,color,box-shadow] duration-180 ease-out',
              'pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-1.5',
              'data-focus-visible:ring-2 data-focus-visible:ring-focus data-focus-visible:ring-inset',
              fill ? 'flex-[1_0_auto] px-3.5 sm:px-2.5' : 'px-[0.8125rem]',
              on ? 'bg-raised text-ink shadow-lift' : cx('text-ink-2 data-hovered:text-ink', fill && 'max-sm:bg-track')
            )}
          >
            <span>{option.label}</span>
            {option.count !== undefined && (
              <span className={cx('font-semibold tabular', option.countTone === 'action' ? 'text-amber-ink' : on ? 'text-ink-2' : 'text-ink-3')}>{option.count}</span>
            )}
          </AriaButton>
        )
      })}
    </div>
  )
}
