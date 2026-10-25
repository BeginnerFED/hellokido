import { useState } from 'react'
import { StyleSheet } from 'react-native'
import { differenceInCalendarDays, startOfDay } from 'date-fns'
import { cycleOf, samePeriod } from '@hellokido/core/view'
import { useCatalog } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { Button } from '../../ui/Button'
import { PeriodField } from '../../ui/Fields'
import { SheetActions, SheetScreen, useSheet } from '../../ui/Sheet'
import { DOT, Text } from '../../ui/Text'
import { choosePeriod, periodName, useChosenPeriod } from './period'

/** Any first and last day for the Finance tab; nothing changes there until "Show". */
export function FinancePeriodSheet() {
  const { t } = useI18n()
  return (
    <SheetScreen title={t.finance.period.customTitle}>
      <RangeForm />
    </SheetScreen>
  )
}

function RangeForm() {
  const i18n = useI18n()
  const { t, plural } = i18n
  const sheet = useSheet()
  const startDay = useCatalog().data?.settings.moneyPeriodStartDay ?? 1
  const [today] = useState(() => startOfDay(new Date()))
  const current = cycleOf(today, startDay)
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
    <>
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
        footer={
          // What Finance will show, as its heading names it, and how many days that is
          start && end ? (
            <Text variant="foot" tone="ink3" tabular style={styles.length}>
              {`${periodName(i18n, { start, end })}${DOT}${plural(t.finance.period.length, differenceInCalendarDays(end, start) + 1)}`}
            </Text>
          ) : undefined
        }
      />
      <SheetActions>
        <Button variant="primary" size="lg" disabled={!start || !end} onPress={show}>
          {t.finance.period.show}
        </Button>
      </SheetActions>
    </>
  )
}

const styles = StyleSheet.create({
  // The footer is a row; the line wraps inside it instead of running past the edge
  length: { flexShrink: 1, paddingHorizontal: 2 }
})
