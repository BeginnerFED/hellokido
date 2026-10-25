import { Button as AriaButton } from 'react-aria-components'
import { CaretDownIcon, CheckIcon } from '@phosphor-icons/react'
import type { AttendanceStatus } from '@hellokido/core/api'
import { useLabels } from '../../data/queries'
import { Menu, MenuItem } from '../../ui/Menu'
import { cx } from '../../ui/cx'

export function statusTone(status: string, overdue: boolean) {
  if (overdue) return 'bg-action-wash text-action-ink'
  if (status === 'attended') return 'bg-accent-wash text-accent-ink'
  if (status === 'no_show') return 'bg-ink-3/15 text-ink'
  if (status === 'makeup') return 'bg-pink-wash text-pink-ink'
  return 'bg-well text-ink-2'
}

/**
 * One child's attendance as a small chip that opens the choices. "Overdue" (still scheduled after the
 * day has passed) shows in the colour of things waiting for the admin.
 */
export function StatusMenu({
  status,
  options,
  onChange,
  label,
  overdueLabel,
  overdue = false,
  isDisabled
}: {
  status: string
  options: AttendanceStatus[]
  onChange: (status: AttendanceStatus) => void
  /** What the menu is about, e.g. "Ada's attendance". */
  label: string
  /** Shown instead of the status while the attendance is overdue. */
  overdueLabel?: string
  overdue?: boolean
  isDisabled?: boolean
}) {
  const labels = useLabels()
  const shown = overdue && overdueLabel ? overdueLabel : labels.attendance(status)
  // A stored status that cannot be chosen any more (cancelled) still shows as the current one
  const choices = options.includes(status as AttendanceStatus) ? options : [status as AttendanceStatus, ...options]
  return (
    <Menu
      label={label}
      trigger={
        <AriaButton
          aria-label={`${label}: ${shown}`}
          isDisabled={isDisabled}
          className={cx(
            'relative inline-flex h-7 shrink-0 items-center gap-1 rounded-full pr-2 pl-2.5 text-[0.75rem] font-medium whitespace-nowrap outline-none',
            'pointer-coarse:after:absolute pointer-coarse:after:-inset-x-1 pointer-coarse:after:-inset-y-1.5',
            'transition-[background-color,color,opacity] duration-150 data-focus-visible:ring-2 data-focus-visible:ring-focus data-disabled:opacity-60 max-lg:h-8',
            statusTone(status, overdue)
          )}
        >
          {shown}
          <CaretDownIcon aria-hidden weight="bold" className="size-3 opacity-70" />
        </AriaButton>
      }
    >
      {choices.map((option) => (
        <MenuItem
          key={option}
          id={option}
          isDisabled={option === 'cancelled'}
          onAction={() => onChange(option)}
          icon={<CheckIcon aria-hidden weight="bold" className={cx('size-4', option === status ? 'text-accent' : 'opacity-0')} />}
        >
          {labels.attendance(option)}
        </MenuItem>
      ))}
    </Menu>
  )
}
