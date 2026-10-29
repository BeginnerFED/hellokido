import type { Seat } from '@hellokido/core/api'
import { holdsSeat } from '@hellokido/core/rules/attendance.js'
import { lessonTitle } from '@hellokido/core/view'
import { useLabels } from '../../data/queries'
import { typeClass } from '../../ui/signature'
import { cx } from '../../ui/cx'

/** "İngilizce", or the name of a special event. */
export function useLessonTitle() {
  const labels = useLabels()
  return (lesson: { event_type: string; custom_description: string | null }) => lessonTitle(labels, lesson)
}

/**
 * The material a lesson is drawn in: its type's felt and ink (İngilizce sky, Duyusal sun, Özel pink).
 * Time that is over is shown by the hatch on the board behind it, not by the block, so `past` and
 * `soft` are kept for callers only.
 */
export function lessonTone(type: string, _past?: boolean, _soft?: boolean) {
  return cx(typeClass(type), 'border-transparent bg-(--t-felt) text-(--t-ink)')
}

/** The fill alone, for a lesson drawn with a ring of its own (a dragged copy). */
export function lessonWash(type: string) {
  return cx(typeClass(type), 'bg-(--t-felt) text-(--t-ink)')
}

/** Attended green, make-up pink, still to come a ring in the ink around it. */
function dotClass(status: string) {
  if (status === 'attended') return 'bg-green'
  if (status === 'makeup') return 'bg-pink'
  return 'ring-[1.5px] ring-inset ring-current/70'
}

/** The six seats in miniature: one dot per child holding a place, open seats after them. */
export function MiniSockets({ seats, capacity = 6, className }: { seats: Pick<Seat, 'id' | 'status'>[]; capacity?: number; className?: string }) {
  const holders = seats.filter((seat) => holdsSeat(seat.status))
  const open = Math.max(capacity - holders.length, 0)
  return (
    <span aria-hidden className={cx('inline-flex flex-wrap items-center gap-[0.1875rem]', className)}>
      {holders.map((seat, index) => (
        <span key={seat.id} className={cx('size-[0.4375rem] rounded-full', dotClass(seat.status), index >= capacity && 'ring-[1.5px] ring-amber')} />
      ))}
      {Array.from({ length: open }, (_, index) => (
        <span key={`open-${index}`} className="size-[0.4375rem] rounded-full ring-1 ring-inset ring-current/35" />
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
            <span aria-hidden className={cx('size-1.5 shrink-0 rounded-full', holds ? dotClass(seat.status) : seat.status === 'no_show' ? 'bg-negative' : 'bg-mute')} />
            <span className={cx('truncate', !holds && 'line-through opacity-75')}>{seat.child.student_name}</span>
          </span>
        )
      })}
    </span>
  )
}
