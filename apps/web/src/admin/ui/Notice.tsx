import type { ReactNode } from 'react'
import { cx } from './cx'

export type NoticeTone = 'info' | 'action' | 'positive' | 'negative'

/** A sentence that explains what will happen, tinted by what it asks of the person. */
export function Notice({ tone = 'info', children, className }: { tone?: NoticeTone; children: ReactNode; className?: string }) {
  return (
    <p
      role={tone === 'negative' ? 'alert' : undefined}
      className={cx(
        'rounded-control border px-3 py-2.5 text-[0.8125rem] leading-snug text-pretty',
        tone === 'info' && 'border-accent-line bg-accent-wash text-accent-ink',
        tone === 'action' && 'border-action-line bg-action-wash text-action-ink',
        tone === 'positive' && 'border-positive-line bg-positive-wash text-positive-ink',
        tone === 'negative' && 'border-negative-line bg-negative-wash text-negative-ink',
        className
      )}
    >
      {children}
    </p>
  )
}

/** A hairline between the parts of a form. */
export function FormRule() {
  return <div aria-hidden className="h-px bg-line" />
}
