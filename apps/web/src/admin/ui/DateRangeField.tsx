import type { ReactNode } from 'react'
import {
  Button as AriaButton,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  DateInput,
  DateRangePicker,
  DateSegment,
  Dialog,
  FieldError,
  Group,
  Heading,
  Label,
  Popover,
  RangeCalendar
} from 'react-aria-components'
import type { CalendarDate } from '@internationalized/date'
import { CalendarBlankIcon, CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react'
import { useI18n } from '../providers/I18n'
import { fromCalendarDate, toCalendarDate } from './DateField'
import { fieldLabelClass, inputClass } from './Field'
import { popoverClass } from './Menu'
import { cx } from './cx'

export type DateRange = { start: Date; end: Date }

type Props = {
  label?: ReactNode
  value: DateRange | null
  onChange: (value: DateRange | null) => void
  minValue?: Date | null
  errorMessage?: string
  description?: ReactNode
  isDisabled?: boolean
  /** Extra controls under the calendar, e.g. "keep the current period". */
  popoverFooter?: (close: () => void) => ReactNode
  className?: string
  'aria-label'?: string
}

const segmentClass =
  'rounded-[0.25rem] px-0.5 py-0.5 outline-none data-focused:bg-accent-wash-2 data-focused:text-accent-ink data-placeholder:text-ink-3 data-[type=literal]:px-0 data-[type=literal]:text-ink-3'

/** A package period: first and last day, picked on one calendar (two taps). */
export function DateRangeField({ label, value, onChange, minValue, errorMessage, description, isDisabled, popoverFooter, className, ...aria }: Props) {
  const { t } = useI18n()
  const calendarValue = value ? { start: toCalendarDate(value.start)!, end: toCalendarDate(value.end)! } : null
  return (
    <DateRangePicker
      aria-label={aria['aria-label']}
      value={calendarValue}
      onChange={(next) => {
        if (!next) return onChange(null)
        onChange({ start: fromCalendarDate(next.start as CalendarDate)!, end: fromCalendarDate(next.end as CalendarDate)! })
      }}
      minValue={toCalendarDate(minValue ?? null) ?? undefined}
      isDisabled={isDisabled}
      isInvalid={Boolean(errorMessage)}
      granularity="day"
      className={cx('flex flex-col gap-1.5', className)}
    >
      {({ state }) => (
        <>
          {label && <Label className={fieldLabelClass}>{label}</Label>}
          <Group className={cx(inputClass, 'flex h-11 items-center gap-1 pr-1 data-focus-within:border-accent data-focus-within:ring-3 data-focus-within:ring-accent/20')}>
            <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden tabular">
              <DateInput slot="start" className="flex items-center">
                {(segment) => <DateSegment segment={segment} className={segmentClass} />}
              </DateInput>
              <span aria-hidden className="text-ink-3">–</span>
              <DateInput slot="end" className="flex items-center">
                {(segment) => <DateSegment segment={segment} className={segmentClass} />}
              </DateInput>
            </div>
            <AriaButton className="grid size-9 shrink-0 place-items-center rounded-[0.5rem] text-ink-2 outline-none data-hovered:bg-well data-focus-visible:ring-2 data-focus-visible:ring-focus">
              <CalendarBlankIcon aria-hidden className="size-[1.125rem]" />
            </AriaButton>
          </Group>
          {description && !errorMessage && <span className="text-[0.8125rem] text-ink-3">{description}</span>}
          <FieldError className="text-[0.8125rem] text-negative-ink">{errorMessage}</FieldError>
          <Popover offset={6} className={cx(popoverClass, 'p-3')}>
            <Dialog className="outline-none">
              <RangeCalendar className="w-[17.5rem]">
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
                <CalendarGrid className="w-full border-separate border-spacing-x-0 border-spacing-y-0.5">
                  <CalendarGridHeader>
                    {(day) => <CalendarHeaderCell className="pb-1 text-xs font-medium text-ink-3">{day}</CalendarHeaderCell>}
                  </CalendarGridHeader>
                  <CalendarGridBody>
                    {(date) => (
                      <CalendarCell
                        date={date}
                        className={({ isSelected, isSelectionStart, isSelectionEnd, isOutsideMonth, isToday }) =>
                          cx(
                            'grid h-9 w-full cursor-default place-items-center text-sm tabular outline-none transition-colors duration-100',
                            'data-hovered:bg-well data-focus-visible:ring-2 data-focus-visible:ring-focus data-disabled:opacity-30',
                            isSelected && 'bg-accent-wash-2 text-accent-ink data-hovered:bg-accent-wash-2',
                            (isSelectionStart || isSelectionEnd) && 'rounded-full bg-accent-solid font-semibold text-on-accent data-hovered:bg-accent-solid',
                            isSelectionStart && !isSelectionEnd && 'rounded-r-none',
                            isSelectionEnd && !isSelectionStart && 'rounded-l-none',
                            !isSelected && 'rounded-full',
                            !isSelected && isToday && 'font-semibold text-accent-ink',
                            isOutsideMonth && 'invisible'
                          )
                        }
                      />
                    )}
                  </CalendarGridBody>
                </CalendarGrid>
              </RangeCalendar>
              {popoverFooter && <div className="mt-2 border-t border-line pt-2">{popoverFooter(() => state.setOpen(false))}</div>}
            </Dialog>
          </Popover>
        </>
      )}
    </DateRangePicker>
  )
}
