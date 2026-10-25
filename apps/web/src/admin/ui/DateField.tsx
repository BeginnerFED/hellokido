import type { ReactNode } from 'react'
import {
  Button as AriaButton,
  Calendar as AriaCalendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  DateInput,
  DatePicker,
  DateSegment,
  Dialog,
  FieldError,
  Group,
  Heading,
  Label,
  Popover,
  type CalendarProps
} from 'react-aria-components'
import { CalendarDate } from '@internationalized/date'
import { CalendarBlankIcon, CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react'
import { addDays, isSameDay, startOfDay } from 'date-fns'
import { useI18n } from '../providers/I18n'
import { fieldLabelClass, inputClass } from './Field'
import { popoverClass } from './Menu'
import { cx } from './cx'

// Dates travel as local-midnight Date objects, the way the rules in core expect them.
export const toCalendarDate = (date: Date | null | undefined) =>
  date ? new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate()) : null
export const fromCalendarDate = (value: CalendarDate | null | undefined) =>
  value ? new Date(value.year, value.month - 1, value.day) : null

type DateFieldProps = {
  label?: ReactNode
  value: Date | null
  onChange: (value: Date | null) => void
  minValue?: Date | null
  maxValue?: Date | null
  errorMessage?: string
  description?: ReactNode
  isRequired?: boolean
  isDisabled?: boolean
  /** Shows "Today" and "Yesterday" shortcuts under the field. */
  shortcuts?: boolean
  className?: string
  'aria-label'?: string
}

export function DateField({
  label,
  value,
  onChange,
  minValue,
  maxValue,
  errorMessage,
  description,
  isRequired,
  isDisabled,
  shortcuts,
  className,
  ...aria
}: DateFieldProps) {
  const { t } = useI18n()
  const today = startOfDay(new Date())
  const quick = [
    { label: t.common.today, date: today },
    { label: t.common.yesterday, date: addDays(today, -1) }
  ]
  return (
    <DatePicker
      aria-label={aria['aria-label']}
      value={toCalendarDate(value)}
      onChange={(next) => onChange(fromCalendarDate(next as CalendarDate | null))}
      minValue={toCalendarDate(minValue ?? null) ?? undefined}
      maxValue={toCalendarDate(maxValue ?? null) ?? undefined}
      isRequired={isRequired}
      isDisabled={isDisabled}
      isInvalid={Boolean(errorMessage)}
      granularity="day"
      className={cx('flex flex-col gap-1.5', className)}
    >
      {label && <Label className={fieldLabelClass}>{label}</Label>}
      <Group className={cx(inputClass, 'flex h-[2.875rem] items-center gap-1 pr-1 data-focus-within:border-accent data-focus-within:ring-3 data-focus-within:ring-accent/20')}>
        <DateInput className="flex min-w-0 flex-1 items-center tabular">
          {(segment) => (
            <DateSegment
              segment={segment}
              className="rounded-[0.25rem] px-0.5 py-0.5 outline-none data-focused:bg-accent-wash-2 data-focused:text-accent-ink data-placeholder:text-ink-3 data-[type=literal]:px-0 data-[type=literal]:text-ink-3"
            />
          )}
        </DateInput>
        <AriaButton className="grid size-9 place-items-center rounded-[0.5rem] text-ink-2 outline-none data-hovered:bg-well data-focus-visible:ring-2 data-focus-visible:ring-focus">
          <CalendarBlankIcon aria-hidden className="size-[1.125rem]" />
        </AriaButton>
      </Group>
      {shortcuts && (
        <div className="flex gap-1.5">
          {quick.map((item) => {
            const active = value ? isSameDay(value, item.date) : false
            return (
              <AriaButton
                key={item.label}
                // Out of the picker's button context: otherwise it takes the calendar button's name and opens the popover
                slot={null}
                onPress={() => onChange(item.date)}
                isDisabled={isDisabled}
                className={cx(
                  'relative h-7 rounded-full px-2.5 text-[0.8125rem] font-medium outline-none transition-colors duration-150 data-focus-visible:ring-2 data-focus-visible:ring-focus',
                  'pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-2',
                  active ? 'bg-accent-wash-2 text-accent-ink' : 'text-ink-2 data-hovered:bg-well'
                )}
              >
                {item.label}
              </AriaButton>
            )
          })}
        </div>
      )}
      {description && !errorMessage && <span className="text-[0.8125rem] text-ink-3">{description}</span>}
      <FieldError className="text-[0.8125rem] text-negative-ink">{errorMessage}</FieldError>
      <Popover offset={6} className={cx(popoverClass, 'p-3')}>
        <Dialog className="outline-none">
          <MonthCalendar />
        </Dialog>
      </Popover>
    </DatePicker>
  )
}

/** A month to pick a day from: inside a date field's popover, or on its own with a value. */
export function MonthCalendar(props: Pick<CalendarProps<CalendarDate>, 'value' | 'onChange' | 'aria-label'>) {
  const { t } = useI18n()
  return (
    <AriaCalendar {...props} className="w-[17.5rem]">
      <header className="flex items-center gap-1 pb-2">
        <AriaButton
          slot="previous"
          aria-label={t.common.previous}
          className="grid size-8 place-items-center rounded-full text-ink-2 outline-none data-hovered:bg-well data-focus-visible:ring-2 data-focus-visible:ring-focus"
        >
          <CaretLeftIcon aria-hidden className="size-4" />
        </AriaButton>
        <Heading className="flex-1 text-center text-sm font-semibold capitalize" />
        <AriaButton
          slot="next"
          aria-label={t.common.following}
          className="grid size-8 place-items-center rounded-full text-ink-2 outline-none data-hovered:bg-well data-focus-visible:ring-2 data-focus-visible:ring-focus"
        >
          <CaretRightIcon aria-hidden className="size-4" />
        </AriaButton>
      </header>
      <CalendarGrid className="w-full border-separate border-spacing-0.5">
        <CalendarGridHeader>
          {(day) => <CalendarHeaderCell className="pb-1 text-xs font-medium text-ink-3">{day}</CalendarHeaderCell>}
        </CalendarGridHeader>
        <CalendarGridBody>
          {(date) => (
            <CalendarCell
              date={date}
              className={({ isSelected, isOutsideMonth, isToday }) =>
                cx(
                  'grid size-9 cursor-default place-items-center rounded-full text-sm tabular outline-none transition-colors duration-100',
                  'data-hovered:bg-well data-focus-visible:ring-2 data-focus-visible:ring-focus data-disabled:opacity-30',
                  isSelected && 'bg-accent-solid font-semibold text-on-accent data-hovered:bg-accent-solid',
                  !isSelected && isToday && 'font-semibold text-accent-ink',
                  isOutsideMonth && 'hidden'
                )
              }
            />
          )}
        </CalendarGridBody>
      </CalendarGrid>
    </AriaCalendar>
  )
}
