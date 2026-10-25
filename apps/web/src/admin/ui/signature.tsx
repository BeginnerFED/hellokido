import type { ReactNode } from 'react'
import { remainingTone, type Usage } from '@hellokido/core/api'
import { initialsOf } from './Bits'
import { cx } from './cx'

/*
 * The panel's small pieces, after the Vizion Menu panel:
 * - a lesson type is a coloured dot before its name;
 * - a package is a thin share bar of the lessons left, amber when it runs low;
 * - a child is a square initials tile, tinted by the attendance it holds;
 * - a lesson's seats are a row of tiles with the count beside them.
 */

/** An age group as plain text; kept as a component so every place words it the same. */
export function AgeTablet({ label, className }: { group?: string; label?: ReactNode; className?: string }) {
  if (label === undefined) return null
  return <span className={cx('inline-block min-w-0 truncate', className)}>{label}</span>
}

const TYPE_DOT: Record<string, string> = {
  duyusal: 'bg-type-duyusal',
  ingilizce: 'bg-type-ingilizce'
}

/** The lesson type's dot. */
export function LessonShape({ type, className }: { type: string; className?: string }) {
  return <span aria-hidden className={cx('inline-block size-2 shrink-0 rounded-full', TYPE_DOT[type] ?? 'bg-type-ozel', className)} />
}

const BAR_WIDTHS = { sm: 'w-[5.25rem]', md: 'w-28', lg: 'w-full' }

/**
 * The lessons left as a share bar: full when the package is new, empty when it is used up.
 * Free packages have no quota and show no bar.
 */
export function BeadString({
  usage,
  size = 'sm',
  label,
  className
}: {
  usage: Usage
  size?: keyof typeof BAR_WIDTHS
  /** What a screen reader hears instead of the bar. */
  label: string
  className?: string
}) {
  if (usage.isFree || usage.total === null) return null
  const total = Math.max(usage.total, 1)
  const left = Math.min(Math.max(usage.remaining ?? 0, 0), total)
  const tone = remainingTone(usage)
  return (
    <span role="img" aria-label={label} className={cx('block h-1.5 shrink-0 overflow-hidden rounded-full bg-track', BAR_WIDTHS[size], className)}>
      <span
        className={cx('block h-full rounded-full', tone === 'low' || tone === 'out' ? 'bg-action' : 'bg-accent')}
        style={{ width: `${Math.round((left / total) * 100)}%` }}
      />
    </span>
  )
}

export type PegSeat = {
  id: string
  name: string
  status: string
  /** Still "scheduled" although the lesson day has passed. */
  overdue?: boolean
}

const holdsSeat = (status: string) => status === 'scheduled' || status === 'makeup' || status === 'attended'

export function pegClass(seat: PegSeat) {
  if (seat.status === 'attended') return 'border-positive-line bg-positive-wash text-positive-ink'
  if (seat.status === 'makeup') return 'border-pink-line bg-pink-wash text-pink-ink'
  // An absence is counted, not a danger: grey
  if (seat.status === 'no_show') return 'border-line bg-well text-ink-3'
  if (seat.status === 'postponed' || seat.status === 'cancelled') return 'border-dashed border-line-strong bg-surface text-ink-3 line-through'
  if (seat.overdue) return 'border-action-line bg-action-wash text-action-ink'
  return 'border-line bg-surface-2 text-ink-2'
}

const PEG_SIZES = {
  sm: 'size-6 rounded-[0.375rem] text-[0.5625rem]',
  md: 'size-9 rounded-tile text-[0.78125rem]',
  lg: 'size-11 rounded-[0.75rem] text-[0.875rem]'
}

/** One child as an initials tile, tinted by their attendance. */
export function Peg({ seat, size = 'md', className }: { seat: PegSeat; size?: keyof typeof PEG_SIZES; className?: string }) {
  return (
    <span title={seat.name} className={cx('grid shrink-0 place-items-center border font-semibold tabular', PEG_SIZES[size], pegClass(seat), className)}>
      {initialsOf(seat.name)}
    </span>
  )
}

/**
 * A lesson's seats: the children holding one as tiles, then the count against the planned six.
 * Children past six get a red outline (the room is planned for six; the database allows ten).
 * Children who gave up their seat follow after a thin rule.
 */
export function SocketBoard({
  seats,
  capacity = 6,
  size = 'sm',
  renderPeg,
  className,
  label
}: {
  seats: PegSeat[]
  capacity?: number
  size?: keyof typeof PEG_SIZES
  renderPeg?: (seat: PegSeat, peg: ReactNode) => ReactNode
  className?: string
  label: string
}) {
  const holders = seats.filter((seat) => holdsSeat(seat.status))
  const others = seats.filter((seat) => !holdsSeat(seat.status))
  const draw = (seat: PegSeat, extra?: string) => {
    const peg = <Peg seat={seat} size={size} className={extra} />
    return <span key={seat.id}>{renderPeg ? renderPeg(seat, peg) : peg}</span>
  }
  return (
    <div role="group" aria-label={label} className={cx('flex flex-wrap items-center gap-1', className)}>
      {holders.map((seat, index) => draw(seat, index >= capacity ? 'outline-2 outline-offset-1 outline-negative' : undefined))}
      {others.length > 0 && (
        <>
          <span aria-hidden className="mx-0.5 h-4 w-px bg-line-strong" />
          {others.map((seat) => draw(seat))}
        </>
      )}
      <span className={cx('ml-1 text-[0.78125rem] tabular', holders.length > capacity ? 'font-medium text-negative-ink' : 'text-ink-3')}>
        {holders.length}/{capacity}
      </span>
    </div>
  )
}
