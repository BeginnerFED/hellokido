import type { Icon } from '@phosphor-icons/react'
import {
  CalendarDotsIcon,
  GearSixIcon,
  HourglassIcon,
  HouseIcon,
  NotePencilIcon,
  UsersThreeIcon,
  WalletIcon
} from '@phosphor-icons/react'
import type { Messages } from '@hellokido/core/i18n'

export type NavItem = { to: string; label: (t: Messages) => string; icon: Icon; match: (path: string) => boolean }

export const NAV: NavItem[] = [
  { to: '/', label: (t) => t.shell.nav.today, icon: HouseIcon, match: (p) => p === '/' },
  { to: '/calendar', label: (t) => t.shell.nav.calendar, icon: CalendarDotsIcon, match: (p) => p.startsWith('/calendar') },
  { to: '/children', label: (t) => t.shell.nav.children, icon: UsersThreeIcon, match: (p) => p.startsWith('/children') },
  { to: '/finance', label: (t) => t.shell.nav.finance, icon: WalletIcon, match: (p) => p.startsWith('/finance') },
  { to: '/waitlist', label: (t) => t.shell.nav.waitlist, icon: HourglassIcon, match: (p) => p.startsWith('/waitlist') },
  { to: '/notes', label: (t) => t.shell.nav.notes, icon: NotePencilIcon, match: (p) => p.startsWith('/notes') }
]

export const SETTINGS_NAV: NavItem = {
  to: '/settings',
  label: (t) => t.shell.nav.settings,
  icon: GearSixIcon,
  match: (p) => p.startsWith('/settings')
}

/** Phones show the four daily places in the tab bar; the rest sit under "More". */
export const TAB_NAV = NAV.slice(0, 4)
export const MORE_NAV = [...NAV.slice(4), SETTINGS_NAV]
