import type { ReactNode } from 'react'
import logoLight from '../../assets/hellokido-logo.svg'
import logoDark from '../../assets/hellokido-logo-dark.svg'
import { cx } from './cx'

/** The logo follows the theme: the dark file turns the black words white. */
export function Logo({ className }: { className?: string }) {
  return (
    <>
      <img src={logoLight} alt="Hello Kido" width={912} height={523} className={cx('h-auto dark:hidden', className)} />
      <img src={logoDark} alt="Hello Kido" width={912} height={523} className={cx('hidden h-auto dark:block', className)} />
    </>
  )
}

/** A shape while something loads; `span` where only text may go (inside a heading). */
export function Skeleton({ className, as: Tag = 'div' }: { className?: string; as?: 'div' | 'span' }) {
  return (
    <Tag
      aria-hidden
      className={cx(
        'animate-shimmer rounded-control bg-[length:200%_100%]',
        'bg-[linear-gradient(90deg,var(--track)_25%,color-mix(in_srgb,var(--track)_45%,var(--felt))_50%,var(--track)_75%)]',
        className
      )}
    />
  )
}

type EmptyProps = { title: ReactNode; body?: ReactNode; action?: ReactNode; className?: string; icon?: ReactNode }

export function EmptyState({ title, body, action, className, icon }: EmptyProps) {
  return (
    <div className={cx('flex flex-col items-center px-6 py-10 text-center', className)}>
      {icon && <div className="mb-3 text-ink-3">{icon}</div>}
      <p className="text-[0.96875rem] font-medium text-ink">{title}</p>
      {body && <p className="mt-1 max-w-sm text-[0.84375rem] text-ink-3 text-pretty">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/** Inline error with a retry, used where a list failed to load. */
export function LoadError({ message, retryLabel, onRetry }: { message: string; retryLabel: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control bg-negative-wash px-4 py-3 text-sm text-negative-ink">
      <span className="min-w-0 flex-1">{message}</span>
      <button type="button" onClick={onRetry} className="rounded-[0.25rem] font-semibold underline decoration-1 underline-offset-[3px] outline-none hover:decoration-2 focus-visible:ring-2 focus-visible:ring-focus">
        {retryLabel}
      </button>
    </div>
  )
}

export type MarkTone = 'action' | 'positive' | 'negative' | 'accent' | 'neutral' | 'pink'

const MARK_TONES: Record<MarkTone, { ink: string; dot: string }> = {
  action: { ink: 'text-amber-ink', dot: 'bg-amber' },
  positive: { ink: 'text-green-ink', dot: 'bg-green' },
  negative: { ink: 'text-negative-ink', dot: 'bg-negative' },
  accent: { ink: 'text-accent-ink', dot: 'bg-accent' },
  pink: { ink: 'text-pink-ink', dot: 'bg-pink' },
  neutral: { ink: 'text-ink-3', dot: 'bg-mute' }
}

/**
 * A status as a 7px dot and a word in the status ink; no outline, no fill. Amber ("action") is
 * only for things the admin has to do.
 */
export function Mark({ tone, children, className, dot = true }: { tone: MarkTone; children: ReactNode; className?: string; dot?: boolean }) {
  const look = MARK_TONES[tone]
  return (
    <span className={cx('inline-flex shrink-0 items-center gap-1.5 text-[0.8125rem] leading-[1.0625rem] font-medium whitespace-nowrap', look.ink, className)}>
      {dot && <span aria-hidden className={cx('size-[7px] shrink-0 rounded-full', look.dot)} />}
      {children}
    </span>
  )
}

/** "Şimdi, 48 dk kaldı": a raised pill with a pink dot in a soft ring; on a lesson card in dark it takes the card's track. */
export function LiveMark({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex h-[1.875rem] shrink-0 items-center gap-[0.4375rem] rounded-full bg-raised pr-3 pl-2.5 text-sm font-medium whitespace-nowrap text-ink',
        'dark:bg-[var(--t-track,var(--raised))] dark:text-[var(--t-ink,var(--ink))]',
        className
      )}
    >
      <span aria-hidden className="size-2 shrink-0 rounded-full bg-pink shadow-[0_0_0_3px_color-mix(in_srgb,var(--pink)_22%,transparent)]" />
      {children}
    </span>
  )
}

const AVATAR_SIZES = {
  xs: 'size-6 text-[0.6875rem]',
  sm: 'size-8 text-[0.75rem]',
  md: 'size-9 text-[0.8125rem]',
  lg: 'size-12 text-[0.9375rem]',
  xl: 'size-[4.75rem] text-[1.5rem]'
}

/**
 * A child or parent as an initials circle. `piece` takes what it sits on (felt on the page, raised
 * on a felt card); `sky` marks the selected child or the child of the page; `type` sits on a lesson card.
 */
export function Avatar({
  name,
  size = 'md',
  tone = 'piece',
  className
}: {
  name: string | null | undefined
  size?: keyof typeof AVATAR_SIZES
  tone?: 'piece' | 'sky' | 'type'
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cx(
        'grid shrink-0 place-items-center rounded-full font-semibold',
        AVATAR_SIZES[size],
        tone === 'piece' && 'bg-piece text-ink-2',
        tone === 'sky' && 'bg-sky-felt text-sky-ink',
        tone === 'type' && 'bg-raised text-(--t-ink) dark:bg-(--t-track)',
        className
      )}
    >
      {initialsOf(name)}
    </span>
  )
}

/** A 36 icon circle in the piece colour, with an amber dot when its job is overdue. */
export function IconDisc({ children, alert, className }: { children: ReactNode; alert?: boolean; className?: string }) {
  return (
    <span aria-hidden className={cx('relative grid size-9 shrink-0 place-items-center rounded-full bg-piece text-ink-2', className)}>
      {children}
      {alert && <span className="absolute top-0 right-0 size-2.5 rounded-full border-2 border-felt bg-amber" />}
    </span>
  )
}

export function initialsOf(name: string | null | undefined) {
  const words = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return '?'
  const first = words[0][0] ?? ''
  const last = words.length > 1 ? (words[words.length - 1][0] ?? '') : ''
  return (first + last).toLocaleUpperCase('tr-TR')
}
