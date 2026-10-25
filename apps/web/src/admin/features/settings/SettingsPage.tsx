import { useCallback, useEffect, useRef, useState } from 'react'
import { parseISO } from 'date-fns'
import { CircleHalfIcon, MoonIcon, SunIcon } from '@phosphor-icons/react'
import { LANGUAGE_NAMES, LOCALES, type Locale } from '@hellokido/core/i18n'
import { useI18n } from '../../providers/I18n'
import { useTheme, type ThemeChoice } from '../../providers/Theme'
import { Segmented } from '../../ui/Choice'
import { Page } from '../../ui/Page'
import { cx } from '../../ui/cx'
import { Access } from './Access'
import { SettingsSection } from './bits'
import { CardSettings } from './CardSettings'
import { CategoryList } from './Categories'
import { MessageList } from './Messages'
import { MonthlyList } from './MonthlyList'
import { PackageList } from './Packages'

const SECTIONS = ['appearance', 'packages', 'messages', 'card', 'monthly', 'expense-categories', 'income-categories', 'access', 'about'] as const
type SectionId = (typeof SECTIONS)[number]

/**
 * The few things set once and changed rarely. Phones read it as one page; wide screens keep a short
 * list of the parts beside it, so a part is one click away.
 */
export default function SettingsPage() {
  const { t } = useI18n()
  const [current, pin] = useCurrentSection(SECTIONS)
  const copy = t.settings

  const titles: Record<SectionId, string> = {
    appearance: copy.appearance.title,
    packages: copy.packages.title,
    messages: t.messages.title,
    card: copy.card.title,
    monthly: copy.monthly.title,
    'expense-categories': copy.categories.expenseTitle,
    'income-categories': copy.categories.incomeTitle,
    access: copy.access.title,
    about: copy.about.title
  }

  const jump = (id: SectionId) => {
    const section = document.getElementById(id)
    if (!section) return
    pin(id)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    section.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    // Keyboard and screen reader users land on the part they asked for
    document.getElementById(`${id}-title`)?.focus({ preventScroll: true })
  }

  return (
    <Page title={copy.title}>
      <div className="xl:grid xl:grid-cols-[10.5rem_minmax(0,46rem)] xl:items-start xl:gap-12">
        <nav aria-label={copy.sections} className="sticky top-9 hidden xl:block">
          <ul className="flex flex-col gap-0.5">
            {SECTIONS.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => jump(id)}
                  aria-current={current === id ? 'location' : undefined}
                  className={cx(
                    'flex h-9 w-full items-center rounded-control px-3 text-left text-sm font-medium outline-none transition-colors duration-150',
                    'focus-visible:ring-2 focus-visible:ring-focus',
                    current === id ? 'bg-hover text-ink' : 'text-ink-2 hover:bg-hover hover:text-ink'
                  )}
                >
                  <span className="truncate">{titles[id]}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex max-w-[46rem] flex-col gap-5 pb-12 lg:gap-6">
          <SettingsSection id="appearance" title={titles.appearance} body={copy.appearance.body}>
            <Appearance />
          </SettingsSection>
          <SettingsSection id="packages" title={titles.packages} body={copy.packages.body}>
            <PackageList />
          </SettingsSection>
          <SettingsSection id="messages" title={titles.messages} body={t.messages.body}>
            <MessageList />
          </SettingsSection>
          <SettingsSection id="card" title={titles.card} body={copy.card.body}>
            <CardSettings />
          </SettingsSection>
          <SettingsSection id="monthly" title={titles.monthly} body={copy.monthly.body}>
            <MonthlyList />
          </SettingsSection>
          <SettingsSection id="expense-categories" title={titles['expense-categories']} body={copy.categories.expenseBody}>
            <CategoryList kind="expense" />
          </SettingsSection>
          <SettingsSection id="income-categories" title={titles['income-categories']} body={copy.categories.incomeBody}>
            <CategoryList kind="income" />
          </SettingsSection>
          <SettingsSection id="access" title={titles.access} body={copy.access.body}>
            <Access />
          </SettingsSection>
          <SettingsSection id="about" title={titles.about}>
            <About />
          </SettingsSection>
        </div>
      </div>
    </Page>
  )
}

/**
 * The part of the page being read: the last section whose top has passed the upper third of the
 * screen, or the last one once the page is scrolled to its end. A part picked from the list stays
 * marked while the page scrolls to it.
 */
function useCurrentSection(ids: readonly SectionId[]) {
  const [current, setCurrent] = useState<SectionId>(ids[0])
  const pinned = useRef(false)
  const unpin = useRef(0)

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      if (pinned.current) return
      const line = window.innerHeight / 3
      let next = ids[0]
      for (const id of ids) {
        const top = document.getElementById(id)?.getBoundingClientRect().top
        if (top !== undefined && top <= line) next = id
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) next = ids[ids.length - 1]
      setCurrent(next)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    const onScrollEnd = () => {
      pinned.current = false
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('scrollend', onScrollEnd)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(unpin.current)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('scrollend', onScrollEnd)
    }
  }, [ids])

  const pin = useCallback((id: SectionId) => {
    pinned.current = true
    setCurrent(id)
    // Browsers without a scrollend event, or a part that was already in place
    window.clearTimeout(unpin.current)
    unpin.current = window.setTimeout(() => (pinned.current = false), 1200)
  }, [])

  return [current, pin] as const
}

function Appearance() {
  const { t, locale, setLocale } = useI18n()
  const { choice, setChoice } = useTheme()
  const icon = 'size-4 max-sm:hidden'
  return (
    <div className="flex max-w-[28rem] flex-col gap-4">
      <Segmented<ThemeChoice>
        label={t.settings.appearance.theme}
        value={choice}
        onChange={setChoice}
        options={[
          { id: 'light', label: t.shell.account.themeLight, icon: <SunIcon aria-hidden className={icon} /> },
          { id: 'dark', label: t.shell.account.themeDark, icon: <MoonIcon aria-hidden className={icon} /> },
          { id: 'system', label: t.shell.account.themeSystem, icon: <CircleHalfIcon aria-hidden className={icon} /> }
        ]}
      />
      <Segmented<Locale>
        label={t.shell.account.language}
        value={locale}
        onChange={setLocale}
        options={LOCALES.map((id) => ({ id, label: LANGUAGE_NAMES[id] }))}
      />
    </div>
  )
}

function About() {
  const { t, date } = useI18n()
  return (
    <dl className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
      <dt className="text-ink-2">{t.settings.about.updated}</dt>
      <dd className="font-medium text-ink tabular">{date(parseISO(__BUILD_DATE__))}</dd>
    </dl>
  )
}
