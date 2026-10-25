import type { ReactNode } from 'react'
import { cx } from './cx'

export type NoticeTone = 'info' | 'action' | 'positive' | 'negative'

/** A sentence that explains what will happen, tinted by what it asks of the person. Matte: no edge. */
export function Notice({ tone = 'info', children, className }: { tone?: NoticeTone; children: ReactNode; className?: string }) {
  return (
    <p
      role={tone === 'negative' ? 'alert' : undefined}
      className={cx(
        'rounded-control px-3.5 py-3 text-[0.8125rem] leading-snug text-pretty',
        tone === 'info' && 'bg-accent-wash text-accent-ink',
        tone === 'action' && 'bg-action-wash text-action-ink',
        tone === 'positive' && 'bg-positive-wash text-positive-ink',
        tone === 'negative' && 'bg-negative-wash text-negative-ink',
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
