import { useEffect, useState, type ReactNode, type RefObject } from 'react'
import {
  CakeIcon,
  CoinsIcon,
  ConfettiIcon,
  CookingPotIcon,
  CubeIcon,
  DropIcon,
  FlameIcon,
  HouseLineIcon,
  LightningIcon,
  MegaphoneIcon,
  PaintBrushIcon,
  ReceiptIcon,
  ShoppingBagIcon,
  UsersThreeIcon,
  WifiHighIcon,
  type Icon
} from '@phosphor-icons/react'
import type { Messages } from '@hellokido/core/i18n'
import type { Labels } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { Skeleton } from '../../ui/Bits'
import { cx } from '../../ui/cx'

/** The rows of a felt card: 22 side padding and a line between rows. */
export function Rows({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cx('[&>li]:px-4 sm:[&>li]:px-[1.375rem] [&>li+li]:border-t [&>li+li]:border-line', className)}>{children}</ul>
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden className="flex flex-col gap-2 px-4 pt-1 pb-4 sm:px-[1.375rem]">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-12" />
      ))}
    </div>
  )
}

/** Padding for what sits in a card's body outside the rows: an empty line, an error, a note. */
export const cardPad = 'px-4 pb-4 sm:px-[1.375rem]'

/**
 * A day as a 44 tile: the day's number over its month. A piece on the felt; amber-washed when its
 * day has passed with nothing done, green with a check once it is done.
 */
export function DateTile({ day, tone = 'plain', children }: { day: Date; tone?: 'plain' | 'late' | 'done'; children?: ReactNode }) {
  const { date } = useI18n()
  return (
    <span
      aria-hidden
      className={cx(
        'flex size-11 shrink-0 flex-col items-center justify-center rounded-[0.875rem] leading-none',
        tone === 'plain' && 'bg-piece text-ink',
        tone === 'late' && 'bg-[color-mix(in_srgb,var(--amber)_20%,var(--piece))] text-amber-ink',
        tone === 'done' && 'bg-positive-wash text-green-ink'
      )}
    >
      {children ?? (
        <>
          <span className="text-[1.0625rem] font-semibold">{day.getDate()}</span>
          <span className={cx('mt-[3px] text-[0.6875rem]', tone === 'late' ? 'text-amber-ink' : 'text-ink-3')}>{date(day, { month: 'short' })}</span>
        </>
      )}
    </span>
  )
}

const CATEGORY_ICONS: Record<string, Icon> = {
  kira: HouseLineIcon,
  elektrik: LightningIcon,
  su: DropIcon,
  dogalgaz: FlameIcon,
  internet: WifiHighIcon,
  maas: UsersThreeIcon,
  malzeme: PaintBrushIcon,
  mutfak: CookingPotIcon,
  reklam: MegaphoneIcon,
  filament: CubeIcon
}

/** An expense type as a disc with its picture, the size of a child's avatar. Own types get a receipt. */
export function CategoryTablet({ code, className }: { code: string | null | undefined; className?: string }) {
  const Glyph = CATEGORY_ICONS[code ?? ''] ?? ReceiptIcon
  return (
    <span aria-hidden className={cx('grid size-9 shrink-0 place-items-center rounded-full bg-piece text-ink-2', className)}>
      <Glyph className="size-[1.125rem]" />
    </span>
  )
}

const INCOME_ICONS: Record<string, Icon> = {
  etkinlik: ConfettiIcon,
  'dogum-gunu': CakeIcon,
  satis: ShoppingBagIcon
}

/** Income that belongs to no child (a party, a sale), with the picture of its category. Own categories get coins. */
export function IncomeTablet({ code, className }: { code?: string | null; className?: string }) {
  const Glyph = INCOME_ICONS[code ?? ''] ?? CoinsIcon
  return (
    <span aria-hidden className={cx('grid size-9 shrink-0 place-items-center rounded-full bg-sky-felt text-sky-ink', className)}>
      <Glyph className="size-[1.125rem]" />
    </span>
  )
}

export const MINUS = '−'

export const sumOf = (rows: { amount: number | string | null }[]) => rows.reduce((total, row) => total + (Number(row.amount) || 0), 0)

/** "Card", "Bank", "Cash"; nothing for a payment whose method was never set. */
export function methodName(t: Messages, labels: Labels, method: string | null | undefined) {
  if (!method || method === 'belirlenmedi') return ''
  return t.finance.methodShort[method] ?? labels.method(method)
}

/** The same time of day on another day, so a corrected expense keeps its place within the day. */
export function onDay(day: Date, base: Date) {
  const next = new Date(day)
  next.setHours(base.getHours(), base.getMinutes(), base.getSeconds(), base.getMilliseconds())
  return next
}

/** The width of an element, kept current as it resizes (charts draw in real pixels). */
export function useWidth(ref: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    setWidth(node.getBoundingClientRect().width)
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(node)
    return () => observer.disconnect()
  }, [ref])
  return width
}
