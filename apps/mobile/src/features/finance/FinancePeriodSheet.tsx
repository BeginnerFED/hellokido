import { useState } from 'react'
import { differenceInCalendarDays, startOfDay } from 'date-fns'
import { cycleOf, samePeriod } from '@hellokido/core/view'
import { useI18n } from '../../providers/I18n'
import { PeriodField } from '../../ui/Fields'
import { SheetScreen, useSheet } from '../../ui/Sheet'
import { DOT } from '../../ui/Text'
import { choosePeriod, periodName, useChosenPeriod } from './period'
import { usePeriodRule } from './rule'

/** Any first and last day for the Finance tab; nothing changes there until "Show" in the bar. */
export function FinancePeriodSheet() {
  const i18n = useI18n()
  const { t, plural } = i18n
  // This sheet draws its own SheetScreen, so the bar's action closes the sheet it is in through this
  const sheet = useSheet()
  const [today] = useState(() => startOfDay(new Date()))
  const { rule } = usePeriodRule(today)
  const current = cycleOf(today, rule ?? 1)
  const shown = useChosenPeriod() ?? current
  const [start, setStart] = useState<Date | null>(shown.start)
  const [end, setEnd] = useState<Date | null>(shown.end)

  const show = () => {
    if (!start || !end) return
    const next = { start, end }
    // The current period is not pinned, so Finance keeps following the calendar
    choosePeriod(samePeriod(next, current) ? null : next)
    sheet.finish()
  }

  return (
    <SheetScreen title={t.finance.period.customTitle} action={{ label: t.finance.period.show, disabled: !start || !end, onPress: show }}>
      <PeriodField
        label={t.finance.period.customField}
        startLabel={t.finance.period.firstDay}
        endLabel={t.finance.period.lastDay}
        start={start}
        end={end}
        onStart={(day) => {
          setStart(day)
          // A first day after the last one moves the last day along
          if (end && day > end) setEnd(day)
        }}
        onEnd={setEnd}
        // What Finance will show, as its heading names it, and how many days that is
        hint={start && end ? `${periodName(i18n, { start, end })}${DOT}${plural(t.finance.period.length, differenceInCalendarDays(end, start) + 1)}` : undefined}
      />
    </SheetScreen>
  )
}
