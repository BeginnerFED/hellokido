import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { Button as AriaButton, Dialog, DialogTrigger, Link, Popover } from 'react-aria-components'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { DotsThreeOutlineIcon, SignOutIcon, UserIcon } from '@phosphor-icons/react'
import { LANGUAGE_NAMES, LOCALES, type Locale } from '@hellokido/core/i18n'
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
      <div className={cx('min-h-dvh bg-ground text-ink', collapsed ? 'lg:pl-16' : 'lg:pl-64')}>
        <Rail collapsed={collapsed} />
        <main className="pb-[calc(env(safe-area-inset-bottom)+4.75rem)] lg:pb-0">
          <Outlet />
        </main>
        <TabBar />
      </div>
    </ShellContext.Provider>
  )
}

function Rail({ collapsed }: { collapsed: boolean }) {
  const { t } = useI18n()
  const { pathname } = useLocation()
  return (
    <aside
      className={cx(
        'fixed inset-y-0 left-0 z-30 hidden flex-col gap-3.5 border-r border-rail-line bg-rail px-3 pt-3.5 pb-6 lg:flex',
        collapsed ? 'w-16 px-2.5' : 'w-64'
      )}
    >
      <div className={cx('border-b border-rail-line pb-3.5', collapsed ? 'px-0 pt-1' : 'px-2 pt-1')}>
        <Link href="/" aria-label={t.shell.nav.today} className="block w-fit rounded-control outline-offset-4">
          {collapsed ? (
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="Hello Kido" width={40} height={40} className="size-10" />
          ) : (
            <Logo className="h-10! w-auto" />
          )}
        </Link>
      </div>
      <nav aria-label={t.shell.nav.main} className="-mx-1 flex-1 overflow-y-auto px-1">
        <ul className="flex flex-col gap-0.5">
          {[...NAV, SETTINGS_NAV].map((item) => (
            <li key={item.to}>
              <RailLink item={item} active={item.match(pathname)} collapsed={collapsed} />
            </li>
          ))}
        </ul>
      </nav>
      <AccountBlock collapsed={collapsed} />
    </aside>
  )
}

function RailLink({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  const { t } = useI18n()
  const Icon = item.icon
  const label = item.label(t)
  return (
    <Link
      href={item.to}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? label : undefined}
      className={cx(
        'flex h-9 items-center gap-2.5 rounded-[0.5rem] text-[0.90625rem] text-ink no-underline outline-none transition-colors duration-150',
        'data-focus-visible:ring-2 data-focus-visible:ring-focus',
        collapsed ? 'justify-center px-0' : 'px-2.5',
        active ? 'bg-hover font-medium' : 'data-hovered:bg-hover'
      )}
    >
      <Icon aria-hidden className="size-[1.125rem] shrink-0" />
      {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
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

/** The workshop and who is signed in, under the nav; opens the account controls. */
function AccountBlock({ collapsed }: { collapsed: boolean }) {
  const { t } = useI18n()
  const { email, initials } = useAccountName()
  return (
    <DialogTrigger>
      <div className="border-t border-rail-line pt-2">
      <AriaButton
        aria-label={collapsed ? t.shell.account.open : undefined}
        className={cx(
          'flex w-full items-center gap-2.5 rounded-[0.5rem] py-1.5 text-left outline-none transition-colors duration-150 data-hovered:bg-hover data-focus-visible:ring-2 data-focus-visible:ring-focus',
          collapsed ? 'justify-center px-0' : 'px-2.5'
        )}
      >
        {collapsed ? (
          <span aria-hidden className="grid size-9 place-items-center rounded-full border border-line text-[0.75rem] font-semibold text-ink-2">
            {initials}
          </span>
        ) : (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.84375rem] font-semibold">{t.shell.workshop}</span>
            <span className="mt-px block truncate text-[0.8125rem] text-ink-3">{email || t.shell.role}</span>
          </span>
        )}
      </AriaButton>
      </div>
      <Popover placement="top start" offset={8} className={cx(popoverClass, 'w-[20rem] p-3')}>
        <Dialog aria-label={t.shell.account.theme} className="outline-none">
          <AccountControls />
        </Dialog>
      </Popover>
    </DialogTrigger>
  )
}

/** The round account button at the right of each page's top bar. */
export function AccountButton() {
  const { t } = useI18n()
  return (
    <DialogTrigger>
      <AriaButton
        aria-label={t.shell.account.open}
        className="grid size-[2.375rem] shrink-0 place-items-center rounded-full border border-line bg-surface text-ink outline-none transition-colors duration-150 data-hovered:bg-surface-2 data-focus-visible:ring-2 data-focus-visible:ring-focus"
      >
        <UserIcon aria-hidden className="size-[1.0625rem]" />
      </AriaButton>
      <Popover placement="bottom end" offset={8} className={cx(popoverClass, 'w-[20rem] p-3')}>
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
      <p className="truncate text-[0.8125rem] text-ink-3">{fmt(t.shell.account.signedInAs, { email })}</p>
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
        variant="secondary"
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

function TabBar() {
  const { t } = useI18n()
  const { pathname } = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreActive = MORE_NAV.some((item) => item.match(pathname))
  return (
    <>
      <nav aria-label={t.shell.nav.main} className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
        <ul className="mx-auto flex h-[4.25rem] max-w-xl items-stretch">
          {TAB_NAV.map((item) => {
            const active = item.match(pathname)
            const Icon = item.icon
            return (
              <li key={item.to} className="flex-1">
                <Link
                  href={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={cx(
                    'flex h-full flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium no-underline outline-none',
                    'data-focus-visible:ring-2 data-focus-visible:ring-focus data-focus-visible:ring-inset',
                    active ? 'text-ink' : 'text-ink-3'
                  )}
                >
                  <Icon aria-hidden weight={active ? 'fill' : 'regular'} className={cx('size-6', active && 'text-accent-solid')} />
                  <span className="max-w-full truncate px-1">{item.label(t)}</span>
                </Link>
              </li>
            )
          })}
          <li className="flex-1">
            <AriaButton
              onPress={() => setMoreOpen(true)}
              className={cx(
                'flex h-full w-full flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium outline-none data-focus-visible:ring-2 data-focus-visible:ring-focus data-focus-visible:ring-inset',
                moreActive ? 'text-ink' : 'text-ink-3'
              )}
            >
              <DotsThreeOutlineIcon aria-hidden weight={moreActive ? 'fill' : 'regular'} className={cx('size-6', moreActive && 'text-accent-solid')} />
              <span>{t.shell.nav.more}</span>
            </AriaButton>
          </li>
        </ul>
      </nav>
      <Sheet isOpen={moreOpen} onOpenChange={setMoreOpen} title={t.shell.nav.more}>
        <ul className="-mx-2 flex flex-col gap-0.5">
          {MORE_NAV.map((item) => {
            const Icon = item.icon
            const active = item.match(pathname)
            return (
              <li key={item.to}>
                <Link
                  href={item.to}
                  onPress={() => setMoreOpen(false)}
                  className={cx(
                    'flex h-12 items-center gap-3 rounded-[0.625rem] px-3 text-[0.9375rem] text-ink no-underline outline-none data-hovered:bg-hover data-focus-visible:ring-2 data-focus-visible:ring-focus',
                    active && 'bg-hover font-medium'
                  )}
                >
                  <Icon aria-hidden className="size-5 text-ink-2" />
                  {item.label(t)}
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
