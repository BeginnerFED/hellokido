import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button as AriaButton, Link } from 'react-aria-components'
import { useLocation } from 'react-router'
import { CaretLeftIcon, CaretRightIcon, MagnifyingGlassIcon, PlusIcon, SidebarSimpleIcon } from '@phosphor-icons/react'
import { useI18n } from '../providers/I18n'
import { useActions } from '../shell/Actions'
import { useShell } from '../shell/Shell'
import { NAV, SETTINGS_NAV } from '../shell/nav'
import { Button, IconButton, IconLink } from './Button'
import type { LessonTone } from './signature'
import { cx } from './cx'

type PageProps = {
  title: ReactNode
  /** One sentence under the title that says what matters on this page right now. */
  summary?: ReactNode
  /** Page-level controls (desktop: right of the title; phones: under it). Quiet buttons first, then segmented controls. */
  toolbar?: ReactNode
  /** A way back to the list this page was opened from. */
  back?: { href: string; label: string }
  /**
   * The page's own way to add something. On wide screens it takes the place of the general "New"
   * button; phones keep their + for everything, so a page shows its own there in the toolbar.
   */
  action?: { label: string; onPress: () => void }
  /** The words of the last crumb when the title is not plain text (Today's title is the date). */
  crumb?: string
  children: ReactNode
  width?: 'default' | 'wide'
  className?: string
}

export function Page({ title, summary, toolbar, back, action, crumb, children, width = 'default', className }: PageProps) {
  const { t } = useI18n()
  const actions = useActions()
  const add = action ?? { label: t.shell.quickAdd.button, onPress: actions.openQuickAdd }
  const sentinel = useRef<HTMLDivElement>(null)
  const [stuck, setStuck] = useState(false)

  // The phone header gets a hairline only once the page has scrolled under it
  useEffect(() => {
    const node = sentinel.current
    if (!node) return
    const observer = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div className={cx('mx-auto w-full px-4 sm:px-6 lg:pr-10 lg:pb-14 lg:pl-9', width === 'wide' ? 'max-w-[92rem]' : 'max-w-[82rem]', className)}>
      <TopBar title={crumb ?? title} back={back} />
      <div ref={sentinel} aria-hidden className="h-px lg:hidden" />
      <header
        className={cx(
          'sticky top-0 z-20 -mx-4 bg-page px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 transition-shadow duration-200 sm:-mx-6 sm:px-6',
          stuck && 'shadow-[0_1px_0_var(--line)]',
          'lg:static lg:mx-0 lg:bg-transparent lg:px-0 lg:pt-7 lg:pb-[1.375rem] lg:shadow-none'
        )}
      >
        <div className="flex min-h-11 flex-wrap items-center gap-x-6 gap-y-3 lg:items-end">
          {back && (
            <IconLink href={back.href} label={back.label} className="-ml-2.5 shrink-0 lg:hidden">
              <CaretLeftIcon aria-hidden weight="bold" className="size-[1.375rem]" />
            </IconLink>
          )}
          <div className="min-w-0 flex-1">
            {/* Beside the two round buttons a long title (a Ukrainian date, a child's full name) takes a second line rather than an ellipsis */}
            <h1 className="text-[1.75rem] leading-9 font-semibold tracking-[-0.025em] text-balance max-sm:line-clamp-2 sm:truncate lg:text-[2.125rem] lg:leading-10">{title}</h1>
            {summary && <p className="mt-1 hidden max-w-[72ch] text-[0.96875rem] leading-[1.375rem] text-ink-2 text-pretty lg:block">{summary}</p>}
          </div>
          <div className="flex items-center gap-2 lg:hidden">
            <IconButton label={t.shell.palette.open} variant="quiet" onPress={actions.openPalette}>
              <MagnifyingGlassIcon aria-hidden className="size-5" />
            </IconButton>
            <IconButton label={t.shell.quickAdd.title} variant="primary" onPress={actions.openQuickAdd}>
              <PlusIcon aria-hidden weight="bold" className="size-5" />
            </IconButton>
          </div>
          <div className="hidden flex-wrap items-center gap-2.5 lg:flex">
            {toolbar}
            <Button variant="primary" icon={<PlusIcon aria-hidden weight="bold" className="size-[1.125rem]" />} onPress={add.onPress} className="order-last">
              {add.label}
            </Button>
          </div>
        </div>
      </header>
      {summary && <p className="mt-1 max-w-[65ch] text-[0.9375rem] text-ink-2 text-pretty lg:hidden">{summary}</p>}
      {toolbar && <div className="mt-3 flex flex-wrap items-center gap-2 lg:hidden">{toolbar}</div>}
      <div className="mt-5 lg:mt-0">{children}</div>
    </div>
  )
}

/** Desktop only: the rail toggle, where you are and search, closed by a hairline so it reads as its own band. */
function TopBar({ title, back }: { title: ReactNode; back?: { href: string; label: string } }) {
  const { t } = useI18n()
  const actions = useActions()
  const { collapsed, toggleRail } = useShell()
  const { pathname } = useLocation()
  const section = [...NAV, SETTINGS_NAV].find((item) => item.match(pathname))
  const sectionLabel = section?.label(t)
  const parent = back
  const showSection = sectionLabel && !back && typeof title === 'string' ? sectionLabel !== title : false
  const crumbLink = 'shrink-0 rounded-[0.25rem] text-ink-3 no-underline outline-none data-hovered:text-ink data-focus-visible:ring-2 data-focus-visible:ring-focus'
  return (
    <div className="sticky top-0 z-20 hidden h-[4.25rem] items-center gap-3.5 border-b border-line bg-page lg:flex">
      <IconButton label={collapsed ? t.shell.nav.expand : t.shell.nav.collapse} variant="quiet" onPress={toggleRail} className="size-[2.375rem]!">
        <SidebarSimpleIcon aria-hidden className="size-[1.0625rem]" />
      </IconButton>
      <nav aria-label={t.shell.nav.crumbs} className="flex min-w-0 flex-1 items-center gap-2 text-[0.84375rem] text-ink-3">
        <Link href="/" className={crumbLink}>
          {t.shell.nav.root}
        </Link>
        {parent && (
          <>
            <CaretRightIcon aria-hidden className="size-3.5 shrink-0" />
            <Link href={parent.href} className={crumbLink}>
              {parent.label}
            </Link>
          </>
        )}
        {showSection && (
          <>
            <CaretRightIcon aria-hidden className="size-3.5 shrink-0" />
            <span className="shrink-0">{sectionLabel}</span>
          </>
        )}
        <CaretRightIcon aria-hidden className="size-3.5 shrink-0" />
        <span aria-current="page" className="min-w-0 truncate font-medium text-ink">
          {title}
        </span>
      </nav>
      <AriaButton
        onPress={actions.openPalette}
        className="flex h-10 w-[21.25rem] max-w-full min-w-[12.5rem] shrink items-center gap-2.5 rounded-full bg-felt pr-1.5 pl-4 text-left text-[0.90625rem] text-ink-3 outline-none transition-colors duration-150 data-hovered:bg-track data-focus-visible:ring-2 data-focus-visible:ring-focus"
      >
        <MagnifyingGlassIcon aria-hidden className="size-[1.125rem] shrink-0" />
        <span className="min-w-0 flex-1 truncate">{t.shell.palette.open}</span>
        <kbd className="grid h-7 shrink-0 place-items-center rounded-full bg-raised px-[0.5625rem] font-sans text-xs font-medium text-ink-2 shadow-lift dark:bg-track dark:shadow-none">
          {t.shell.palette.shortcut}
        </kbd>
      </AriaButton>
    </div>
  )
}

/**
 * The board's one container: a felt card with no border and no shadow. A header with a 19/600
 * title, an aside at 14 ink-3 and an optional description; then the body; then an optional plain
 * footer row (a text link plus the main action). A card never holds another card.
 * `tone` makes it a lesson's card in that type's felt.
 */
export function Card({
  title,
  description,
  aside,
  footer,
  children,
  className,
  bodyClassName,
  id,
  level = 2,
  tone
}: {
  title?: ReactNode
  description?: ReactNode
  aside?: ReactNode
  footer?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  id?: string
  level?: 2 | 3
  tone?: LessonTone
}) {
  const Heading = level === 3 ? 'h3' : 'h2'
  return (
    <section
      id={id}
      className={cx(
        'on-felt flex min-w-0 scroll-mt-24 flex-col overflow-hidden rounded-panel',
        tone ? `type-${tone} bg-(--t-felt) text-(--t-ink)` : 'bg-felt text-ink',
        className
      )}
    >
      {(title || aside) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-[1.125rem] pb-3 sm:px-[1.375rem]">
          <div className="min-w-0 flex-[1_1_14rem]">
            {title && <Heading className="text-[1.1875rem] leading-[1.5625rem] font-semibold tracking-[-0.015em]">{title}</Heading>}
            {description && <p className="mt-0.5 truncate text-[0.84375rem] text-ink-3">{description}</p>}
          </div>
          {aside && <div className="flex shrink-0 flex-wrap items-center gap-2 text-sm text-ink-3">{aside}</div>}
        </div>
      )}
      <div className={cx('min-h-0 flex-1', bodyClassName)}>{children}</div>
      {footer && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line px-4 py-3 text-[0.84375rem] text-ink-3 sm:px-[1.375rem]">
          {footer}
        </div>
      )}
    </section>
  )
}

/** The underlined text link at the right of a card footer. */
export function CardLink({ href, children, onPress }: { href?: string; children: ReactNode; onPress?: () => void }) {
  return (
    <Link
      href={href}
      onPress={onPress}
      className="rounded-[0.25rem] font-medium text-ink underline decoration-1 underline-offset-[3px] outline-none data-hovered:decoration-2 data-focus-visible:ring-2 data-focus-visible:ring-focus"
    >
      {children}
    </Link>
  )
}

/**
 * The head of a group of rows on the felt itself (13/600 ink-2, an aside at 13 ink-3), or with
 * `columns` the column heads of a table (12.5/500 at 80%). No grey strip.
 */
export function Band({ children, className, sticky, columns }: { children: ReactNode; className?: string; sticky?: boolean; columns?: boolean }) {
  return (
    <div
      className={cx(
        'flex flex-wrap items-center gap-x-2.5 gap-y-1 px-4 sm:px-[1.375rem]',
        columns ? 'pt-2 pb-1.5 text-[0.78125rem] font-medium opacity-80' : 'pt-2.5 pb-1 text-[0.8125rem] font-semibold text-ink-2',
        sticky && 'sticky top-0 z-[1] bg-felt',
        className
      )}
    >
      {children}
    </div>
  )
}

/**
 * A titled part of a page, for detail panels and forms. Boxed, it is a felt card of its own with a
 * padded body, for the side column of a page.
 */
export function Section({
  title,
  aside,
  children,
  className,
  id,
  level = 2,
  boxed
}: {
  title?: ReactNode
  aside?: ReactNode
  children: ReactNode
  className?: string
  id?: string
  /** 3 when the section sits under a heading of its own (a detail panel). */
  level?: 2 | 3
  boxed?: boolean
}) {
  const Heading = level === 3 ? 'h3' : 'h2'
  if (boxed) {
    return (
      <section id={id} className={cx('on-felt min-w-0 scroll-mt-24 overflow-hidden rounded-panel bg-felt', className)}>
        {(title || aside) && (
          <div className="flex items-baseline gap-3 px-4 pt-[1.125rem] pb-2 sm:px-[1.375rem]">
            {title && <Heading className="min-w-0 flex-1 text-[1.1875rem] leading-[1.5625rem] font-semibold tracking-[-0.015em]">{title}</Heading>}
            {aside && <div className="shrink-0 text-sm text-ink-3">{aside}</div>}
          </div>
        )}
        <div className="px-4 pt-1 pb-4 sm:px-[1.375rem]">{children}</div>
      </section>
    )
  }
  return (
    <section id={id} className={cx('scroll-mt-24', className)}>
      {(title || aside) && (
        <div className="mb-3 flex items-baseline gap-3">
          {title && <Heading className="min-w-0 flex-1 text-[1.1875rem] leading-[1.5625rem] font-semibold tracking-[-0.015em]">{title}</Heading>}
          {aside && <div className="shrink-0 text-sm text-ink-3">{aside}</div>}
        </div>
      )}
      {children}
    </section>
  )
}
