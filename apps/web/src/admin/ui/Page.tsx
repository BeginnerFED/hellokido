import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button as AriaButton, Link } from 'react-aria-components'
import { useLocation } from 'react-router'
import { CaretLeftIcon, CaretRightIcon, MagnifyingGlassIcon, PlusIcon, SidebarSimpleIcon } from '@phosphor-icons/react'
import { useI18n } from '../providers/I18n'
import { useActions } from '../shell/Actions'
import { AccountButton, useShell } from '../shell/Shell'
import { NAV, SETTINGS_NAV } from '../shell/nav'
import { Button, IconButton, IconLink } from './Button'
import { cx } from './cx'

type PageProps = {
  title: ReactNode
  /** One sentence under the title that says what matters on this page right now. */
  summary?: ReactNode
  /** Page-level controls (desktop: right of the title; phones: under it). */
  toolbar?: ReactNode
  /** A way back to the list this page was opened from. */
  back?: { href: string; label: string }
  /**
   * The page's own way to add something. On wide screens it takes the place of the general "New"
   * button; phones keep their + for everything, so a page shows its own there in the toolbar.
   */
  action?: { label: string; onPress: () => void }
  children: ReactNode
  width?: 'default' | 'wide'
  className?: string
}

export function Page({ title, summary, toolbar, back, action, children, width = 'default', className }: PageProps) {
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
    <>
      <TopBar title={title} back={back} />
      <div className={cx('mx-auto w-full px-4 sm:px-6 lg:px-10 lg:pt-9 lg:pb-14', width === 'wide' ? 'max-w-[90rem]' : 'max-w-[80rem]', className)}>
        <div ref={sentinel} aria-hidden className="h-px lg:hidden" />
        <header
          className={cx(
            'sticky top-0 z-20 -mx-4 bg-ground px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 transition-shadow duration-200 sm:-mx-6 sm:px-6',
            stuck && 'shadow-[0_1px_0_var(--line)]',
            'lg:static lg:mx-0 lg:bg-transparent lg:px-0 lg:pt-0 lg:pb-0 lg:shadow-none'
          )}
        >
          <div className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-3">
            {back && (
              <IconLink href={back.href} label={back.label} className="-ml-2.5 shrink-0 lg:hidden">
                <CaretLeftIcon aria-hidden weight="bold" className="size-[1.375rem]" />
              </IconLink>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[1.375rem] leading-tight font-semibold tracking-[-0.02em] lg:text-[1.625rem]">{title}</h1>
              {summary && <p className="mt-1.5 hidden max-w-[72ch] text-sm text-ink-3 text-pretty lg:block">{summary}</p>}
            </div>
            <div className="flex items-center gap-2 lg:hidden">
              <IconButton label={t.shell.palette.open} variant="secondary" onPress={actions.openPalette} className="rounded-full">
                <MagnifyingGlassIcon aria-hidden className="size-5" />
              </IconButton>
              <IconButton label={t.shell.quickAdd.title} variant="primary" onPress={actions.openQuickAdd} className="rounded-full">
                <PlusIcon aria-hidden weight="bold" className="size-5" />
              </IconButton>
            </div>
            <div className="hidden flex-wrap items-center gap-2.5 lg:flex">
              {toolbar}
              <Button variant="primary" icon={<PlusIcon aria-hidden weight="bold" className="size-4" />} onPress={add.onPress} className="order-last">
                {add.label}
              </Button>
            </div>
          </div>
        </header>
        {summary && <p className="mt-1 max-w-[65ch] text-sm text-ink-3 text-pretty lg:hidden">{summary}</p>}
        {toolbar && <div className="mt-3 flex flex-wrap items-center gap-2 lg:hidden">{toolbar}</div>}
        <div className="mt-5 lg:mt-6">{children}</div>
      </div>
    </>
  )
}

/** Desktop only: the rail toggle, where you are, search and the account. */
function TopBar({ title, back }: { title: ReactNode; back?: { href: string; label: string } }) {
  const { t } = useI18n()
  const actions = useActions()
  const { collapsed, toggleRail } = useShell()
  const { pathname } = useLocation()
  const section = [...NAV, SETTINGS_NAV].find((item) => item.match(pathname))
  const sectionLabel = section?.label(t)
  const parent = back
  const showSection = sectionLabel && !back && typeof title === 'string' ? sectionLabel !== title : false
  return (
    <div className="sticky top-0 z-20 hidden min-h-16 flex-wrap items-center gap-x-3 gap-y-2.5 border-b border-line bg-ground px-6 py-3 lg:flex">
      <IconButton label={collapsed ? t.shell.nav.expand : t.shell.nav.collapse} size="sm" onPress={toggleRail} className="text-ink">
        <SidebarSimpleIcon aria-hidden className="size-[1.0625rem]" />
      </IconButton>
      <span aria-hidden className="h-4 w-px bg-line" />
      <nav aria-label={t.shell.nav.crumbs} className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
        <Link href="/" className="shrink-0 text-ink-3 no-underline outline-none data-hovered:text-ink data-focus-visible:ring-2 data-focus-visible:ring-focus">
          {t.shell.nav.root}
        </Link>
        {parent && (
          <>
            <CaretRightIcon aria-hidden className="size-3.5 shrink-0 text-ink-3" />
            <Link href={parent.href} className="shrink-0 text-ink-3 no-underline outline-none data-hovered:text-ink data-focus-visible:ring-2 data-focus-visible:ring-focus">
              {parent.label}
            </Link>
          </>
        )}
        {showSection && (
          <>
            <CaretRightIcon aria-hidden className="size-3.5 shrink-0 text-ink-3" />
            <span className="shrink-0 text-ink-3">{sectionLabel}</span>
          </>
        )}
        <CaretRightIcon aria-hidden className="size-3.5 shrink-0 text-ink-3" />
        <span aria-current="page" className="min-w-0 truncate font-medium">
          {title}
        </span>
      </nav>
      <AriaButton
        onPress={actions.openPalette}
        className="flex h-[2.375rem] w-[20rem] max-w-full min-w-[12.5rem] shrink items-center gap-2 rounded-full border border-line bg-surface-2 pr-1.5 pl-3.5 text-left text-sm text-ink-3 outline-none transition-colors duration-150 data-hovered:border-line-strong data-focus-visible:ring-2 data-focus-visible:ring-focus"
      >
        <MagnifyingGlassIcon aria-hidden className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{t.shell.palette.open}</span>
        <kbd className="shrink-0 rounded-[0.375rem] border border-line bg-surface px-[0.4375rem] py-0.5 font-sans text-[0.71875rem] font-medium text-ink-3">
          {t.shell.palette.shortcut}
        </kbd>
      </AriaButton>
      <AccountButton />
    </div>
  )
}

/**
 * A titled card: a header with title, a one-line description and optional controls, then
 * content edge to edge, then an optional footer line. The panel's one container.
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
  level = 2
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
}) {
  const Heading = level === 3 ? 'h3' : 'h2'
  return (
    <section id={id} className={cx('flex min-w-0 scroll-mt-24 flex-col overflow-hidden rounded-panel border border-line bg-surface', className)}>
      {(title || aside) && (
        <div className="flex flex-wrap items-center gap-3 px-4 pt-[1.125rem] pb-3.5 sm:px-5">
          <div className="min-w-0 flex-[1_1_14rem]">
            {title && <Heading className="text-[0.96875rem] font-semibold tracking-[-0.01em]">{title}</Heading>}
            {description && <p className="mt-0.5 truncate text-[0.84375rem] text-ink-3">{description}</p>}
          </div>
          {aside && <div className="flex shrink-0 flex-wrap items-center gap-2">{aside}</div>}
        </div>
      )}
      <div className={cx('min-h-0 flex-1', Boolean(title || aside) && 'border-t border-line', bodyClassName)}>{children}</div>
      {footer && (
        // Pulled up a pixel: a body whose last row draws its own line meets the footer in one line, not two
        <div className="-mt-px flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line px-4 py-3.5 text-[0.8125rem] text-ink-3 sm:px-5">
          {footer}
        </div>
      )}
    </section>
  )
}

/** The underlined link at the right of a card footer. */
export function CardLink({ href, children, onPress }: { href?: string; children: ReactNode; onPress?: () => void }) {
  return (
    <Link
      href={href}
      onPress={onPress}
      className="inline-flex items-center gap-1 text-ink-2 underline decoration-line-strong underline-offset-[3px] outline-none data-hovered:text-ink data-hovered:decoration-ink-3 data-focus-visible:ring-2 data-focus-visible:ring-focus"
    >
      {children}
      <CaretRightIcon aria-hidden weight="bold" className="size-3" />
    </Link>
  )
}

/** A grey band across a card: column heads or the head of a group of rows. */
export function Band({ children, className, sticky }: { children: ReactNode; className?: string; sticky?: boolean }) {
  return (
    <div
      className={cx(
        'flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-line bg-surface-2 px-4 py-2 text-[0.78125rem] text-ink-3 sm:px-5',
        sticky && 'sticky top-0 z-[1]',
        className
      )}
    >
      {children}
    </div>
  )
}

/**
 * A titled part of a page, for detail panels and forms. Boxed, it is a small card of its own: a
 * ruled header and a padded body, for the side column of a page.
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
      <section id={id} className={cx('min-w-0 scroll-mt-24 overflow-hidden rounded-panel border border-line bg-surface', className)}>
        {(title || aside) && (
          <div className="flex items-baseline gap-3 border-b border-line px-4 pt-4 pb-3.5 sm:px-5">
            {title && <Heading className="min-w-0 flex-1 text-[0.96875rem] font-semibold tracking-[-0.01em]">{title}</Heading>}
            {aside && <div className="shrink-0 text-sm text-ink-2">{aside}</div>}
          </div>
        )}
        <div className="px-4 py-3 sm:px-5">{children}</div>
      </section>
    )
  }
  return (
    <section id={id} className={cx('scroll-mt-24', className)}>
      {(title || aside) && (
        <div className="mb-3 flex items-baseline gap-3">
          {title && <Heading className="min-w-0 flex-1 text-[0.96875rem] font-semibold tracking-[-0.01em]">{title}</Heading>}
          {aside && <div className="shrink-0 text-sm text-ink-2">{aside}</div>}
        </div>
      )}
      {children}
    </section>
  )
}
