import { Button as AriaButton, Menu as AriaMenu, MenuItem as AriaMenuItem, MenuTrigger, Popover, ToggleButton } from 'react-aria-components'
import { CaretDownIcon, CheckIcon } from '@phosphor-icons/react'
import type { AttendanceStatus } from '@hellokido/core/api'
import { useLabels } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { popoverClass } from '../../ui/Menu'
import { cx } from '../../ui/cx'

// The answers behind "Other" keep a dot of what they mean
const DOT: Partial<Record<AttendanceStatus, string>> = {
  postponed: 'bg-mute',
  makeup: 'bg-pink'
}

/**
 * Attendance in one tap: the two common answers as pieces of a felt track, postponed and make-up
 * behind "Other". "Scheduled" is never chosen here; a lesson can only move forward from it.
 * `onType` draws it on a lesson's card: that type's track and ink.
 */
export function AttendancePicker({
  status,
  onChange,
  label,
  isDisabled,
  onType,
  className
}: {
  status: string
  onChange: (status: AttendanceStatus) => void
  /** What a screen reader hears for the group, e.g. "Ada's attendance". */
  label: string
  isDisabled?: boolean
  onType?: boolean
  className?: string
}) {
  const { t } = useI18n()
  const labels = useLabels()
  const other = status === 'postponed' || status === 'makeup'

  const part = (on: boolean, attended = false, opensMenu = false) =>
    cx(
      'flex h-8 min-w-0 flex-[1_1_auto] items-center justify-center gap-1 rounded-full px-2 text-[0.84375rem] font-medium whitespace-nowrap outline-none max-lg:h-9',
      'transition-[background-color,color,box-shadow,filter] duration-180 ease-out',
      'data-focus-visible:ring-2 data-focus-visible:ring-focus data-disabled:opacity-50',
      // A piece not chosen takes the hover tint; a chosen one only reacts when it opens a menu
      !on && 'data-hovered:bg-hover',
      on && opensMenu && 'data-hovered:brightness-95',
      // The chosen answer is a raised piece lifted off the track; "attended" carries a green check
      on && 'bg-raised shadow-lift',
      on && onType && 'dark:bg-[color-mix(in_srgb,var(--t-ink)_24%,var(--t-track))]',
      !on && (onType ? 'text-(--t-ink)' : 'text-ink-2 data-hovered:text-ink'),
      on && attended && (onType ? 'text-green-ink dark:text-[#bff0d3]' : 'text-green-ink'),
      on && !attended && (onType ? 'text-ink dark:text-white' : 'text-ink')
    )

  const toggle = (mark: AttendanceStatus) => {
    const on = status === mark
    return (
      <ToggleButton
        isSelected={on}
        onChange={(next) => next && onChange(mark)}
        isDisabled={isDisabled}
        className={part(on, mark === 'attended')}
      >
        {on && mark === 'attended' && <CheckIcon aria-hidden weight="bold" className="size-3.5 shrink-0" />}
        <span className="truncate">{labels.attendance(mark)}</span>
      </ToggleButton>
    )
  }
  return (
    <div
      role="group"
      aria-label={label}
      className={cx('flex gap-0.5 rounded-full p-[3px]', onType ? 'bg-(--t-track)' : 'bg-track', className)}
    >
      {toggle('attended')}
      {toggle('no_show')}
      <MenuTrigger>
        <AriaButton isDisabled={isDisabled} className={cx(part(other, false, true), 'pr-2 pl-2.5')}>
          {other && <span aria-hidden className={cx('size-[7px] shrink-0 rounded-full', DOT[status as AttendanceStatus])} />}
          <span className="truncate">{other ? labels.attendance(status) : t.today.otherStatus}</span>
          <CaretDownIcon aria-hidden weight="bold" className="size-3 shrink-0 opacity-70" />
        </AriaButton>
        <Popover placement="bottom end" offset={6} className={popoverClass}>
          <AriaMenu aria-label={label} onAction={(key) => onChange(String(key) as AttendanceStatus)} className="outline-none">
            {(['postponed', 'makeup'] as const).map((mark) => (
              <AriaMenuItem
                key={mark}
                id={mark}
                className="flex min-h-10 items-center gap-2.5 rounded-full px-3 py-2 text-[0.9375rem] text-ink outline-none select-none data-focused:bg-hover"
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
