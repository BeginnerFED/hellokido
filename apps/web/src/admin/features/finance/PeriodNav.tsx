import { useState } from 'react'
import { differenceInCalendarDays, startOfDay } from 'date-fns'
import { CalendarBlankIcon, CaretDownIcon, CaretLeftIcon, CaretRightIcon, CheckIcon } from '@phosphor-icons/react'
import { useI18n } from '../../providers/I18n'
import { Button, IconButton } from '../../ui/Button'
import { DateRangeField, type DateRange } from '../../ui/DateRangeField'
import { Menu, MenuItem, MenuSeparator } from '../../ui/Menu'
import { Sheet, SheetActions } from '../../ui/Sheet'
import { cx } from '../../ui/cx'
import { isCycle, matchPreset, periodLabel, presetName, presetPeriod, stepPeriod, type Period, type PeriodRule } from './period'

const OTHER_PRESETS = ['lastPeriod', 'last14', 'today'] as const
// A strip of one cell a day reads up to about two months; a longer range has no strip
const STRIP_DAYS = { min: 7, max: 62 }

type Props = {
  period: Period
  today: Date
  /** How money periods are cut: by salary pay-outs. */
  rule: PeriodRule
  onChange: (next: Period) => void
}

/**
 * Back and forth by period (or by the length of any other range), the way back to the current
 * period, other ranges, and the period as a strip of its days: how far into it today is and the
 * day salaries are due.
 */
export function PeriodNav({ period, today, rule, onChange }: Props) {
  const i18n = useI18n()
  const { t } = i18n
  const [custom, setCustom] = useState({ open: false, key: 0 })
  const preset = matchPreset(period, today, rule)
  const current = preset === 'thisPeriod'

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-3.5">
      <div className="flex min-w-0 items-center gap-2 max-sm:w-full">
        <IconButton label={t.finance.period.previous} variant="quiet" onPress={() => onChange(stepPeriod(period, -1, rule))}>
          <CaretLeftIcon aria-hidden weight="bold" className="size-4" />
        </IconButton>
        <IconButton label={t.finance.period.next} variant="quiet" onPress={() => onChange(stepPeriod(period, 1, rule))}>
          <CaretRightIcon aria-hidden weight="bold" className="size-4" />
        </IconButton>
        <h2
          aria-live="polite"
          className="ml-1.5 min-w-0 text-[1.1875rem] leading-7 font-semibold tracking-[-0.015em] text-balance first-letter:uppercase sm:mr-1.5 sm:text-[1.375rem]"
        >
          {periodLabel(i18n, period)}
        </h2>
      </div>
      <div className="flex items-center gap-2">
        {current ? (
          <span className="inline-flex h-7 items-center rounded-full bg-sky-felt px-[0.6875rem] text-[0.8125rem] font-medium whitespace-nowrap text-sky-ink">
            {presetName(t, 'thisPeriod', rule)}
          </span>
        ) : (
          <Button size="sm" variant="quiet" onPress={() => onChange(presetPeriod('thisPeriod', today, rule))}>
            {t.finance.period.backToCurrent}
          </Button>
        )}
        <Menu
          label={t.finance.period.otherPeriod}
          placement="bottom end"
          trigger={
            <Button size="sm" variant="quiet">
              {t.finance.period.otherPeriod}
              <CaretDownIcon aria-hidden weight="bold" className="size-3.5 opacity-70" />
            </Button>
          }
        >
          {OTHER_PRESETS.map((id) => (
            <MenuItem
              key={id}
              icon={preset === id ? <CheckIcon aria-hidden weight="bold" className="size-4 text-accent" /> : <span aria-hidden className="size-4" />}
              onAction={() => onChange(presetPeriod(id, today, rule))}
            >
              {presetName(t, id, rule)}
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem icon={<CalendarBlankIcon aria-hidden className="size-[1.125rem]" />} onAction={() => setCustom((state) => ({ open: true, key: state.key + 1 }))}>
            {t.finance.period.custom}
          </MenuItem>
        </Menu>
      </div>
      <PeriodStrip period={period} today={today} rule={rule} className="w-full lg:ml-auto lg:w-auto lg:max-w-[27rem] lg:min-w-[18rem] lg:flex-1" />
      {custom.key > 0 && (
        <CustomPeriodSheet
          key={custom.key}
          isOpen={custom.open}
          onOpenChange={(open) => setCustom((state) => ({ ...state, open }))}
          period={period}
          onPick={onChange}
        />
      )}
    </div>
  )
}

/**
 * One cell a day: the days gone in sky-track, today in sky, the days to come in the groove. Under
 * it the first day, how far in today is (or how long the range is), and the last day, which is
 * salary day for a money period cut by pay-outs.
 */
function PeriodStrip({ period, today, rule, className }: Omit<Props, 'onChange'> & { className?: string }) {
  const i18n = useI18n()
  const { t, fmt, plural, date } = i18n
  const start = startOfDay(period.start)
  const length = differenceInCalendarDays(period.end, start) + 1
  if (length < STRIP_DAYS.min || length > STRIP_DAYS.max) return null

  const at = differenceInCalendarDays(today, start)
  const inside = at >= 0 && at < length
  const short = (day: Date) => date(day, { day: 'numeric', month: 'short' })
  const payday = rule.paydays.length > 0 && isCycle(period, rule)

  return (
    <div className={className}>
      <div aria-hidden className="flex gap-0.5 sm:gap-[3px]">
        {Array.from({ length }, (_, index) => (
          <span
            key={index}
            className={cx('h-4 min-w-0 flex-1 rounded-[3px]', index === at ? 'bg-sky' : index < at ? 'bg-sky-track' : 'bg-track')}
          />
        ))}
      </div>
      <p className="mt-[5px] flex items-baseline justify-between gap-3 text-[0.78125rem] leading-4 text-ink-3">
        <span className="whitespace-nowrap">{short(period.start)}</span>
        <span className="min-w-0 text-center font-medium text-ink">{inside ? fmt(t.finance.web.dayOf, { day: at + 1 }) : plural(t.finance.period.length, length)}</span>
        <span className="text-right whitespace-nowrap">{payday ? fmt(t.finance.web.payday, { date: short(period.end) }) : short(period.end)}</span>
      </p>
    </div>
  )
}

/** Any first and last day; nothing is loaded until both are chosen and shown. */
function CustomPeriodSheet({
  isOpen,
  onOpenChange,
  period,
  onPick
}: {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  period: Period
  onPick: (next: Period) => void
}) {
  const { t } = useI18n()
  const [range, setRange] = useState<DateRange | null>({ start: period.start, end: period.end })
  const show = () => {
    if (!range) return
    onPick({ start: startOfDay(range.start), end: startOfDay(range.end) })
    onOpenChange(false)
  }
  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={t.finance.period.customTitle}
      footer={
        <SheetActions
          start={
            <Button variant="quiet" onPress={() => onOpenChange(false)} className="max-md:flex-1">
              {t.common.cancel}
            </Button>
          }
        >
          <Button variant="primary" isDisabled={!range} onPress={show} className="max-md:flex-1">
            {t.finance.period.show}
          </Button>
        </SheetActions>
      }
    >
      <DateRangeField label={t.finance.period.customField} value={range} onChange={setRange} />
    </Sheet>
  )
}
