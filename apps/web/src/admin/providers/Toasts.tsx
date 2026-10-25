import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { CheckCircleIcon, InfoIcon, WarningCircleIcon, WarningIcon, XIcon } from '@phosphor-icons/react'
import { cx } from '../ui/cx'

export type ToastTone = 'success' | 'warning' | 'error' | 'info'
export type ToastInput = {
  tone?: ToastTone
  title: string
  body?: string
  action?: { label: string; onAction: () => void }
  /** Stays until closed (for results the person must read). */
  sticky?: boolean
}
type ToastItem = ToastInput & { id: number }

const ToastContext = createContext<((input: ToastInput) => void) | null>(null)

const ICONS = {
  success: <CheckCircleIcon weight="fill" className="size-5 text-positive" aria-hidden />,
  warning: <WarningIcon weight="fill" className="size-5 text-action" aria-hidden />,
  error: <WarningCircleIcon weight="fill" className="size-5 text-negative" aria-hidden />,
  info: <InfoIcon weight="fill" className="size-5 text-accent" aria-hidden />
}

// Long messages stay longer; errors and warnings never vanish before they can be read
const durationOf = (item: ToastInput) => {
  const minimum = item.tone === 'success' || item.tone === 'info' || !item.tone ? 3500 : 6000
  const length = item.title.length + (item.body?.length ?? 0)
  return Math.min(10000, Math.max(minimum, length * 60, item.action ? 7000 : 0))
}

export function ToastProvider({
  children,
  closeLabel,
  notice
}: {
  children: ReactNode
  closeLabel: string
  /** A standing message (such as "offline") at the edge of the region; toasts stack beside it, never over it. */
  notice?: ReactNode
}) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((item) => item.id !== id)), [])

  const toast = useCallback((input: ToastInput) => {
    const id = nextId.current++
    // At most three on screen (two on a phone, where they cover the page); the oldest gives way
    const keep = window.matchMedia('(min-width: 64rem)').matches ? 2 : 1
    setItems((list) => [...list.slice(-keep), { ...input, id }])
  }, [])

  const value = useMemo(() => toast, [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* A top layer for react-aria: readable, focusable and pressable while a sheet is open. With a
          sheet open the toasts move off its save button: to the top on phones, to the left on wide screens. */}
      <div
        role="region"
        aria-live="polite"
        data-react-aria-top-layer
        className={cx(
          'pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-[70] flex flex-col items-center gap-2 px-4 lg:inset-x-auto lg:right-6 lg:bottom-6 lg:items-end',
          '[[data-sheet]_&]:max-lg:top-[max(0.75rem,env(safe-area-inset-top))] [[data-sheet]_&]:max-lg:bottom-auto',
          '[[data-sheet]_&]:lg:right-auto [[data-sheet]_&]:lg:left-6 [[data-sheet]_&]:lg:items-start'
        )}
      >
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onClose={() => dismiss(item.id)} closeLabel={closeLabel} />
        ))}
        {notice}
      </div>
    </ToastContext.Provider>
  )
}

function ToastCard({ item, onClose, closeLabel }: { item: ToastItem; onClose: () => void; closeLabel: string }) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (item.sticky) return
    const timer = window.setTimeout(() => closeRef.current(), durationOf(item))
    return () => window.clearTimeout(timer)
  }, [item])

  return (
    <div
      role={item.tone === 'error' ? 'alert' : 'status'}
      className="pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-[1.125rem] bg-raised px-4 py-3 text-ink shadow-float"
    >
      <span className="mt-px">{ICONS[item.tone ?? 'success']}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-pretty">{item.title}</p>
        {item.body && <p className="mt-0.5 text-[0.8125rem] text-ink-2 text-pretty">{item.body}</p>}
        {item.action && (
          <AriaButton
            onPress={() => {
              item.action?.onAction()
              onClose()
            }}
            className="mt-1.5 -ml-1 rounded-[0.375rem] px-1 py-0.5 text-sm font-semibold text-accent-ink outline-none data-hovered:underline data-focus-visible:ring-2 data-focus-visible:ring-focus"
          >
            {item.action.label}
          </AriaButton>
        )}
      </div>
      <AriaButton
        aria-label={closeLabel}
        onPress={onClose}
        className={cx('-mr-1.5 grid size-7 shrink-0 place-items-center rounded-full text-ink-3 outline-none data-hovered:bg-well data-hovered:text-ink')}
      >
        <XIcon aria-hidden className="size-4" />
      </AriaButton>
    </div>
  )
}

export function useToast() {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast must be used inside ToastProvider')
  return value
}
