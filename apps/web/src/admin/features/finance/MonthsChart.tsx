import { useMemo, useRef, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { addMonths, format, startOfMonth, subMonths } from 'date-fns'
import { moneySince } from '@hellokido/core/api'
import { formatMoney } from '@hellokido/core/rules/money.js'
import { keys } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { LoadError, Skeleton } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { Segmented } from '../../ui/Choice'
import { Section } from '../../ui/Page'
import { cx } from '../../ui/cx'
import { MINUS, useWidth } from './bits'
import { isWholeMonth, type Period } from './period'

type Bucket = { start: Date; key: string; in: number; out: number }
type Span = '6' | '12'

const PLOT = 176
const TOP = 10
const AXIS_X = 26
const AXIS_Y = 54
const TIP = 176

/**
 * Round steps (1, 2, 2.5, 5 × 10ⁿ) so the grid reads in plain numbers: three to five of them, the
 * set whose top line sits closest above the tallest bar, so the bars use the height they have.
 */
function niceTicks(max: number) {
  if (max <= 0) return [0, 1000]
  const power = 10 ** Math.floor(Math.log10(max))
  let best = { step: power, top: Infinity }
  for (const step of [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5].map((m) => m * power)) {
    const lines = Math.ceil(max / step - 1e-9)
    if (lines >= 3 && lines <= 5 && lines * step < best.top) best = { step, top: lines * step }
  }
  return Array.from({ length: Math.round(best.top / best.step) + 1 }, (_, index) => index * best.step)
}

/** A column with a rounded top and a square foot on the baseline. */
function column(x: number, top: number, width: number, height: number) {
  if (height <= 0) return ''
  const r = Math.min(4, width / 2, height)
  const bottom = top + height
  return `M${x},${bottom}V${top + r}A${r},${r} 0 0 1 ${x + r},${top}H${x + width - r}A${r},${r} 0 0 1 ${x + width},${top + r}V${bottom}Z`
}

/**
 * Money in and out for each of the last months, whole months from the 1st. It does not follow the
 * period or the filters above; pressing a month shows that month on the page.
 */
export function MonthsChart({ today, period, onPick, className }: { today: Date; period: Period; onPick: (month: Date) => void; className?: string }) {
  const { t, fmt } = useI18n()
  const [span, setSpan] = useState<Span>('6')
  const [asTable, setAsTable] = useState(false)
  const count = Number(span)
  const first = useMemo(() => startOfMonth(subMonths(today, count - 1)), [today, count])
  const query = useQuery({ queryKey: keys.finance('months', first.toISOString()), queryFn: () => moneySince(first), placeholderData: keepPreviousData })

  // Buckets come from the 1st of each month; counting back from today skipped months on the 29th–31st
  const buckets = useMemo<Bucket[]>(() => {
    const list = Array.from({ length: count }, (_, index) => {
      const start = addMonths(first, index)
      return { start, key: format(start, 'yyyy-MM'), in: 0, out: 0 }
    })
    const byKey = new Map(list.map((bucket) => [bucket.key, bucket]))
    for (const row of query.data?.income ?? []) {
      const bucket = byKey.get(format(new Date(row.date), 'yyyy-MM'))
      if (bucket) bucket.in += row.amount
    }
    for (const row of query.data?.expenses ?? []) {
      const bucket = byKey.get(format(new Date(row.date), 'yyyy-MM'))
      if (bucket) bucket.out += row.amount
    }
    return list
  }, [query.data, first, count])

  const viewed = isWholeMonth(period) ? format(period.start, 'yyyy-MM') : null

  return (
    <Section
      title={t.finance.months.title}
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
      className={className}
    >
      {/* The table names its columns itself */}
      {!asTable && (
        <div className="mb-3 flex items-center gap-4 text-[0.8125rem] text-ink-2">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-[2px] bg-series-in" />
            {t.finance.balance.in}
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-[2px] bg-series-out" />
            {t.finance.balance.out}
          </span>
        </div>
      )}
      {query.isError ? (
        <LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={() => void query.refetch()} />
      ) : !query.data ? (
        <Skeleton className="h-[13.25rem] rounded-control" />
      ) : asTable ? (
        <MonthsTable buckets={buckets} caption={fmt(t.finance.months.chartLabel, { count })} />
      ) : (
        <Plot buckets={buckets} viewed={viewed} onPick={onPick} waiting={query.isPlaceholderData} label={fmt(t.finance.months.chartLabel, { count })} />
      )}
      <Button variant="ghost" size="sm" className="mt-2 -ml-3" onPress={() => setAsTable((on) => !on)}>
        {asTable ? t.finance.months.chart : t.finance.months.table}
      </Button>
    </Section>
  )
}

function Plot({ buckets, viewed, onPick, waiting, label }: { buckets: Bucket[]; viewed: string | null; onPick: (month: Date) => void; waiting: boolean; label: string }) {
  const { t, fmt, money, date } = useI18n()
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
  const monthName = (bucket: Bucket) => date(bucket.start, { month: 'long', year: 'numeric' })

  const shown = active === null ? null : buckets[active]
  const center = active === null ? 0 : AXIS_Y + band * (active + 0.5)
  // The numbers sit beside the month, never over its bars
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
                {active === index && <rect x={middle - band / 2 + 2} y={TOP - 6} width={band - 4} height={PLOT + 6} rx={6} fill="var(--well)" />}
                <path d={column(middle - 1 - bar, TOP + PLOT - inHeight, bar, inHeight)} fill="var(--series-in)" />
                <path d={column(middle + 1, TOP + PLOT - outHeight, bar, outHeight)} fill="var(--series-out)" />
                <text
                  x={middle}
                  y={TOP + PLOT + 18}
                  textAnchor="middle"
                  className={cx('text-[0.6875rem]', bucket.key === viewed ? 'fill-ink font-semibold' : 'fill-ink-3')}
                >
                  {date(bucket.start, { month: narrow ? 'narrow' : 'short' })}
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
            aria-label={`${fmt(t.finance.months.show, { month: monthName(bucket) })}. ${t.finance.balance.in} ${money(bucket.in)}, ${t.finance.balance.out} ${money(bucket.out)}`}
            aria-current={bucket.key === viewed ? 'date' : undefined}
            onPointerEnter={() => setActive(index)}
            onPointerLeave={() => setActive((current) => (current === index ? null : current))}
            onFocus={() => setActive(index)}
            onBlur={() => setActive((current) => (current === index ? null : current))}
            onClick={() => onPick(bucket.start)}
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
          <p className="font-medium text-ink first-letter:uppercase">{monthName(shown)}</p>
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
function MonthsTable({ buckets, caption }: { buckets: Bucket[]; caption: string }) {
  const { t, money, date } = useI18n()
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line text-[0.8125rem] text-ink-3">
            <th scope="col" className="py-2 pr-3 text-left font-medium">
              {t.finance.months.month}
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
                <th scope="row" className="py-2 pr-3 text-left font-normal whitespace-nowrap first-letter:uppercase">
                  {date(bucket.start, { month: 'long', year: 'numeric' })}
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
