import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { Button as AriaButton, Dialog, DialogTrigger, Link, Popover } from 'react-aria-components'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { CaretUpDownIcon, DotsThreeOutlineIcon, SignOutIcon } from '@phosphor-icons/react'
import { listWaitlist } from '@hellokido/core/api'
import { LANGUAGE_NAMES, LOCALES, type Locale } from '@hellokido/core/i18n'
import { keys } from '../data/queries'
import { useWaiting } from '../features/today/data'
import { CONTACTED } from '../features/waitlist/rules'
import { useAuth } from '../providers/Auth'
import { useI18n } from '../providers/I18n'
import { useTheme, type ThemeChoice } from '../providers/Theme'
import { useToast } from '../providers/Toasts'
import { Logo } from '../ui/Bits'
import { Button } from '../ui/Button'
import { Segmented } from '../ui/Choice'
import { popoverClass } from '../ui/Menu'
import { Sheet } from '../ui/Sheet'
import { cx } from '../ui/cx'
import { MORE_NAV, NAV, SETTINGS_NAV, TAB_NAV, type NavItem } from './nav'

const COLLAPSE_KEY = 'hk-rail-collapsed'

type ShellValue = { collapsed: boolean; toggleRail: () => void }

const ShellContext = createContext<ShellValue>({ collapsed: false, toggleRail: () => {} })

/** The rail's collapsed state, for the toggle in each page's top bar. */
export const useShell = () => useContext(ShellContext)

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

export function Shell() {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const toggleRail = useCallback(() => {
    setCollapsed((current) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, current ? '0' : '1')
      } catch {
        // Storage unavailable: the choice lasts for this visit
      }
      return !current
    })
  }, [])
  const value = useMemo(() => ({ collapsed, toggleRail }), [collapsed, toggleRail])
  return (
    <ShellContext.Provider value={value}>
      <div className={cx('min-h-dvh bg-page text-ink', collapsed ? 'lg:pl-24' : 'lg:pl-[16.25rem]')}>
        <Rail collapsed={collapsed} />
        <main className="pb-[calc(env(safe-area-inset-bottom)+6rem)] lg:pb-0">
          <Outlet />
        </main>
        <TabBar />
      </div>
    </ShellContext.Provider>
  )
}

type Counts = Partial<Record<string, { count: number; tone: 'action' | 'neutral'; label?: string }>>

/** The counts beside the nav items: the work waiting on Today (amber) and the families on the waitlist. */
function useNavCounts(): Counts {
  const { plural, t } = useI18n()
  const waiting = useWaiting()
  const waitlist = useQuery({ queryKey: keys.waitlist, queryFn: listWaitlist })
  const queued = (waitlist.data ?? []).filter((entry) => entry.status !== CONTACTED).length
  return {
    '/': waiting.ready && waiting.total > 0 ? { count: waiting.total, tone: 'action', label: plural(t.today.waiting, waiting.total) } : undefined,
    '/waitlist': queued > 0 ? { count: queued, tone: 'neutral' } : undefined
  }
}

function Rail({ collapsed }: { collapsed: boolean }) {
  const { t } = useI18n()
  const { pathname } = useLocation()
  const counts = useNavCounts()
  return (
    <aside
      className={cx(
        'on-felt fixed top-3 bottom-3 left-3 z-30 hidden flex-col rounded-panel bg-felt pt-[1.375rem] pb-3 lg:flex',
        collapsed ? 'w-[4.5rem] px-2.5' : 'w-[14.75rem] px-3'
      )}
    >
      <Link
        href="/"
        aria-label={t.shell.nav.today}
        className={cx(
          'mx-auto mb-[1.375rem] block shrink-0 rounded-control outline-none transition-opacity duration-150 data-hovered:opacity-80 data-focus-visible:ring-2 data-focus-visible:ring-focus',
          collapsed ? 'w-10' : 'w-[9.375rem]'
        )}
      >
        {collapsed ? (
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="Hello Kido" width={40} height={40} className="size-10" />
        ) : (
          <Logo className="h-[5.375rem]! w-[9.375rem]! object-contain" />
        )}
      </Link>
      <nav aria-label={t.shell.nav.main} className="relative -mx-1 flex min-h-0 flex-1 flex-col overflow-y-auto px-1 py-0.5">
        <ul className="flex flex-col gap-[3px]">
          {NAV.map((item) => (
            <li key={item.to}>
              <RailLink item={item} active={item.match(pathname)} collapsed={collapsed} badge={counts[item.to]} />
            </li>
          ))}
        </ul>
        <div className="mt-auto flex flex-col gap-1.5 pt-4">
          <RailLink item={SETTINGS_NAV} active={SETTINGS_NAV.match(pathname)} collapsed={collapsed} />
          <AccountBlock collapsed={collapsed} />
        </div>
      </nav>
    </aside>
  )
}

function RailLink({ item, active, collapsed, badge }: { item: NavItem; active: boolean; collapsed: boolean; badge?: Counts[string] }) {
  const { t } = useI18n()
  const Icon = item.icon
  const label = item.label(t)
  return (
    <Link
      href={item.to}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? (badge?.label ? `${label}, ${badge.label}` : label) : undefined}
      className={cx(
        'relative flex h-[2.625rem] items-center gap-3 rounded-full text-[0.9375rem] font-medium no-underline outline-none transition-[background-color,color,box-shadow] duration-150',
        'data-focus-visible:ring-2 data-focus-visible:ring-focus',
        collapsed ? 'justify-center px-0' : 'pr-2.5 pl-3.5',
        active ? 'bg-raised text-ink shadow-lift' : 'text-ink-2 data-hovered:bg-hover data-hovered:text-ink'
      )}
    >
      <Icon aria-hidden className={cx('size-5 shrink-0', active ? 'text-accent-ink' : 'text-ink-3')} />
      {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
      {badge &&
        (collapsed ? (
          badge.tone === 'action' && <span aria-hidden className="absolute top-2 right-3 size-2 rounded-full bg-amber" />
        ) : (
          <span
            className={cx(
              'grid h-[1.375rem] min-w-6 shrink-0 place-items-center rounded-full px-[7px] text-[0.78125rem] font-semibold tabular',
              badge.tone === 'action' ? 'bg-[color-mix(in_srgb,var(--amber)_22%,var(--felt))] text-amber-ink' : 'bg-track text-ink-2'
            )}
          >
            <span aria-hidden>{badge.count}</span>
            {badge.label && <span className="sr-only">{badge.label}</span>}
          </span>
        ))}
    </Link>
  )
}

function useAccountName() {
  const { user } = useAuth()
  const email = user?.email ?? ''
  const local = email.split('@')[0] ?? ''
  const words = local.split(/[._-]+/).filter(Boolean)
  const initials = (words.length ? words.slice(0, 2).map((w) => w[0]) : ['?']).join('').toLocaleUpperCase('tr-TR')
  return { email, initials }
}

/** The workshop and who is signed in, at the foot of the rail; opens the account controls. */
function AccountBlock({ collapsed }: { collapsed: boolean }) {
  const { t } = useI18n()
  const { email, initials } = useAccountName()
  return (
    <DialogTrigger>
      <AriaButton
        aria-label={collapsed ? t.shell.account.open : undefined}
        className={cx(
          'flex w-full items-center gap-2.5 rounded-[1.125rem] text-left outline-none transition-colors duration-150 data-focus-visible:ring-2 data-focus-visible:ring-focus',
          collapsed ? 'justify-center p-1' : 'bg-raised p-2.5 data-hovered:bg-[color-mix(in_oklab,var(--raised)_95%,var(--ink))] dark:bg-track dark:data-hovered:bg-[color-mix(in_oklab,var(--track)_92%,var(--ink))]'
        )}
      >
        <span aria-hidden className="grid size-[2.125rem] shrink-0 place-items-center rounded-full bg-sky-felt text-[0.78125rem] font-semibold text-sky-ink">
          {initials}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.90625rem] leading-5 font-medium text-ink">{t.shell.workshop}</span>
              <span className="block truncate text-[0.84375rem] leading-[1.125rem] text-ink-3">{email || t.shell.role}</span>
            </span>
            {/* Says the block opens something: the account controls rise above it */}
            <CaretUpDownIcon aria-hidden className="size-[1.0625rem] shrink-0 text-ink-3" />
          </>
        )}
      </AriaButton>
      <Popover placement="top start" offset={8} className={cx(popoverClass, 'w-[20rem] p-3')}>
        <Dialog aria-label={t.shell.account.theme} className="outline-none">
          <AccountControls />
        </Dialog>
      </Popover>
    </DialogTrigger>
  )
}

/** Appearance, language and sign out; the same controls sit in the phone's More sheet. */
function AccountControls() {
  const { t, fmt, locale, setLocale } = useI18n()
  const { choice, setChoice } = useTheme()
  const { signOut } = useAuth()
  const { email } = useAccountName()
  const toast = useToast()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  return (
    <div className="flex flex-col gap-4">
      <p className="truncate text-[0.84375rem] text-ink-3">{fmt(t.shell.account.signedInAs, { email })}</p>
      <Segmented<ThemeChoice>
        label={t.shell.account.theme}
        size="sm"
        value={choice}
        onChange={setChoice}
        options={[
          { id: 'light', label: t.shell.account.themeLight },
          { id: 'dark', label: t.shell.account.themeDark },
          { id: 'system', label: t.shell.account.themeSystem }
        ]}
      />
      <Segmented<Locale>
        label={t.shell.account.language}
        size="sm"
        value={locale}
        onChange={setLocale}
        options={LOCALES.map((id) => ({ id, label: LANGUAGE_NAMES[id] }))}
      />
      <Button
        variant="quiet"
        icon={<SignOutIcon aria-hidden className="size-4" />}
        isPending={busy}
        onPress={async () => {
          setBusy(true)
          const ok = await signOut()
          setBusy(false)
          if (ok) navigate('/login')
          else toast({ tone: 'error', title: t.shell.signOutFailed })
        }}
      >
        {t.shell.account.signOut}
      </Button>
    </div>
  )
}

/** Phones: the four daily places and "More" in a floating glass bar. */
function TabBar() {
  const { t } = useI18n()
  const { pathname } = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const counts = useNavCounts()
  const moreActive = MORE_NAV.some((item) => item.match(pathname))
  const tab = (active: boolean) =>
    cx(
      'relative flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-full text-[0.6875rem] font-medium no-underline outline-none',
      'data-focus-visible:ring-2 data-focus-visible:ring-focus data-focus-visible:ring-inset',
      active ? 'text-accent-ink dark:text-accent' : 'text-ink-2'
    )
  return (
    <>
      <nav
        aria-label={t.shell.nav.main}
        className="fixed inset-x-3 bottom-[max(0.625rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-xl rounded-full bg-[color-mix(in_srgb,var(--page)_72%,transparent)] p-1 shadow-float backdrop-blur-xl backdrop-saturate-150 lg:hidden"
      >
        <ul className="flex h-[3.625rem] items-stretch">
          {TAB_NAV.map((item) => {
            const active = item.match(pathname)
            const Icon = item.icon
            const badge = counts[item.to]
            return (
              <li key={item.to} className="min-w-0 flex-1">
                <Link href={item.to} aria-current={active ? 'page' : undefined} className={tab(active)}>
                  <span className="relative">
                    <Icon aria-hidden weight={active ? 'fill' : 'regular'} className="size-6" />
                    {badge?.tone === 'action' && <span aria-hidden className="absolute -top-0.5 -right-1 size-2 rounded-full bg-amber" />}
                  </span>
                  <span className="max-w-full truncate px-1">{item.label(t)}</span>
                  {badge?.label && <span className="sr-only">{badge.label}</span>}
                </Link>
              </li>
            )
          })}
          <li className="min-w-0 flex-1">
            <AriaButton onPress={() => setMoreOpen(true)} className={tab(moreActive)}>
              <DotsThreeOutlineIcon aria-hidden weight={moreActive ? 'fill' : 'regular'} className="size-6" />
              <span>{t.shell.nav.more}</span>
            </AriaButton>
          </li>
        </ul>
      </nav>
      <Sheet isOpen={moreOpen} onOpenChange={setMoreOpen} title={t.shell.nav.more}>
        <ul className="flex flex-col gap-[3px]">
          {MORE_NAV.map((item) => {
            const Icon = item.icon
            const active = item.match(pathname)
            const badge = counts[item.to]
            return (
              <li key={item.to}>
                <Link
                  href={item.to}
                  onPress={() => setMoreOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={cx(
                    'flex h-12 items-center gap-3 rounded-full px-4 text-[0.9375rem] font-medium no-underline outline-none data-focus-visible:ring-2 data-focus-visible:ring-focus',
                    active ? 'bg-felt text-ink' : 'text-ink-2 data-hovered:bg-hover'
                  )}
                >
                  <Icon aria-hidden className={cx('size-5', active ? 'text-accent-ink' : 'text-ink-3')} />
                  <span className="min-w-0 flex-1">{item.label(t)}</span>
                  {badge && <span className="grid h-[1.375rem] min-w-6 place-items-center rounded-full bg-track px-[7px] text-[0.78125rem] font-semibold text-ink-2">{badge.count}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
        <div className="mt-4 border-t border-line pt-5">
          <AccountControls />
        </div>
      </Sheet>
    </>
  )
}
