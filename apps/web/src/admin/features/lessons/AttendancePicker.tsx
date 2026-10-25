import { Button as AriaButton, Menu as AriaMenu, MenuItem as AriaMenuItem, MenuTrigger, Popover, ToggleButton } from 'react-aria-components'
import { CaretDownIcon, CheckIcon } from '@phosphor-icons/react'
import type { AttendanceStatus } from '@hellokido/core/api'
import { useLabels } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { popoverClass } from '../../ui/Menu'
import { cx } from '../../ui/cx'

// The chosen answer is the white piece of the track, with the dot of what it means
const SELECTED = 'bg-surface text-ink shadow-piece'
const DOT: Partial<Record<AttendanceStatus, string>> = {
  attended: 'bg-positive',
  // An absence is counted, not a danger: grey, as on the tiles
  no_show: 'bg-ink-3',
  postponed: 'bg-ink-4',
  makeup: 'bg-pink'
}

function Dot({ status }: { status: AttendanceStatus }) {
  return <span aria-hidden className={cx('size-1.5 shrink-0 rounded-full', DOT[status])} />
}

// The two answers keep their whole label; only "Other" gives way when a language runs long
const part = cx(
  'flex h-[1.875rem] items-center justify-center gap-1.5 rounded-full px-2 text-[0.8125rem] font-medium whitespace-nowrap text-ink-3 outline-none max-lg:h-9',
  'transition-[background-color,color,box-shadow] duration-150 data-hovered:text-ink',
  'data-focus-visible:ring-2 data-focus-visible:ring-focus data-disabled:opacity-50'
)

/**
 * Attendance in one tap: the two common answers as buttons, postponed and make-up behind "Other".
 * "Scheduled" is never chosen here; a lesson can only move forward from it.
 */
export function AttendancePicker({
  status,
  onChange,
  label,
  isDisabled,
  className
}: {
  status: string
  onChange: (status: AttendanceStatus) => void
  /** What a screen reader hears for the group, e.g. "Ada's attendance". */
  label: string
  isDisabled?: boolean
  className?: string
}) {
  const { t } = useI18n()
  const labels = useLabels()
  const other = status === 'postponed' || status === 'makeup'
  const toggle = (mark: AttendanceStatus) => (
    <ToggleButton
      isSelected={status === mark}
      onChange={(selected) => selected && onChange(mark)}
      isDisabled={isDisabled}
      className={cx(part, status === mark && SELECTED)}
    >
      {status === mark && <Dot status={mark} />}
      <span className="truncate">{labels.attendance(mark)}</span>
    </ToggleButton>
  )
  return (
    <div role="group" aria-label={label} className={cx('grid grid-cols-[1fr_1fr_auto] gap-0.5 rounded-full bg-well p-1', className)}>
      {toggle('attended')}
      {toggle('no_show')}
      <MenuTrigger>
        <AriaButton isDisabled={isDisabled} className={cx(part, 'min-w-0 pr-2 pl-2.5', other && SELECTED)}>
          {other && <Dot status={status as AttendanceStatus} />}
          <span className="truncate">{other ? labels.attendance(status) : t.today.otherStatus}</span>
          <CaretDownIcon aria-hidden weight="bold" className="size-3 shrink-0 opacity-70" />
        </AriaButton>
        <Popover placement="bottom end" offset={6} className={popoverClass}>
          <AriaMenu aria-label={label} onAction={(key) => onChange(String(key) as AttendanceStatus)} className="outline-none">
            {(['postponed', 'makeup'] as const).map((mark) => (
              <AriaMenuItem
                key={mark}
                id={mark}
                className="flex cursor-default items-center gap-2.5 rounded-[0.5rem] px-2.5 py-2 text-sm text-ink outline-none select-none data-focused:bg-well"
              >
                <CheckIcon aria-hidden weight="bold" className={cx('size-4', status === mark ? 'text-accent' : 'opacity-0')} />
                {labels.attendance(mark)}
              </AriaMenuItem>
            ))}
          </AriaMenu>
        </Popover>
      </MenuTrigger>
    </div>
  )
}
