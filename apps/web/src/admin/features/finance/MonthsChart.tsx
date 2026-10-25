import { useMemo, useRef, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { moneySince } from '@hellokido/core/api'
import { formatMoney } from '@hellokido/core/rules/money.js'
import { cyclesUpTo, niceTicks, periodTotals, samePeriod, type Period } from '@hellokido/core/view'
import { keys } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { LoadError, Skeleton } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { Segmented } from '../../ui/Choice'
import { Card } from '../../ui/Page'
import { cx } from '../../ui/cx'
import { MINUS, useWidth } from './bits'
import { periodLabel } from './period'

type Bucket = ReturnType<typeof periodTotals>[number]
type Span = '6' | '12'

const PLOT = 176
const TOP = 10
const AXIS_X = 26
const AXIS_Y = 54
const TIP = 196
// The chart reads this many periods back; the period before the one on screen comes from the same rows
const REACH = 12

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

/** A column with a rounded top and a square foot on the baseline. */
function column(x: number, top: number, width: number, height: number) {
  if (height <= 0) return ''
  const r = Math.min(4, width / 2, height)
  const bottom = top + height
  return `M${x},${bottom}V${top + r}A${r},${r} 0 0 1 ${x + r},${top}H${x + width - r}A${r},${r} 0 0 1 ${x + width},${top + r}V${bottom}Z`
}

type Props = {
  today: Date
  /** The day money periods start on: 1 gives calendar months. */
  startDay: number
  /** The period on the page, marked in the chart when it is one of its columns. */
  period: Period
  series: ReturnType<typeof useMoneySeries>
  onPick: (period: Period) => void
  className?: string
}

/**
 * Money in and out of each of the last money periods (calendar months when periods start on the
 * 1st). It does not follow the filters on the page; pressing a column shows that period.
 */
export function MonthsChart({ today, startDay, period, series, onPick, className }: Props) {
  const { t, fmt } = useI18n()
  const [span, setSpan] = useState<Span>('6')
  const [asTable, setAsTable] = useState(false)
  const count = Number(span)
  const months = startDay === 1

  const buckets = useMemo(() => periodTotals(series.data, today, startDay, count), [series.data, today, startDay, count])

  const viewed = buckets.find((bucket) => samePeriod(bucket.period, period))?.key ?? null
  const label = fmt(months ? t.finance.months.chartLabel : t.finance.months.periodsLabel, { count })

  return (
    <Card
      title={months ? t.finance.months.title : t.finance.months.periodsTitle}
      aside={
        <Segmented<Span>
          aria-label={t.finance.months.rangeLabel}
          size="sm"
          fit
          options={[
            { id: '6', label: t.finance.months.six },
            { id: '12', label: t.finance.months.twelve }
          ]}
          value={span}
          onChange={setSpan}
        />
      }
      footer={
        <>
          {/* The table names its columns itself */}
          {asTable ? (
            <span />
          ) : (
            <span className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 rounded-[2px] bg-series-in" />
                {t.finance.balance.in}
              </span>
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 rounded-[2px] bg-series-out" />
                {t.finance.balance.out}
              </span>
            </span>
          )}
          <Button variant="ghost" size="sm" className="-my-1.5 -mr-3" onPress={() => setAsTable((on) => !on)}>
            {asTable ? t.finance.months.chart : t.finance.months.table}
          </Button>
        </>
      }
      className={className}
    >
      <div className="px-4 pt-4 pb-3 sm:px-5">
        {series.isError ? (
          <LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={() => void series.refetch()} />
        ) : !series.data ? (
          <Skeleton className="h-[13.25rem] rounded-control" />
        ) : asTable ? (
          <MonthsTable buckets={buckets} caption={label} months={months} />
        ) : (
          <Plot buckets={buckets} viewed={viewed} onPick={onPick} waiting={series.isPlaceholderData} label={label} months={months} />
        )}
      </div>
    </Card>
  )
}

function Plot({
  buckets,
  viewed,
  onPick,
  waiting,
  label,
  months
}: {
  buckets: Bucket[]
  viewed: string | null
  onPick: (period: Period) => void
  waiting: boolean
  label: string
  months: boolean
}) {
  const i18n = useI18n()
  const { t, fmt, money, date } = i18n
  const box = useRef<HTMLDivElement>(null)
  const width = useWidth(box)
  const [active, setActive] = useState<number | null>(null)

  const max = Math.max(0, ...buckets.flatMap((bucket) => [bucket.in, bucket.out]))
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1]
  const height = TOP + PLOT + AXIS_X
  const band = buckets.length ? Math.max(0, width - AXIS_Y) / buckets.length : 0
  const bar = Math.max(3, Math.min(24, (band - 12) / 2))
  const y = (value: number) => TOP + PLOT - (value / top) * PLOT
  const size = (value: number) => (value > 0 ? Math.max(2, (value / top) * PLOT) : 0)
  const narrow = band < 38
  const name = (bucket: Bucket) => periodLabel(i18n, bucket.period)

  const shown = active === null ? null : buckets[active]
  const center = active === null ? 0 : AXIS_Y + band * (active + 0.5)
  // The numbers sit beside the column, never over its bars
  const tipLeft = shown ? (center + band / 2 + TIP + 4 <= width ? center + band / 2 + 4 : Math.max(0, center - band / 2 - TIP - 4)) : 0

  return (
    <div ref={box} className={cx('relative transition-opacity duration-200 select-none', waiting && 'opacity-60')} style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label} className="block overflow-visible">
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={AXIS_Y}
                x2={width}
                y1={y(tick)}
                y2={y(tick)}
                stroke={tick === 0 ? 'var(--line-strong)' : 'var(--line)'}
                strokeWidth={1}
                shapeRendering="crispEdges"
              />
              <text x={AXIS_Y - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-ink-3 text-[0.6875rem] tabular">
                {formatMoney(tick)}
              </text>
            </g>
          ))}
          {buckets.map((bucket, index) => {
            const middle = AXIS_Y + band * (index + 0.5)
            const inHeight = size(bucket.in)
            const outHeight = size(bucket.out)
            return (
              <g key={bucket.key}>
                {(active === index || bucket.key === viewed) && (
                  <rect x={middle - band / 2 + 2} y={TOP - 6} width={band - 4} height={PLOT + 6} rx={6} fill={active === index ? 'var(--well)' : 'var(--surface-2)'} />
                )}
                <path d={column(middle - 1 - bar, TOP + PLOT - inHeight, bar, inHeight)} fill="var(--series-in)" />
                <path d={column(middle + 1, TOP + PLOT - outHeight, bar, outHeight)} fill="var(--series-out)" />
                <text
                  x={middle}
                  y={TOP + PLOT + 18}
                  textAnchor="middle"
                  className={cx('text-[0.6875rem]', bucket.key === viewed ? 'fill-ink font-semibold' : 'fill-ink-3')}
                >
                  {/* A period is named by the month it starts in; the tip and the table give its days */}
                  {date(bucket.period.start, { month: narrow ? 'narrow' : 'short' })}
                </text>
              </g>
            )
          })}
        </svg>
      )}
      {width > 0 &&
        buckets.map((bucket, index) => (
          <button
            key={bucket.key}
            type="button"
            aria-label={`${fmt(t.finance.months.show, { month: name(bucket) })}. ${t.finance.balance.in} ${money(bucket.in)}, ${t.finance.balance.out} ${money(bucket.out)}`}
            aria-current={bucket.key === viewed ? 'date' : undefined}
            onPointerEnter={() => setActive(index)}
            onPointerLeave={() => setActive((current) => (current === index ? null : current))}
            onFocus={() => setActive(index)}
            onBlur={() => setActive((current) => (current === index ? null : current))}
            onClick={() => onPick(bucket.period)}
            className="absolute top-0 cursor-pointer rounded-[0.5rem] outline-none focus-visible:ring-2 focus-visible:ring-focus"
            style={{ left: AXIS_Y + band * index, width: band, height }}
          />
        ))}
      {shown && (
        <div
          aria-hidden
          className="pointer-events-none absolute z-10 rounded-control border border-line bg-surface px-3 py-2 text-[0.8125rem] shadow-lift"
          style={{ left: tipLeft, top: TOP, width: TIP }}
        >
          <p className={cx('font-medium text-ink', months && 'first-letter:uppercase')}>{name(shown)}</p>
          <TipRow tone="in" value={money(shown.in)} label={t.finance.balance.in} />
          <TipRow tone="out" value={money(shown.out)} label={t.finance.balance.out} />
          <p className="mt-1.5 flex items-baseline gap-2 border-t border-line pt-1.5">
            <span className="font-semibold text-ink tabular">
              {shown.in - shown.out < 0 ? MINUS : ''}
              {money(Math.abs(shown.in - shown.out))}
            </span>
            <span className="text-ink-3">{t.finance.months.difference}</span>
          </p>
        </div>
      )}
    </div>
  )
}

function TipRow({ tone, value, label }: { tone: 'in' | 'out'; value: string; label: string }) {
  return (
    <p className="mt-1 flex items-center gap-2">
      <span aria-hidden className={cx('h-0.5 w-3 shrink-0 rounded-full', tone === 'in' ? 'bg-series-in' : 'bg-series-out')} />
      <span className="font-semibold text-ink tabular">{value}</span>
      <span className="text-ink-3">{label}</span>
    </p>
  )
}

/** The same numbers as rows: the exact amounts, and the chart without colour. */
function MonthsTable({ buckets, caption, months }: { buckets: Bucket[]; caption: string; months: boolean }) {
  const i18n = useI18n()
  const { t, money } = i18n
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line text-[0.8125rem] text-ink-3">
            <th scope="col" className="py-2 pr-3 text-left font-medium">
              {months ? t.finance.months.month : t.finance.months.period}
            </th>
            <th scope="col" className="py-2 pl-3 text-right font-medium">
              {t.finance.balance.in}
            </th>
            <th scope="col" className="py-2 pl-3 text-right font-medium">
              {t.finance.balance.out}
            </th>
            <th scope="col" className="py-2 pl-3 text-right font-medium">
              {t.finance.months.difference}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {[...buckets].reverse().map((bucket) => {
            const difference = bucket.in - bucket.out
            return (
              <tr key={bucket.key}>
                <th scope="row" className={cx('py-2 pr-3 text-left font-normal whitespace-nowrap', months && 'first-letter:uppercase')}>
                  {periodLabel(i18n, bucket.period)}
                </th>
                <td className="py-2 pl-3 text-right tabular">{money(bucket.in)}</td>
                <td className="py-2 pl-3 text-right tabular">{money(bucket.out)}</td>
                <td className={cx('py-2 pl-3 text-right font-medium tabular', difference < 0 && 'text-negative-ink')}>
                  {difference < 0 ? MINUS : ''}
                  {money(Math.abs(difference))}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
