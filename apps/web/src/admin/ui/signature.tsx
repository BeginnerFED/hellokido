import type { CSSProperties, ReactNode } from 'react'
import { CheckIcon } from '@phosphor-icons/react'
import { remainingTone, type Usage } from '@hellokido/core/api'
import { initialsOf } from './Bits'
import { cx } from './cx'

/*
 * The board's small pieces:
 * - a lesson type is a shape in its colour (İngilizce circle, Duyusal rounded square, Özel diamond),
 *   so the types read without colour too; a type's card takes its felt (`typeClass`);
 * - a package is a row of beads, one per lesson;
 * - a lesson's seats are dots, filled for each child holding one.
 */

export type LessonTone = 'sky' | 'sun' | 'pink'

/** The felt a lesson type is made of: ingilizce sky, duyusal sun, everything else (özel) pink. */
export function typeTone(type: string): LessonTone {
  return type === 'ingilizce' ? 'sky' : type === 'duyusal' ? 'sun' : 'pink'
}

/**
 * The class that gives an element the type's material through four variables
 * (--t-felt, --t-ink, --t-track, --t-mid). Use with `bg-(--t-felt) text-(--t-ink)`.
 */
export function typeClass(type: string) {
  return `type-${typeTone(type)}`
}

/** An age group as plain text; kept as a component so every place words it the same. */
export function AgeTablet({ label, className }: { group?: string; label?: ReactNode; className?: string }) {
  if (label === undefined) return null
  return <span className={cx('inline-block min-w-0 truncate', className)}>{label}</span>
}

const SHAPE_COLOUR: Record<LessonTone, string> = { sky: 'bg-sky', sun: 'bg-sun', pink: 'bg-pink' }

/** The lesson type's shape: 10px in text (`sm`), 18px on tiles (`md`). */
export function LessonShape({ type, size = 'sm', className }: { type: string; size?: 'sm' | 'md'; className?: string }) {
  const tone = typeTone(type)
  const box = size === 'md' ? 'size-[1.125rem]' : 'size-2.5'
  return (
    <span
      aria-hidden
      className={cx(
        'inline-block shrink-0',
        box,
        SHAPE_COLOUR[tone],
        tone === 'sky' && 'rounded-full',
        tone === 'sun' && (size === 'md' ? 'rounded-[5px]' : 'rounded-[3px]'),
        tone === 'pink' && 'scale-[0.86] rotate-45 rounded-[2px]',
        className
      )}
    />
  )
}

const BAR_WIDTHS = { sm: 'w-[5.25rem]', md: 'w-28', lg: 'w-full' }

/**
 * The lessons left as a share bar: full when the package is new, empty when it is used up.
 * Free packages have no quota and show no bar. (Pages on the board use `Beads` or `MiniBeads`.)
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
        className={cx('block h-full rounded-full', tone === 'low' || tone === 'out' ? 'bg-amber' : 'bg-sky')}
        style={{ width: `${Math.round((left / total) * 100)}%` }}
      />
    </span>
  )
}

/**
 * A package as beads, one 26px pill per lesson: attended green with a check, missed grey, still
 * to come a ring. Free packages and packages without a quota show nothing. `fill` spreads the
 * beads across the row in even columns (the child's package card), wrapping when there are many.
 */
export function Beads({ usage, label, className, fill }: { usage: Usage; label: string; className?: string; fill?: boolean }) {
  if (usage.isFree || usage.total === null) return null
  const total = Math.max(usage.total, 0)
  const attended = Math.min(usage.attended, total)
  const missed = Math.min(usage.noShow, total - attended)
  const beads = Array.from({ length: total }, (_, index) => (index < attended ? 'yes' : index < attended + missed ? 'no' : 'planned'))
  return (
    <span
      role="img"
      aria-label={label}
      className={cx(fill ? 'grid grid-cols-[repeat(auto-fill,minmax(1.375rem,1fr))] gap-[7px]' : 'flex flex-wrap gap-[7px]', className)}
    >
      {beads.map((kind, index) => (
        <span
          key={index}
          className={cx(
            'grid h-[1.625rem] place-items-center rounded-full',
            fill ? 'w-full' : 'w-10',
            kind === 'yes' && 'bg-green text-white dark:text-page',
            kind === 'no' && 'bg-mute',
            kind === 'planned' && 'shadow-[inset_0_0_0_1.5px_var(--mute)]'
          )}
        >
          {kind === 'yes' && <CheckIcon weight="bold" className="size-3.5" />}
        </span>
      ))}
    </span>
  )
}

/**
 * The lessons left in a table row: a 9px dot per lesson in the card's type colour (or sky), then
 * the count, amber when two or fewer are left. Free packages show their word instead.
 */
export function MiniBeads({ usage, label, freeText, className }: { usage: Usage | undefined; label: string; freeText?: ReactNode; className?: string }) {
  if (!usage) return <span aria-hidden className={cx('block h-2.5 w-16 animate-shimmer rounded-full bg-track', className)} />
  if (usage.isFree || usage.total === null) return <span className={cx('text-[0.84375rem] text-ink-3', className)}>{freeText}</span>
  const left = usage.remaining ?? 0
  const tone = remainingTone(usage)
  const shown = Math.max(0, Math.min(left, 10))
  return (
    <span role="img" aria-label={label} className={cx('flex min-w-0 items-center gap-[3px]', className)}>
      {Array.from({ length: shown }, (_, index) => (
        <span key={index} className="size-[9px] shrink-0 rounded-full bg-[var(--t-mid,var(--sky))]" />
      ))}
      <span className={cx('ml-1.5 text-[0.84375rem] font-semibold tabular', (tone === 'low' || tone === 'out') && 'text-amber-ink')}>{left}</span>
    </span>
  )
}

/** A lesson's seats: one dot per seat, filled for each child holding one (sheet: "6 kişilik derste 2 yer boş"). */
export function SeatDots({ taken, capacity, size = 'md', className }: { taken: number; capacity: number; size?: 'sm' | 'md'; className?: string }) {
  const dot = size === 'md' ? 'size-4' : 'size-3.5'
  return (
    <span aria-hidden className={cx('flex shrink-0 gap-[5px]', className)}>
      {Array.from({ length: Math.max(capacity, taken) }, (_, index) => (
        <span
          key={index}
          className={cx(
            'rounded-full',
            dot,
            index < taken ? (index < capacity ? 'bg-[var(--t-mid,var(--sky))]' : 'bg-amber') : 'shadow-[inset_0_0_0_1.5px_var(--mute)]'
          )}
        />
      ))}
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

// Pegs are carried by their fill alone, as on the phone; only a seat given up keeps a dashed edge
function pegClass(seat: PegSeat) {
  if (seat.status === 'attended') return 'bg-positive-wash text-green-ink'
  if (seat.status === 'makeup') return 'bg-pink-felt text-pink-ink'
  // An absence is counted, not a danger: grey
  if (seat.status === 'no_show') return 'bg-track text-ink-3'
  if (seat.status === 'postponed' || seat.status === 'cancelled') return 'border-[1.5px] border-dashed border-mute text-ink-3 line-through'
  if (seat.overdue) return 'bg-action-wash text-amber-ink'
  return 'bg-piece text-ink-2'
}

const PEG_SIZES = {
  sm: 'size-6 text-[0.5625rem]',
  md: 'size-9 text-[0.78125rem]',
  lg: 'size-11 text-[0.875rem]'
}

/** One child as an initials circle, tinted by their attendance. */
export function Peg({ seat, size = 'md', className, style }: { seat: PegSeat; size?: keyof typeof PEG_SIZES; className?: string; style?: CSSProperties }) {
  return (
    <span title={seat.name} style={style} className={cx('grid shrink-0 place-items-center rounded-full font-semibold tabular', PEG_SIZES[size], pegClass(seat), className)}>
      {initialsOf(seat.name)}
    </span>
  )
}

/**
 * A lesson's seats: the children holding one as circles, then the count against the planned six.
 * Children past six get an outline (the room is planned for six; the database allows ten).
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
      {holders.map((seat, index) => draw(seat, index >= capacity ? 'outline-2 outline-offset-1 outline-amber' : undefined))}
      {others.length > 0 && (
        <>
          <span aria-hidden className="mx-0.5 h-4 w-px bg-line-strong" />
          {others.map((seat) => draw(seat))}
        </>
      )}
      <span className={cx('ml-1 text-[0.78125rem] tabular', holders.length > capacity ? 'font-medium text-amber-ink' : 'text-ink-3')}>
        {holders.length}/{capacity}
      </span>
    </div>
  )
}
