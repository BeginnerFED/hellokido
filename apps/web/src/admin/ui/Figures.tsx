import type { ReactNode } from 'react'
import { Button as AriaButton, Link } from 'react-aria-components'
import { CaretRightIcon } from '@phosphor-icons/react'
import { cx } from './cx'

/** Figures side by side, divided by hairlines, at the top of a card. */
export function FigureGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('grid grid-cols-[repeat(auto-fit,minmax(min(10rem,100%),1fr))] gap-px bg-line', className)}>{children}</div>
}

type FigureProps = {
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  /** The figure opens what it counts. */
  onPress?: () => void
  href?: string
  'aria-label'?: string
}

const cellClass = 'relative flex flex-col gap-1 bg-surface px-4 py-4 text-left text-ink no-underline outline-none sm:px-5 sm:py-[1.125rem]'

/** One figure: a label, a large tabular number and a line of context under it. */
export function Figure({ label, value, hint, onPress, href, ...aria }: FigureProps) {
  const body = (
    <>
      <span className="pr-5 text-[0.84375rem] text-ink-3">{label}</span>
      <span className="text-[1.375rem] leading-tight font-semibold tracking-[-0.02em] tabular sm:text-[1.625rem]">{value}</span>
      {hint && <span className="text-[0.8125rem] text-ink-3">{hint}</span>}
    </>
  )
  const chevron = <CaretRightIcon aria-hidden weight="bold" className="absolute top-5 right-4 size-3.5 text-ink-3 sm:right-[1.125rem]" />
  const interactive = 'transition-colors duration-150 data-hovered:bg-surface-2 data-focus-visible:ring-2 data-focus-visible:ring-focus data-focus-visible:ring-inset'
  if (href)
    return (
      <Link href={href} aria-label={aria['aria-label']} className={cx(cellClass, interactive)}>
        {body}
        {chevron}
      </Link>
    )
  if (onPress)
    return (
      <AriaButton onPress={onPress} aria-label={aria['aria-label']} className={cx(cellClass, interactive)}>
        {body}
        {chevron}
      </AriaButton>
    )
  return <div className={cellClass}>{body}</div>
}

type TabOption<K extends string> = { id: K; label: string; count?: ReactNode; countTone?: 'muted' | 'action' }

/** Two to four views of one card, as a pill track; the counts ride along in each piece. */
export function CardTabs<K extends string>({
  options,
  value,
  onChange,
  label,
  className
}: {
  options: TabOption<K>[]
  value: K
  onChange: (value: K) => void
  label: string
  className?: string
}) {
  return (
    <div role="group" aria-label={label} className={cx('inline-flex shrink-0 gap-0.5 rounded-full bg-well p-1', className)}>
      {options.map((option) => {
        const on = option.id === value
        return (
          <AriaButton
            key={option.id}
            aria-pressed={on}
            onPress={() => onChange(option.id)}
            className={cx(
              'relative inline-flex h-[1.875rem] items-center gap-1.5 rounded-full px-3 text-[0.84375rem] font-medium outline-none transition-[background-color,color,box-shadow] duration-150',
              'pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-1.5',
              'data-focus-visible:ring-2 data-focus-visible:ring-focus',
              on ? 'bg-surface text-ink shadow-piece' : 'text-ink-3 data-hovered:text-ink'
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span className={cx('tabular', option.countTone === 'action' ? 'text-action-ink' : 'text-ink-3')}>{option.count}</span>
            )}
          </AriaButton>
        )
      })}
    </div>
  )
}
