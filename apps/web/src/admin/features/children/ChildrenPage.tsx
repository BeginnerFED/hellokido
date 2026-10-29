import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-aria-components'
import { useParams } from 'react-router'
import { CaretRightIcon, PlusIcon } from '@phosphor-icons/react'
import type { Registration, Usage, UsageMap } from '@hellokido/core/api'
import { useActiveUsage, useLabels, useRegistrations } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useActions } from '../../shell/Actions'
import { Avatar, EmptyState, LoadError, Mark, Skeleton } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { ChipSelect, Chips, Segmented, type Option } from '../../ui/Choice'
import { SearchField } from '../../ui/Field'
import { Page } from '../../ui/Page'
import { displayPhone } from '../../ui/PhoneActions'
import { cx } from '../../ui/cx'
import { packageStartText, ParentName, remainingText } from './ChildBits'
import { ChildPage, ChildPageFallback } from './ChildDetail'
import { usePackageOptions } from './packageOptions'
import { byName, isFree, isPaymentDue, isRunningLow, matchesChild, needsRenewal } from './rules'

type View = 'active' | 'archived'
type Filter = 'all' | 'pending' | 'low'
const ANY_PACKAGE = 'all'

const TESTS: Record<Exclude<Filter, 'all'>, (row: Registration, usage: UsageMap | undefined) => boolean> = {
  pending: (row) => isPaymentDue(row),
  low: (row, usage) => !isFree(row) && isRunningLow(usage?.[row.id])
}

// The table's columns, once the card is wide enough for them; archived children have no lessons
// left or payment to show
const COLUMNS = {
  active: '@4xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1.1fr)_minmax(0,1.2fr)_8rem_10.5rem_1.125rem]',
  archived: '@4xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1.1fr)_minmax(0,1.2fr)_1.125rem]'
}

/**
 * The children as one felt table: search and filters on top, a row per child with the parent, the
 * package, the lessons left and the payment. A child opens on a page of its own; the list keeps its
 * search, filters and scroll position for the way back.
 */
export default function ChildrenPage() {
  const { id } = useParams()
  const { t, plural } = useI18n()
  const labels = useLabels()
  const { startTask } = useActions()
  const registrations = useRegistrations()
  const activeUsage = useActiveUsage()
  const usage = activeUsage.data
  const usageFailed = activeUsage.isError && !usage
  const packageOrder = usePackageOptions({ includeFree: true })

  const [view, setView] = useState<View>('active')
  const [filter, setFilter] = useState<Filter>('all')
  const [pkg, setPkg] = useState<string>(ANY_PACKAGE)
  const [query, setQuery] = useState('')
  const listScroll = useRef(0)

  // A child opens at its top; the list comes back where it was left
  useLayoutEffect(() => {
    window.scrollTo(0, id ? 0 : listScroll.current)
  }, [id])

  const rows = registrations.data
  const inView = useMemo(() => (rows ?? []).filter((row) => (view === 'active' ? row.is_active === true : row.is_active !== true)), [rows, view])
  const searched = useMemo(() => inView.filter((row) => matchesChild(row, query)), [inView, query])
  const inPackage = useMemo(() => (pkg === ANY_PACKAGE ? searched : searched.filter((row) => row.package_type === pkg)), [searched, pkg])

  const shown = useMemo(() => {
    const list = view === 'active' && filter !== 'all' ? inPackage.filter((row) => TESTS[filter](row, usage)) : [...inPackage]
    if (view === 'active' && filter === 'low') {
      return list.sort((a, b) => (usage?.[a.id]?.remaining ?? 0) - (usage?.[b.id]?.remaining ?? 0) || byName(a, b))
    }
    return list.sort(byName)
  }, [inPackage, view, filter, usage])

  // Filters are toggles: none on shows every child, so there is no "all" chip. No count before the
  // list has loaded: a 0 there would say "nobody" while it is not known yet
  const filterOptions: Option<Filter>[] = [
    { id: 'pending', label: t.children.filters.pending, badge: rows ? inPackage.filter((row) => TESTS.pending(row, usage)).length : undefined },
    { id: 'low', label: t.children.filters.low, badge: rows && usage ? inPackage.filter((row) => TESTS.low(row, usage)).length : undefined }
  ]

  // Only the packages children in this view actually have, in the catalog's order
  const packageOptions = useMemo(() => {
    const order = packageOrder.map((option) => option.id)
    const counts = new Map<string, number>()
    for (const row of searched) counts.set(row.package_type, (counts.get(row.package_type) ?? 0) + 1)
    const rank = (code: string) => (order.indexOf(code) === -1 ? order.length : order.indexOf(code))
    const codes = [...counts.keys()].sort((a, b) => rank(a) - rank(b))
    return [
      { id: ANY_PACKAGE, label: t.children.anyPackage },
      ...codes.map((code) => ({ id: code, label: labels.packageName(code), badge: counts.get(code) }))
    ] as Option[]
  }, [packageOrder, searched, labels, t])

  const changeView = (next: View) => {
    setView(next)
    setFilter('all')
    setPkg(ANY_PACKAGE)
  }
  const clearFilters = () => {
    setFilter('all')
    setPkg(ANY_PACKAGE)
    setQuery('')
  }

  if (id) {
    const found = rows ? (rows.find((row) => row.id === id) ?? null) : undefined
    // A child registered a moment ago is not in the list until it has read again: wait, don't say "not found"
    const selected = found === null && registrations.isFetching ? undefined : found
    if (registrations.isError) return <ChildPageFallback state="error" onRetry={() => void registrations.refetch()} />
    if (selected === undefined) return <ChildPageFallback state="loading" />
    if (selected === null) return <ChildPageFallback state="missing" />
    return <ChildPage key={selected.id} registration={selected} />
  }

  const toolbar = (
    <Segmented<View>
      aria-label={t.children.title}
      value={view}
      onChange={changeView}
      options={[
        { id: 'active', label: t.children.views.active },
        { id: 'archived', label: t.children.views.archived }
      ]}
      className="min-w-0 flex-1 lg:w-[11.5rem] lg:flex-none"
    />
  )

  const empty = !rows ? null : rows.length === 0 ? (
    <EmptyState
      title={t.children.empty.none}
      body={t.children.empty.noneBody}
      action={
        <Button variant="primary" icon={<PlusIcon aria-hidden weight="bold" className="size-4" />} onPress={() => startTask('registration')}>
          {t.children.newRegistration}
        </Button>
      }
    />
  ) : view === 'archived' && inView.length === 0 ? (
    <EmptyState title={t.children.empty.archive} />
  ) : (
    <EmptyState
      title={query.trim() ? t.children.empty.search : t.children.empty.filters}
      action={
        <Button variant="secondary" size="sm" onPress={clearFilters}>
          {t.common.clearFilters}
        </Button>
      }
    />
  )

  return (
    <Page
      title={t.children.title}
      summary={rows && plural(t.children.count, shown.length)}
      toolbar={toolbar}
      action={{ label: t.children.newRegistration, onPress: () => startTask('registration') }}
      width="wide"
    >
      <section aria-label={t.children.title} className="@container on-felt rounded-panel bg-felt">
        <div className="flex flex-col gap-3 px-4 pt-4 pb-3.5 @lg:px-[1.375rem] @lg:pt-[1.125rem] @lg:pb-4 @3xl:flex-row @3xl:flex-wrap @3xl:items-center">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder={t.children.searchPlaceholder}
            label={t.children.searchPlaceholder}
            className="@3xl:w-[25rem] @3xl:max-w-full"
          />
          {/* Narrow: one row of filters that scrolls sideways; its padding keeps the chips' touch area inside */}
          <div className="-mx-4 -my-1.5 flex items-center gap-2 overflow-x-auto px-4 py-1.5 @lg:-mx-[1.375rem] @lg:px-[1.375rem] @3xl:mx-0 @3xl:my-0 @3xl:overflow-visible @3xl:px-0 @3xl:py-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {view === 'active' && (
              <Chips
                aria-label={t.children.filters.label}
                options={filterOptions}
                selected={filter === 'all' ? [] : [filter]}
                onChange={(next) => setFilter(next[0] ?? 'all')}
                className="w-max shrink-0 flex-nowrap"
              />
            )}
            <ChipSelect aria-label={t.children.anyPackage} options={packageOptions} value={pkg} neutral={ANY_PACKAGE} onChange={setPkg} />
          </div>
        </div>

        {registrations.isError ? (
          <div className="border-t border-line px-4 py-4 @lg:px-[1.375rem]">
            <LoadError message={t.children.loadFailed} retryLabel={t.common.retry} onRetry={() => void registrations.refetch()} />
          </div>
        ) : !rows ? (
          <div className="flex flex-col gap-2 border-t border-line px-4 pt-3 pb-4 @lg:px-[1.375rem]" aria-busy>
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton key={index} className="h-[3.75rem]" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <div className="border-t border-line py-4">{empty}</div>
        ) : (
          <>
            <div
              aria-hidden
              className={cx(
                'hidden gap-x-5 px-[2.125rem] pb-2.5 text-[0.8125rem] font-semibold text-ink-3 @4xl:grid',
                view === 'active' ? COLUMNS.active : COLUMNS.archived
              )}
            >
              <span>{t.children.columns.child}</span>
              <span>{t.children.columns.parent}</span>
              <span>{t.children.columns.package}</span>
              {view === 'active' && (
                <>
                  <span>{t.children.columns.left}</span>
                  <span>{t.children.columns.payment}</span>
                </>
              )}
            </div>
            <ul aria-label={plural(t.children.count, shown.length)} className="border-t border-line px-1.5 pt-1.5 pb-2 @lg:px-2.5 @4xl:px-3 @4xl:pb-3">
              {shown.map((row) => (
                <li
                  key={row.id}
                  className={cx(
                    // A hairline between rows; it steps aside for a row under the pointer
                    'relative before:pointer-events-none before:absolute before:inset-x-2.5 before:top-0 before:h-px before:bg-line first:before:hidden',
                    '@lg:before:inset-x-3 @4xl:before:inset-x-[1.375rem] [&:has([data-hovered])]:before:opacity-0 [li:has([data-hovered])+&]:before:opacity-0'
                  )}
                >
                  <ChildRow
                    row={row}
                    own={usage?.[row.id]}
                    usageFailed={usageFailed}
                    onOpen={() => {
                      listScroll.current = window.scrollY
                    }}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </Page>
  )
}

/**
 * A child in the table: the child, the parent, the package, the lessons left and the payment, and
 * the whole row opens the child. Narrow, it keeps the name, the package and parent in one line
 * (a payment due before them) and the lessons left.
 */
function ChildRow({ row, own, usageFailed, onOpen }: { row: Registration; own: Usage | undefined; usageFailed: boolean; onOpen: () => void }) {
  const i18n = useI18n()
  const { t } = i18n
  const labels = useLabels()
  const active = row.is_active === true
  const free = isFree(row)
  const due = isPaymentDue(row)
  const line = 'truncate text-[0.84375rem] leading-[1.125rem] text-ink-3'

  return (
    <Link
      href={`/children/${row.id}`}
      onPress={onOpen}
      className={cx(
        'group flex items-center gap-3 rounded-[1.125rem] px-2.5 py-3 text-left text-ink no-underline outline-none @lg:px-3',
        '@4xl:grid @4xl:gap-x-5 @4xl:px-[1.375rem]',
        active ? COLUMNS.active : COLUMNS.archived,
        'transition-colors duration-150 data-hovered:bg-hover data-pressed:bg-hover data-focus-visible:ring-2 data-focus-visible:ring-focus data-focus-visible:ring-inset'
      )}
    >
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={row.student_name} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base leading-[1.3125rem] font-medium">{row.student_name}</span>
          {row.student_age?.trim() && <span className={cx(line, 'hidden @4xl:block')}>{row.student_age}</span>}
          <span className="flex min-w-0 items-center gap-2 @4xl:hidden">
            {due && <Mark tone="action">{t.children.pendingPayment}</Mark>}
            <span className={cx('block min-w-0', line)}>
              {labels.packageName(row.package_type)}
              {row.parent_name?.trim() && ' · '}
              <ParentName template={t.children.phone.parentOf} name={row.parent_name} />
            </span>
          </span>
        </span>
      </span>

      <span className="hidden min-w-0 @4xl:block">
        <span className="block truncate text-[0.9375rem] leading-5">{row.parent_name}</span>
        <span className={cx('block tabular', line)}>{displayPhone(row.parent_phone)}</span>
      </span>

      <span className="hidden min-w-0 @4xl:block">
        <span className="block truncate text-[0.9375rem] leading-5">{labels.packageName(row.package_type)}</span>
        <span className={cx('block tabular', line)}>{free ? t.children.detail.unlimited : packageStartText(i18n, row.package_start_date, row.package_type)}</span>
      </span>

      {active && <LessonsLeft row={row} own={own} failed={usageFailed} />}

      {active && (
        <span className="hidden @4xl:flex">
          <PaymentMark free={free} due={due} />
        </span>
      )}

      <CaretRightIcon aria-hidden className="size-[1.125rem] shrink-0 text-mute transition-colors duration-150 group-data-hovered:text-ink-3" />
    </Link>
  )
}

/**
 * "5 ders", in amber with "Bitmek üzere" or "Paket bitti" under it once the package needs renewing
 * (a fresh single session is not running out). Free participation has no count.
 */
function LessonsLeft({ row, own, failed }: { row: Registration; own: Usage | undefined; failed: boolean }) {
  const i18n = useI18n()
  const { t, plural } = i18n
  if (isFree(row)) return <span className="shrink-0 text-sm text-ink-3">{t.children.form.noQuota}</span>
  if (!own) {
    return failed ? (
      <span aria-hidden className="w-8 shrink-0 text-ink-3">
        –
      </span>
    ) : (
      <span aria-hidden className="h-6 w-14 shrink-0 animate-shimmer rounded-lg bg-track" />
    )
  }
  const left = Math.max(own.remaining ?? 0, 0)
  const ending = needsRenewal(row, own)
  return (
    <span className={cx('flex shrink-0 flex-col items-end @4xl:items-start', ending && 'text-amber-ink')}>
      <span aria-hidden className="flex items-baseline gap-1.5">
        <span className="text-xl leading-6 font-semibold tracking-[-0.02em] tabular">{left}</span>
        <span className={cx('text-sm', !ending && 'text-ink-3')}>{plural(t.children.phone.lessonsUnit, left)}</span>
      </span>
      {ending && (
        <span aria-hidden className="hidden text-[0.8125rem] leading-[1.125rem] font-medium @lg:block">
          {left <= 0 ? t.children.ending.ended : t.children.ending.soon}
        </span>
      )}
      <span className="sr-only">{remainingText(i18n, own)}</span>
    </span>
  )
}

/** Paid is quiet (a green dot), a payment due is amber, free is grey. */
function PaymentMark({ free, due }: { free: boolean; due: boolean }) {
  const { t } = useI18n()
  const [dot, ink, text] = free
    ? ['bg-mute', 'text-ink-3', t.children.free]
    : due
      ? ['bg-amber', 'font-medium text-amber-ink', t.children.pendingPayment]
      : ['bg-green', 'font-medium text-ink-2', t.children.paid]
  return (
    <span className={cx('inline-flex items-center gap-[0.4375rem] text-sm whitespace-nowrap', ink)}>
      <span aria-hidden className={cx('size-2 shrink-0 rounded-full', dot)} />
      {text}
    </span>
  )
}
