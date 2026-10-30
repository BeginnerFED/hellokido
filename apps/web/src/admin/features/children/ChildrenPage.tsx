import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-aria-components'
import { useParams } from 'react-router'
import { ArchiveIcon, ArrowUUpLeftIcon, HandCoinsIcon, PlusIcon } from '@phosphor-icons/react'
import type { Registration, Usage, UsageMap } from '@hellokido/core/api'
import { useActiveUsage, useLabels, useRegistrations } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useActions } from '../../shell/Actions'
import { Avatar, EmptyState, LoadError, Skeleton } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { ChipSelect, Chips, Segmented, type Option } from '../../ui/Choice'
import { SearchField } from '../../ui/Field'
import { Page } from '../../ui/Page'
import { displayPhone } from '../../ui/PhoneActions'
import { BeadBar } from '../../ui/signature'
import { cx } from '../../ui/cx'
import { beadsLabel, packageStartText, ParentName, remainingText } from './ChildBits'
import { ActivateDialog, ArchiveDialog, ChildPage, ChildPageFallback } from './ChildDetail'
import { usePackageOptions } from './packageOptions'
import { byNewest, isFree, isPaymentDue, isRunningLow, matchesChild, needsRenewal } from './rules'

type View = 'active' | 'archived'
type Filter = 'all' | 'pending' | 'low'
const ANY_PACKAGE = 'all'

const TESTS: Record<Exclude<Filter, 'all'>, (row: Registration, usage: UsageMap | undefined) => boolean> = {
  pending: (row) => isPaymentDue(row),
  low: (row, usage) => !isFree(row) && isRunningLow(usage?.[row.id])
}

// As many cards to a row as fit at 19.5rem; a phone shows one
const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(min(100%,19.5rem),1fr))] gap-3.5 @lg:gap-4'

/**
 * The children as felt cards, the newest registration first: search and filters on top, then a card
 * per child with the package, the lessons left, the payment and the parent. A child opens on a page
 * of its own; the list keeps its search, filters and scroll position for the way back.
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
  const [dialog, setDialog] = useState<{ kind: 'archive' | 'activate'; registration: Registration } | null>(null)
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
      return list.sort((a, b) => (usage?.[a.id]?.remaining ?? 0) - (usage?.[b.id]?.remaining ?? 0) || byNewest(a, b))
    }
    return list.sort(byNewest)
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
      <section aria-label={t.children.title} className="@container">
        <div className="mb-4 flex flex-col gap-3 @3xl:flex-row @3xl:flex-wrap @3xl:items-center">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder={t.children.searchPlaceholder}
            label={t.children.searchPlaceholder}
            className="@3xl:w-[25rem] @3xl:max-w-full"
          />
          {/* Narrow: one row of filters that scrolls sideways; its padding keeps the chips' touch area inside */}
          <div className="-mx-4 -my-1.5 flex items-center gap-2 overflow-x-auto px-4 py-1.5 @3xl:mx-0 @3xl:my-0 @3xl:overflow-visible @3xl:px-0 @3xl:py-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
          <div className="rounded-panel bg-felt p-4 @lg:p-[1.375rem]">
            <LoadError message={t.children.loadFailed} retryLabel={t.common.retry} onRetry={() => void registrations.refetch()} />
          </div>
        ) : !rows ? (
          <div className={GRID} aria-busy>
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="flex h-[16rem] flex-col gap-4 rounded-panel bg-felt px-[1.375rem] pt-[1.125rem]">
                <Skeleton className="h-12 w-2/3" />
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-8 w-1/3" />
              </div>
            ))}
          </div>
        ) : shown.length === 0 ? (
          <div className="on-felt rounded-panel bg-felt py-4">{empty}</div>
        ) : (
          <ul aria-label={plural(t.children.count, shown.length)} className={GRID}>
            {shown.map((row) => (
              <li key={row.id} className="flex min-w-0">
                <ChildCard
                  row={row}
                  own={usage?.[row.id]}
                  usageFailed={usageFailed}
                  onOpen={() => {
                    listScroll.current = window.scrollY
                  }}
                  onPay={() => startTask('payment', { registrationId: row.id })}
                  onArchive={() => setDialog({ kind: 'archive', registration: row })}
                  onActivate={() => setDialog({ kind: 'activate', registration: row })}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
      {dialog?.kind === 'archive' && <ArchiveDialog registration={dialog.registration} isOpen onOpenChange={(open) => !open && setDialog(null)} />}
      {dialog?.kind === 'activate' && <ActivateDialog registration={dialog.registration} isOpen onOpenChange={(open) => !open && setDialog(null)} />}
    </Page>
  )
}

type CardActions = { onOpen: () => void; onPay: () => void; onArchive: () => void; onActivate: () => void }

/**
 * A child as a felt card: the name and age with the payment at the right, the package with its
 * lessons left over a bar of its lessons, the parent, and at the foot "Ödeme al" and "Arşivle"
 * ("Arşivden çıkar" in the archive). Cards in a row share its height, so the feet line up. The
 * whole card opens the child: its link lies over the card and the buttons sit above the link.
 */
function ChildCard({ row, own, usageFailed, onOpen, onPay, onArchive, onActivate }: { row: Registration; own: Usage | undefined; usageFailed: boolean } & CardActions) {
  const i18n = useI18n()
  const { t } = i18n
  const labels = useLabels()
  const active = row.is_active === true
  const free = isFree(row)
  const age = row.student_age?.trim()
  const actions = t.children.detail.actions

  return (
    <article
      className={cx(
        'on-felt relative flex w-full min-w-0 flex-col rounded-panel bg-felt text-ink',
        // A step darker under the pointer, as the figure tiles are; not while a button is under it
        'transition-[background-color,scale] duration-150 has-[a[data-hovered]]:bg-[color-mix(in_oklab,var(--felt)_94%,var(--ink))] has-[a[data-pressed]]:scale-[0.99]',
        'has-[a[data-focus-visible]]:ring-2 has-[a[data-focus-visible]]:ring-focus has-[a[data-focus-visible]]:ring-offset-2 has-[a[data-focus-visible]]:ring-offset-page'
      )}
    >
      <Link href={`/children/${row.id}`} onPress={onOpen} aria-label={row.student_name} className="absolute inset-0 rounded-[inherit] outline-none" />
      <span className="flex items-center gap-3 px-[1.375rem] pt-[1.125rem]">
        <Avatar name={row.student_name} size="lg" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[1.0625rem] leading-[1.375rem] font-semibold">{row.student_name}</span>
          {age && <span className="block truncate text-[0.84375rem] leading-[1.125rem] text-ink-3">{age}</span>}
        </span>
        {active && <PaymentMark free={free} due={isPaymentDue(row)} />}
      </span>

      <span className="flex flex-col px-[1.375rem] pt-4 pb-[1.125rem]">
        <span className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-[0.9375rem] leading-5 font-medium text-ink-2">{labels.packageName(row.package_type)}</span>
          <span className="shrink-0 text-[0.8125rem] leading-[1.125rem] text-ink-3 tabular">
            {free ? t.children.detail.unlimited : packageStartText(i18n, row.package_start_date, row.package_type)}
          </span>
        </span>
        {active && <LessonsLeft row={row} own={own} failed={usageFailed} />}
      </span>

      <div className="mt-auto border-t border-line">
        <span className="flex items-center gap-3 px-[1.375rem] py-3 text-[0.84375rem] leading-[1.125rem] text-ink-3">
          <span className="min-w-0 flex-1 truncate">
            <ParentName template={t.children.phone.parentOf} name={row.parent_name} />
          </span>
          <span className="shrink-0 tabular">{displayPhone(row.parent_phone)}</span>
        </span>
        {/* The gap between the buttons still opens the child */}
        <div className="pointer-events-none relative flex gap-2 px-[1.125rem] pb-[1.125rem]">
          {active ? (
            <>
              <Button size="sm" variant="quiet" className="pointer-events-auto flex-1" icon={<HandCoinsIcon aria-hidden className="size-4" />} onPress={onPay}>
                {actions.payShort}
              </Button>
              <Button size="sm" variant="danger-tint" className="pointer-events-auto flex-1" icon={<ArchiveIcon aria-hidden className="size-4" />} onPress={onArchive}>
                {actions.archiveShort}
              </Button>
            </>
          ) : (
            <Button size="sm" variant="quiet" className="pointer-events-auto flex-1" icon={<ArrowUUpLeftIcon aria-hidden className="size-4" />} onPress={onActivate}>
              {actions.activateShort}
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}

/**
 * "5 ders kaldı" over the bar of the package's lessons; in amber with "Bitmek üzere" or "Paket
 * bitti" once the package needs renewing (a fresh single session is not running out). Free
 * participation has no count.
 */
function LessonsLeft({ row, own, failed }: { row: Registration; own: Usage | undefined; failed: boolean }) {
  const i18n = useI18n()
  const { t, plural } = i18n
  if (isFree(row)) return <span className="mt-2 text-sm text-ink-3">{t.children.form.noQuota}</span>
  if (!own) {
    return failed ? (
      <span className="mt-2 text-sm text-ink-3">{t.children.phone.usageFailed}</span>
    ) : (
      <span aria-hidden className="mt-2.5 flex flex-col gap-3">
        <span className="h-7 w-32 animate-shimmer rounded-lg bg-track" />
        <span className="h-2 animate-shimmer rounded-full bg-track" />
      </span>
    )
  }
  const left = Math.max(own.remaining ?? 0, 0)
  const ending = needsRenewal(row, own)
  return (
    <>
      <span className={cx('mt-1.5 flex items-baseline gap-2', ending && 'text-amber-ink')}>
        <span aria-hidden className="text-[1.625rem] leading-8 font-semibold tracking-[-0.02em] tabular">
          {left}
        </span>
        <span aria-hidden className={cx('text-[0.9375rem]', ending ? 'font-medium' : 'text-ink-2')}>
          {plural(t.children.phone.leftUnit, left)}
        </span>
        {ending && (
          <span aria-hidden className="ml-auto text-[0.8125rem] font-medium whitespace-nowrap">
            {left <= 0 ? t.children.ending.ended : t.children.ending.soon}
          </span>
        )}
        <span className="sr-only">{remainingText(i18n, own)}</span>
      </span>
      <BeadBar usage={own} label={beadsLabel(i18n, own)} className="mt-2.5" />
    </>
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
    <span className={cx('inline-flex shrink-0 items-center gap-[0.4375rem] text-[0.8125rem] whitespace-nowrap', ink)}>
      <span aria-hidden className={cx('size-2 shrink-0 rounded-full', dot)} />
      {text}
    </span>
  )
}
