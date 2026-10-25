import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-aria-components'
import { useParams } from 'react-router'
import { PlusIcon, UserFocusIcon } from '@phosphor-icons/react'
import type { Registration, UsageMap } from '@hellokido/core/api'
import { useActiveUsage, useLabels, useRegistrations } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useActions } from '../../shell/Actions'
import { Avatar, EmptyState, LoadError, Mark, Skeleton } from '../../ui/Bits'
import { Button, ButtonLink } from '../../ui/Button'
import { Chips, Segmented, Select, type Option } from '../../ui/Choice'
import { SearchField } from '../../ui/Field'
import { Page } from '../../ui/Page'
import { useWideLayout } from '../../ui/useMediaQuery'
import { cx } from '../../ui/cx'
import { endText, UsageLine } from './ChildBits'
import { ChildDetail } from './ChildDetail'
import { usePackageOptions } from './packageOptions'
import { byName, daysLeft, ENDING_WINDOW_DAYS, isEnding, isFree, isPaymentDue, isRunningLow, matchesChild } from './rules'

type View = 'active' | 'archived'
type Filter = 'all' | 'pending' | 'low' | 'ending'
const ANY_PACKAGE = 'all'

const TESTS: Record<Exclude<Filter, 'all'>, (row: Registration, usage: UsageMap | undefined) => boolean> = {
  pending: (row) => isPaymentDue(row),
  low: (row, usage) => !isFree(row) && isRunningLow(usage?.[row.id]),
  ending: (row) => isEnding(row)
}

/**
 * The children: a list to find one and a panel with everything about them. On a phone the panel is
 * its own screen and the list keeps its search, filter and scroll position for the way back.
 */
export default function ChildrenPage() {
  const { id } = useParams()
  const { t, plural } = useI18n()
  const labels = useLabels()
  const { startTask } = useActions()
  const wide = useWideLayout()
  const registrations = useRegistrations()
  const usage = useActiveUsage().data
  const packageOrder = usePackageOptions({ includeFree: true })

  const [view, setView] = useState<View>('active')
  const [filter, setFilter] = useState<Filter>('all')
  const [pkg, setPkg] = useState<string>(ANY_PACKAGE)
  const [query, setQuery] = useState('')

  const listScroll = useRef(0)
  const pane = useRef<HTMLElement>(null)

  // Phones: the detail opens at its top and the list comes back where it was left
  useLayoutEffect(() => {
    if (wide) {
      if (pane.current) pane.current.scrollTop = 0
      return
    }
    window.scrollTo(0, id ? 0 : listScroll.current)
  }, [id, wide])

  const rows = registrations.data
  const inView = useMemo(() => (rows ?? []).filter((row) => (view === 'active' ? row.is_active === true : row.is_active !== true)), [rows, view])
  const searched = useMemo(() => inView.filter((row) => matchesChild(row, query)), [inView, query])
  const inPackage = useMemo(() => (pkg === ANY_PACKAGE ? searched : searched.filter((row) => row.package_type === pkg)), [searched, pkg])

  const shown = useMemo(() => {
    const list = view === 'active' && filter !== 'all' ? inPackage.filter((row) => TESTS[filter](row, usage)) : [...inPackage]
    if (view === 'active' && filter === 'ending') {
      return list.sort((a, b) => new Date(a.package_end_date).getTime() - new Date(b.package_end_date).getTime() || byName(a, b))
    }
    if (view === 'active' && filter === 'low') {
      return list.sort((a, b) => (usage?.[a.id]?.remaining ?? 0) - (usage?.[b.id]?.remaining ?? 0) || byName(a, b))
    }
    return list.sort(byName)
  }, [inPackage, view, filter, usage])

  // Filters are toggles: none on shows every child, so there is no "all" chip. No count before the
  // list has loaded: a 0 there would say "nobody" while it is not known yet
  const filterOptions: Option<Filter>[] = [
    { id: 'pending', label: t.children.filters.pending, badge: rows ? inPackage.filter((row) => TESTS.pending(row, usage)).length : undefined },
    { id: 'low', label: t.children.filters.low, badge: rows && usage ? inPackage.filter((row) => TESTS.low(row, usage)).length : undefined },
    { id: 'ending', label: t.children.filters.ending, badge: rows ? inPackage.filter((row) => TESTS.ending(row, usage)).length : undefined }
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

  const selected = id && rows ? (rows.find((row) => row.id === id) ?? null) : undefined

  const detail = (showName: boolean) =>
    registrations.isError ? (
      <div className="p-5">
        <LoadError message={t.children.loadFailed} retryLabel={t.common.retry} onRetry={() => void registrations.refetch()} />
      </div>
    ) : selected === undefined ? (
      <div className="flex flex-col gap-4 p-5">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-10" />
        <Skeleton className="h-28" />
      </div>
    ) : selected === null ? (
      <EmptyState className="py-12" title={t.children.detail.notFound} />
    ) : (
      <ChildDetail key={selected.id} registration={selected} showName={showName} />
    )

  // Phones: one child fills the screen
  if (!wide && id) {
    return (
      <Page
        title={selected?.student_name ?? t.children.title}
        summary={selected?.student_age || undefined}
        back={{ href: '/children', label: t.children.detail.back }}
      >
        <div className="overflow-hidden rounded-panel border border-line bg-surface">{detail(false)}</div>
      </Page>
    )
  }

  const toolbar = (
    <>
      <Segmented<View>
        aria-label={t.children.title}
        value={view}
        onChange={changeView}
        options={[
          { id: 'active', label: t.children.views.active },
          { id: 'archived', label: t.children.views.archived }
        ]}
        className="min-w-0 flex-1 lg:order-2 lg:w-[12rem] lg:flex-none"
      />
      <Select
        aria-label={t.children.anyPackage}
        options={packageOptions}
        value={pkg}
        onChange={setPkg}
        className="w-[10.5rem] shrink-0 sm:w-[13rem] lg:order-1"
      />
    </>
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
      <div className="lg:grid lg:grid-cols-[minmax(22rem,30rem)_minmax(0,1fr)] lg:items-start lg:gap-6">
        <section aria-label={t.children.title} className="flex min-w-0 flex-col overflow-hidden rounded-panel border border-line bg-surface">
          <div className="flex flex-col gap-3 px-4 pt-4 pb-3.5 sm:px-5">
            <SearchField value={query} onChange={setQuery} placeholder={t.children.searchPlaceholder} label={t.children.searchPlaceholder} />
            {view === 'active' && (
              // Phones: one row that scrolls sideways, like the filters of iOS apps; its vertical padding
              // keeps the chips' larger touch area inside the scrolling strip
              <div className="max-lg:-mx-4 max-lg:-my-1.5 max-lg:overflow-x-auto max-lg:px-4 max-lg:py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <Chips
                  aria-label={t.children.filters.label}
                  options={filterOptions}
                  selected={filter === 'all' ? [] : [filter]}
                  onChange={(next) => setFilter(next[0] ?? 'all')}
                  className="max-lg:w-max max-lg:flex-nowrap"
                />
              </div>
            )}
          </div>

          <div className="border-t border-line">
            {registrations.isError ? (
              <div className="p-5">
                <LoadError message={t.children.loadFailed} retryLabel={t.common.retry} onRetry={() => void registrations.refetch()} />
              </div>
            ) : !rows ? (
              <div className="flex flex-col gap-1.5 p-3" aria-busy>
                {Array.from({ length: 8 }, (_, index) => (
                  <Skeleton key={index} className="h-[4.25rem]" />
                ))}
              </div>
            ) : shown.length === 0 ? (
              <div className="py-6">{empty}</div>
            ) : (
              <ul aria-label={plural(t.children.count, shown.length)} className="divide-y divide-line">
                {shown.map((row) => (
                  <li key={row.id}>
                    <ChildRow
                      row={row}
                      usage={usage}
                      selected={wide && row.id === id}
                      onOpen={() => {
                        listScroll.current = window.scrollY
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {wide && (
          <aside
            ref={pane}
            aria-label={selected?.student_name ?? t.children.title}
            className="sticky top-[5.5rem] max-h-[calc(100dvh-7rem)] overflow-y-auto overscroll-contain rounded-panel border border-line bg-surface"
          >
            {id ? (
              detail(true)
            ) : (
              <EmptyState
                className="py-16"
                icon={<UserFocusIcon aria-hidden className="size-8" />}
                title={t.children.pickChild}
                action={
                  rows && rows.length === 0 ? undefined : (
                    <ButtonLink variant="quiet" size="sm" onPress={() => startTask('registration')}>
                      {t.children.newRegistration}
                    </ButtonLink>
                  )
                }
              />
            )}
          </aside>
        )}
      </div>
    </Page>
  )
}

function ChildRow({ row, usage, selected, onOpen }: { row: Registration; usage: UsageMap | undefined; selected: boolean; onOpen: () => void }) {
  const i18n = useI18n()
  const { t } = i18n
  const labels = useLabels()
  const active = row.is_active === true
  const free = isFree(row)
  const days = active ? daysLeft(row) : null
  const mark = !active ? null : isPaymentDue(row) ? (
    <Mark tone="action">{t.children.pendingPayment}</Mark>
  ) : days !== null && days <= ENDING_WINDOW_DAYS ? (
    <Mark tone={days < 0 ? 'action' : 'neutral'}>{endText(i18n, days)}</Mark>
  ) : null

  return (
    <Link
      href={`/children/${row.id}`}
      onPress={onOpen}
      aria-current={selected ? 'page' : undefined}
      className={cx(
        'flex items-center gap-3 px-4 py-3 text-left no-underline outline-none transition-colors duration-150 sm:px-5',
        'data-focus-visible:ring-2 data-focus-visible:ring-focus data-focus-visible:ring-inset',
        selected ? 'bg-accent-wash' : 'data-hovered:bg-surface-2 data-pressed:bg-hover'
      )}
    >
      <Avatar name={row.student_name} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-medium text-ink">{row.student_name}</span>
          {mark}
        </span>
        {active && !free && <UsageLine usage={usage?.[row.id]} className="mt-1" />}
        <span className="mt-0.5 block truncate text-[0.8125rem] text-ink-3">
          {labels.packageName(row.package_type)} · {row.parent_name}
        </span>
      </span>
    </Link>
  )
}
