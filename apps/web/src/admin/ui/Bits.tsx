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

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cx(
        'animate-shimmer rounded-[0.5rem] bg-[length:200%_100%]',
        'bg-[linear-gradient(90deg,var(--well)_25%,var(--surface-2)_50%,var(--well)_75%)]',
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
      <p className="text-[0.9375rem] font-medium text-ink">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-ink-2 text-pretty">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/** Inline error with a retry, used where a list failed to load. */
export function LoadError({ message, retryLabel, onRetry }: { message: string; retryLabel: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control border border-negative-line bg-negative-wash px-4 py-3 text-sm text-negative-ink">
      <span className="min-w-0 flex-1">{message}</span>
      <button type="button" onClick={onRetry} className="font-semibold underline-offset-2 hover:underline">
        {retryLabel}
      </button>
    </div>
  )
}

export type MarkTone = 'action' | 'positive' | 'negative' | 'accent' | 'neutral' | 'pink'

const MARK_TONES: Record<MarkTone, { chip: string; dot: string }> = {
  action: { chip: 'border-action-line text-action-ink', dot: 'bg-action' },
  positive: { chip: 'border-positive-line text-positive-ink', dot: 'bg-positive' },
  negative: { chip: 'border-negative-line text-negative-ink', dot: 'bg-negative' },
  accent: { chip: 'border-accent-line text-accent-ink', dot: 'bg-accent' },
  pink: { chip: 'border-pink-line text-pink-ink', dot: 'bg-pink' },
  neutral: { chip: 'border-line text-ink-3', dot: 'bg-ink-4' }
}

/** An outlined status chip with a dot. Amber is for things that need the admin's action. */
export function Mark({ tone, children, className, dot = true }: { tone: MarkTone; children: ReactNode; className?: string; dot?: boolean }) {
  const look = MARK_TONES[tone]
  return (
    <span
      className={cx(
        'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border bg-surface px-2.5 text-[0.78125rem] font-medium whitespace-nowrap',
        look.chip,
        className
      )}
    >
      {dot && <span aria-hidden className={cx('size-1.5 shrink-0 rounded-full', look.dot)} />}
      {children}
    </span>
  )
}

/** A square initials tile, the avatar of a child or a parent in every row. */
export function Avatar({ name, size = 'md', className }: { name: string | null | undefined; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <span
      aria-hidden
      className={cx(
        'grid shrink-0 place-items-center border border-line bg-surface-2 font-semibold text-ink-2',
        size === 'sm' && 'size-8 rounded-[0.5rem] text-[0.6875rem]',
        size === 'md' && 'size-9 rounded-tile text-[0.78125rem]',
        size === 'lg' && 'size-12 rounded-[0.75rem] text-[0.9375rem]',
        className
      )}
    >
      {initialsOf(name)}
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
