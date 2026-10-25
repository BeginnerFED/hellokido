import type { Seat } from '@hellokido/core/api'
import { holdsSeat } from '@hellokido/core/rules/attendance.js'
import { lessonTitle } from '@hellokido/core/view'
import { useLabels } from '../../data/queries'
import { cx } from '../../ui/cx'

/** "İngilizce", or the name of a special event. */
export function useLessonTitle() {
  const labels = useLabels()
  return (lesson: { event_type: string; custom_description: string | null }) => lessonTitle(labels, lesson)
}

/**
 * The colour a lesson block carries on the calendar: English sky, sensory pink, special events
 * plain. Lessons that are over turn neutral, so the week reads as done and still to come.
 */
export function lessonTone(type: string, past: boolean, soft = false) {
  if (past) return 'border-line bg-surface-2'
  // Large cards take a lighter fill, so a day of them does not read as a wall of colour
  if (type === 'ingilizce')
    return cx('border-[color-mix(in_oklab,var(--accent)_30%,transparent)]', soft ? 'bg-[color-mix(in_oklab,var(--accent-wash)_55%,var(--surface))]' : 'bg-accent-wash')
  if (type === 'duyusal')
    return cx('border-[color-mix(in_oklab,var(--pink)_34%,transparent)]', soft ? 'bg-[color-mix(in_oklab,var(--pink-wash)_55%,var(--surface))]' : 'bg-pink-wash')
  return 'border-line-strong bg-surface'
}

/** The fill alone, for a lesson drawn with a border of its own (a dragged copy). */
export function lessonWash(type: string) {
  if (type === 'ingilizce') return 'bg-accent-wash'
  if (type === 'duyusal') return 'bg-pink-wash'
  return 'bg-surface'
}

function dotClass(status: string) {
  if (status === 'attended') return 'bg-accent-solid'
  if (status === 'makeup') return 'bg-pink'
  return 'bg-surface ring-[1.5px] ring-inset ring-accent'
}

/** The six sockets in miniature: one dot per child holding a place, open sockets after them. */
export function MiniSockets({ seats, capacity = 6, className }: { seats: Pick<Seat, 'id' | 'status'>[]; capacity?: number; className?: string }) {
  const holders = seats.filter((seat) => holdsSeat(seat.status))
  const open = Math.max(capacity - holders.length, 0)
  return (
    <span aria-hidden className={cx('inline-flex flex-wrap items-center gap-[0.1875rem]', className)}>
      {holders.map((seat, index) => (
        <span key={seat.id} className={cx('size-[0.4375rem] rounded-full', dotClass(seat.status), index >= capacity && 'ring-[1.5px] ring-negative')} />
      ))}
      {Array.from({ length: open }, (_, index) => (
        <span key={`open-${index}`} className="size-[0.4375rem] rounded-full ring-1 ring-inset ring-line-strong" />
      ))}
    </span>
  )
}

/**
 * Children of a lesson by name; those who gave up their place stay listed, struck through. Plain
 * spans, so the list can sit inside a lesson's button.
 */
export function SeatNames({ seats, layout = 'column', className }: { seats: Seat[]; layout?: 'column' | 'row'; className?: string }) {
  const labels = useLabels()
  return (
    <span className={cx('flex', layout === 'row' ? 'flex-wrap gap-x-3.5 gap-y-1' : 'flex-col gap-0.5', className)}>
      {seats.map((seat) => {
        const holds = holdsSeat(seat.status)
        return (
          <span key={seat.id} className="flex min-w-0 items-center gap-1.5" title={labels.attendance(seat.status)}>
            <span aria-hidden className={cx('size-1.5 shrink-0 rounded-full', holds ? dotClass(seat.status) : 'bg-line-strong')} />
            <span className={cx('truncate', !holds && 'text-ink-3 line-through')}>{seat.child.student_name}</span>
          </span>
        )
      })}
    </span>
  )
}
