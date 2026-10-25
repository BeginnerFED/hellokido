import { useMemo } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { moneySince } from '@hellokido/core/api'
import { formatMoney } from '@hellokido/core/rules/money.js'
import { cyclesUpTo, niceTicks, periodTotals, samePeriod, type Period } from '@hellokido/core/view'
import { keys } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useColors } from '../../theme/colors'
import { LoadError, Skeleton } from '../../ui/Bits'
import { Card, Section } from '../../ui/Screen'
import { Text } from '../../ui/Text'
import { periodName } from './period'

// The chart reads this many periods back; the period before the one on screen comes from the same rows
const REACH = 12
const SHOWN = 6
const PLOT = 128
// The card's own height (paddings, legend, plot, month labels, edges), so loading never makes the page jump
const CARD = 14 + 18 + 14 + PLOT + 24 + 10 + 2

/**
 * The amounts' column is as wide as its longest label (12px figures are about 7pt, dots and commas
 * half that), so "1.000.000" is never clipped and "50.000" leaves the columns their room.
 */
function axisWidth(labels: string[]) {
  const widest = Math.max(...labels.map((label) => [...label].reduce((sum, char) => sum + (/\d/.test(char) ? 7.2 : 3.6), 0)))
  return Math.max(28, Math.ceil(widest) + 8)
}

/** Daily amounts of the last twelve money periods, for the chart and for "the period before". */
export function useMoneySeries(today: Date, startDay: number | undefined) {
  const first = startDay === undefined ? null : cyclesUpTo(today, startDay, REACH)[0].start
  const query = useQuery({
    queryKey: keys.finance('months', first?.toISOString() ?? ''),
    queryFn: () => moneySince(first ?? new Date()),
    enabled: first !== null,
    placeholderData: keepPreviousData
  })
  return { ...query, first }
}

type Props = {
  today: Date
  /** The day money periods start on: 1 gives calendar months. */
  startDay: number
  /** The period on the screen, marked when it is one of the columns. */
  period: Period
  series: ReturnType<typeof useMoneySeries>
  onPick: (period: Period) => void
}

/**
 * Money in and out of each of the last six money periods, blue in and orange out on one scale.
 * Pressing a column shows that period; every column says its numbers to a screen reader.
 */
export function PeriodsChart({ today, startDay, period, series, onPick }: Props) {
  const c = useColors()
  const i18n = useI18n()
  const { t, fmt, money, date } = i18n
  const months = startDay === 1
  const buckets = useMemo(() => periodTotals(series.data, today, startDay, SHOWN), [series.data, today, startDay])
  const ticks = niceTicks(Math.max(0, ...buckets.flatMap((bucket) => [bucket.in, bucket.out])))
  const top = ticks[ticks.length - 1]
  const size = (value: number) => (value > 0 ? Math.max(2, (value / top) * PLOT) : 0)
  const tickLabels = ticks.map((tick) => formatMoney(tick))
  const axis = axisWidth(tickLabels)

  return (
    <Section title={months ? t.finance.months.title : t.finance.months.periodsTitle}>
      {series.isError ? (
        <LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={() => void series.refetch()} />
      ) : !series.data ? (
        <Skeleton height={CARD} radius={18} />
      ) : (
        <Card style={series.isPlaceholderData && styles.dim}>
          <View style={styles.body}>
            <View style={styles.legend}>
              <Key color={c.seriesIn} label={t.finance.balance.in} />
              <Key color={c.seriesOut} label={t.finance.balance.out} />
            </View>
            <View style={styles.plot}>
              {/* Grid lines with their amounts; the columns sit over them */}
              {ticks.map((tick, index) => {
                const y = PLOT - (tick / top) * PLOT
                return (
                  <View key={tick} pointerEvents="none" style={StyleSheet.absoluteFill}>
                    <View style={[styles.gridLine, { left: axis, top: y, backgroundColor: tick === 0 ? c.lineStrong : c.line2 }]} />
                    <Text variant="caption" tone="ink3" tabular numberOfLines={1} style={[styles.tickLabel, { width: axis - 8, top: y - 8 }]}>
                      {tickLabels[index]}
                    </Text>
                  </View>
                )
              })}
              <View style={[styles.columns, { left: axis }]}>
                {buckets.map((bucket) => {
                  const viewed = samePeriod(bucket.period, period)
                  return (
                    <Pressable
                      key={bucket.key}
                      onPress={() => {
                        void Haptics.selectionAsync()
                        onPick(bucket.period)
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: viewed }}
                      accessibilityLabel={`${fmt(t.finance.months.show, { month: periodName(i18n, bucket.period) })}. ${t.finance.balance.in} ${money(bucket.in)}, ${t.finance.balance.out} ${money(bucket.out)}`}
                      // The viewed period is shaded; a press also dims, so the shaded column answers a tap too
                      style={({ pressed }) => [styles.column, (viewed || pressed) && { backgroundColor: c.surface2 }, pressed && styles.pressed]}
                    >
                      <View style={styles.bars}>
                        <View style={[styles.bar, { height: size(bucket.in), backgroundColor: c.seriesIn }]} />
                        <View style={[styles.bar, { height: size(bucket.out), backgroundColor: c.seriesOut }]} />
                      </View>
                      <Text
                        variant="caption"
                        weight={viewed ? '600' : '400'}
                        tone={viewed ? 'ink' : 'ink3'}
                        tabular
                        style={styles.month}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.85}
                      >
                        {/* Calendar months by their name; periods from another day by the day they start ("10 Eyl") */}
                        {date(bucket.period.start, months ? { month: 'short' } : { day: 'numeric', month: 'short' })}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>
          </View>
        </Card>
      )}
    </Section>
  )
}

function Key({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.key}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text variant="foot" tone="ink2">
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  dim: { opacity: 0.6 },
  pressed: { opacity: 0.7 },
  body: { paddingHorizontal: 12, paddingTop: 14, paddingBottom: 10 },
  legend: { flexDirection: 'row', gap: 16, paddingHorizontal: 4, marginBottom: 14 },
  key: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  plot: { height: PLOT + 24 },
  tickLabel: { position: 'absolute', left: 0, height: 16, textAlign: 'right' },
  gridLine: { position: 'absolute', right: 0, height: StyleSheet.hairlineWidth },
  columns: { position: 'absolute', right: 0, top: -8, bottom: 0, flexDirection: 'row' },
  column: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', borderRadius: 10, marginHorizontal: 1 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  bar: { width: 9, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  month: { marginTop: 6, marginBottom: 2 }
})
