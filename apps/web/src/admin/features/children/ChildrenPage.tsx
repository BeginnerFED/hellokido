import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-aria-components'
import { useNavigate, useParams } from 'react-router'
import { PlusIcon, UserFocusIcon } from '@phosphor-icons/react'
import { remainingTone, type Registration, type UsageMap } from '@hellokido/core/api'
import { useActiveUsage, useLabels, useRegistrations } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useActions } from '../../shell/Actions'
import { Avatar, EmptyState, LoadError, Mark, Skeleton } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { Chips, Segmented, Select, type Option } from '../../ui/Choice'
import { SearchField } from '../../ui/Field'
import { Page } from '../../ui/Page'
import { useWideLayout } from '../../ui/useMediaQuery'
import { cx } from '../../ui/cx'
import { ParentName, remainingText } from './ChildBits'
import { ChildDetail, ChildDetailSkeleton } from './ChildDetail'
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
 * The children: a felt list to find one, and beside it everything about the child. On a phone the
 * child is its own screen and the list keeps its search, filter and scroll position for the way back.
 */
export default function ChildrenPage() {
  const { id } = useParams()
  const navigate = useNavigate()
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
  const list = useRef<HTMLDivElement>(null)

  // Phones: the child opens at its top and the list comes back where it was left. Wide: a new child
  // starts at the top of the page; the list beside it keeps its own scroll
  useLayoutEffect(() => {
    if (wide) {
      if (window.scrollY > 0) window.scrollTo(0, 0)
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

  // A child opened from elsewhere (a link, a new registration) is brought into the list's view
  const ready = Boolean(rows)
  useEffect(() => {
    if (!wide || !id || !ready) return
    const box = list.current
    const item = box?.querySelector('[aria-current="page"]')
    if (!box || !item) return
    // Scroll the list only, never the page (scrollIntoView would move both)
    const frame = box.getBoundingClientRect()
    const row = item.getBoundingClientRect()
    const bottom = Math.min(frame.bottom, window.innerHeight)
    if (row.top < frame.top) box.scrollTop -= frame.top - row.top + 8
    else if (row.bottom > bottom) box.scrollTop += row.bottom - bottom + 8
  }, [id, wide, ready])

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

  const found = id && rows ? (rows.find((row) => row.id === id) ?? null) : undefined
  // A child registered a moment ago is not in the list until it has read again: wait, don't say "not found"
  const selected = found === null && registrations.isFetching ? undefined : found

  const detail = (showName: boolean) =>
    registrations.isError ? (
      <div className="on-felt rounded-panel bg-felt p-5">
        <LoadError message={t.children.loadFailed} retryLabel={t.common.retry} onRetry={() => void registrations.refetch()} />
      </div>
    ) : selected === undefined ? (
      <ChildDetailSkeleton showName={showName} />
    ) : selected === null ? (
      <div className="rounded-panel bg-felt">
        <EmptyState className="py-12" title={t.children.detail.notFound} />
      </div>
    ) : (
      <ChildDetail key={selected.id} registration={selected} showName={showName} onClose={showName ? () => navigate('/children') : undefined} />
    )

  // Phones: one child fills the screen
  if (!wide && id) {
    return (
      <Page
        title={selected?.student_name ?? t.children.title}
        summary={selected?.student_age || undefined}
        back={{ href: '/children', label: t.children.detail.back }}
      >
        {detail(false)}
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
        className="min-w-0 flex-1 lg:order-2 lg:w-[11.5rem] lg:flex-none"
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
      <div className="lg:grid lg:grid-cols-[minmax(18.5rem,23.25rem)_minmax(0,1fr)] lg:items-start lg:gap-7">
        {/* On wide screens the list stays in view while the child beside it scrolls with the page */}
        <section
          aria-label={t.children.title}
          className="on-felt flex min-w-0 flex-col rounded-panel bg-felt lg:sticky lg:top-[4.75rem] lg:max-h-[calc(100dvh-6rem)]"
        >
          <div className="flex shrink-0 flex-col gap-3 px-3.5 pt-4 pb-2">
            <SearchField value={query} onChange={setQuery} placeholder={t.children.searchPlaceholder} label={t.children.searchPlaceholder} />
            {view === 'active' && (
              // Phones: one row that scrolls sideways, like the filters of iOS apps; its vertical padding
              // keeps the chips' larger touch area inside the scrolling strip
              <div className="max-lg:-mx-3.5 max-lg:-my-1.5 max-lg:overflow-x-auto max-lg:px-3.5 max-lg:py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

          <div ref={list} className="relative min-h-0 flex-1 overscroll-contain px-2 pb-2 lg:overflow-y-auto lg:px-3.5 lg:pb-3">
            {registrations.isError ? (
              <div className="p-2">
                <LoadError message={t.children.loadFailed} retryLabel={t.common.retry} onRetry={() => void registrations.refetch()} />
              </div>
            ) : !rows ? (
              <div className="flex flex-col gap-2 px-1.5 py-1" aria-busy>
                {Array.from({ length: 8 }, (_, index) => (
                  <Skeleton key={index} className="h-[3.25rem]" />
                ))}
              </div>
            ) : shown.length === 0 ? (
              <div className="py-4">{empty}</div>
            ) : (
              <ul aria-label={plural(t.children.count, shown.length)} className="flex flex-col gap-px">
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
          // An open child sits in a thin frame, so it reads as one thing that its X closes
          <section
            aria-label={selected?.student_name ?? t.children.title}
            className={cx('min-w-0', id && 'rounded-[2.5rem] border border-line p-3.5')}
          >
            {id ? (
              detail(true)
            ) : (
              <div className="rounded-panel bg-felt">
                <EmptyState
                  className="py-16"
                  icon={<UserFocusIcon aria-hidden className="size-8" />}
                  title={t.children.pickChild}
                  action={
                    rows && rows.length === 0 ? undefined : (
                      <Button variant="secondary" size="sm" onPress={() => startTask('registration')}>
                        {t.children.newRegistration}
                      </Button>
                    )
                  }
                />
              </div>
            )}
          </section>
        )}
      </div>
    </Page>
  )
}

/**
 * A child in the list: name, then the one thing that matters (a payment due, a package ending)
 * or the package and parent, and the lessons left on the right. The open child is a raised piece.
 */
function ChildRow({ row, usage, selected, onOpen }: { row: Registration; usage: UsageMap | undefined; selected: boolean; onOpen: () => void }) {
  const i18n = useI18n()
  const { t, fmt, plural } = i18n
  const labels = useLabels()
  const active = row.is_active === true
  const free = isFree(row)
  const days = active ? daysLeft(row) : null
  const own = usage?.[row.id]

  const mark = !active ? null : isPaymentDue(row) ? (
    <Mark tone="action">{t.children.pendingPayment}</Mark>
  ) : days !== null && days <= 0 ? (
    <Mark tone="action">{days < 0 ? plural(t.children.phone.ended, -days) : t.children.phone.endsToday}</Mark>
  ) : null
  const sub =
    days !== null && days > 0 && days <= ENDING_WINDOW_DAYS ? (
      plural(t.children.phone.endsIn, days)
    ) : (
      <>
        {labels.packageName(row.package_type)}
        {row.parent_name?.trim() && ' · '}
        <ParentName template={t.children.phone.parentOf} name={row.parent_name} />
      </>
    )

  const left = own?.remaining ?? 0
  const low = remainingTone(own) === 'low' || remainingTone(own) === 'out'

  return (
    <Link
      href={`/children/${row.id}`}
      onPress={onOpen}
      aria-current={selected ? 'page' : undefined}
      className={cx(
        'flex items-center gap-3 rounded-[1.125rem] px-2.5 py-[0.5625rem] text-left text-ink no-underline outline-none',
        'transition-[background-color,box-shadow] duration-150 data-focus-visible:ring-2 data-focus-visible:ring-focus data-focus-visible:ring-inset',
        selected ? 'bg-raised shadow-lift' : 'data-hovered:bg-[color-mix(in_srgb,var(--raised)_55%,transparent)] data-pressed:bg-[color-mix(in_srgb,var(--raised)_55%,transparent)]'
      )}
    >
      <Avatar name={row.student_name} tone={selected ? 'sky' : 'piece'} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.96875rem] leading-[1.3125rem] font-medium">{row.student_name}</span>
        {mark ? (
          <span className="mt-px flex min-w-0">{mark}</span>
        ) : (
          // ink-3 on the dark raised piece is under 4.5:1, so the chosen row takes ink-2 there
          <span className={cx('block truncate text-[0.84375rem] leading-[1.125rem] text-ink-3', selected && 'dark:text-ink-2')}>{sub}</span>
        )}
      </span>
      {active && !free && (
        <span className="flex w-10 shrink-0 flex-col items-end">
          {own ? (
            <>
              <span aria-hidden className={cx('text-[1.3125rem] leading-[1.4375rem] font-semibold tracking-[-0.02em]', low && 'text-amber-ink')}>
                {Math.max(left, 0)}
              </span>
              <span aria-hidden className={cx('text-xs leading-[0.9375rem] text-ink-3', selected && 'dark:text-ink-2')}>
                {plural(t.children.phone.lessonsUnit, Math.max(left, 0))}
              </span>
              <span className="sr-only">{remainingText(i18n, own)}</span>
            </>
          ) : (
            <span aria-hidden className="h-8 w-7 animate-shimmer rounded-lg bg-track" />
          )}
        </span>
      )}
    </Link>
  )
}
