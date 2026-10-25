import { useState } from 'react'
import { startOfDay } from 'date-fns'
import { CalendarBlankIcon, CalendarDotsIcon, CaretDownIcon, CaretLeftIcon, CaretRightIcon, CheckIcon } from '@phosphor-icons/react'
import { useI18n } from '../../providers/I18n'
import { Button, IconButton } from '../../ui/Button'
import { DateRangeField, type DateRange } from '../../ui/DateRangeField'
import { Menu, MenuItem, MenuSeparator } from '../../ui/Menu'
import { Sheet, SheetActions } from '../../ui/Sheet'
import { matchPreset, periodLabel, presetPeriod, stepPeriod, type Period } from './period'

const OTHER_PRESETS = ['lastMonth', 'last14', 'today'] as const

/** Back and forth by month (or by the length of any other period), this month, and other periods. */
export function PeriodNav({ period, today, onChange }: { period: Period; today: Date; onChange: (next: Period) => void }) {
  const i18n = useI18n()
  const { t } = i18n
  const [custom, setCustom] = useState({ open: false, key: 0 })
  const preset = matchPreset(period, today)

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className="flex items-center gap-1">
        <IconButton label={t.finance.period.previous} size="sm" onPress={() => onChange(stepPeriod(period, -1))}>
          <CaretLeftIcon aria-hidden weight="bold" className="size-4" />
        </IconButton>
        <Button size="sm" variant="secondary" onPress={() => onChange(presetPeriod('thisMonth', today))} isDisabled={preset === 'thisMonth'}>
          {t.finance.period.thisMonth}
        </Button>
        <IconButton label={t.finance.period.next} size="sm" onPress={() => onChange(stepPeriod(period, 1))}>
          <CaretRightIcon aria-hidden weight="bold" className="size-4" />
        </IconButton>
      </div>
      {/* The name and its menu stay together: where they do not fit beside the arrows they move to their own line */}
      <div className="flex flex-1 items-center gap-4">
        <h2 aria-live="polite" className="flex-1 text-[1.0625rem] font-semibold whitespace-nowrap first-letter:uppercase">
          {periodLabel(i18n, period)}
        </h2>
        <Menu
          label={t.finance.period.otherPeriod}
          trigger={
            <Button size="sm" variant="ghost" aria-label={t.finance.period.otherPeriod} icon={<CalendarDotsIcon aria-hidden className="size-[1.125rem]" />} className="-mr-2">
              <span className="max-sm:hidden">{t.finance.period.otherPeriod}</span>
              <CaretDownIcon aria-hidden weight="bold" className="size-3.5 opacity-70" />
            </Button>
          }
        >
          {OTHER_PRESETS.map((id) => (
            <MenuItem
              key={id}
              icon={preset === id ? <CheckIcon aria-hidden weight="bold" className="size-4 text-accent" /> : <span aria-hidden className="size-4" />}
              onAction={() => onChange(presetPeriod(id, today))}
            >
              {t.finance.period[id]}
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem icon={<CalendarBlankIcon aria-hidden className="size-[1.125rem]" />} onAction={() => setCustom((state) => ({ open: true, key: state.key + 1 }))}>
            {t.finance.period.custom}
          </MenuItem>
        </Menu>
      </div>
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
        <SheetActions>
          <Button variant="secondary" onPress={() => onOpenChange(false)} className="max-md:flex-1">
            {t.common.cancel}
          </Button>
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
