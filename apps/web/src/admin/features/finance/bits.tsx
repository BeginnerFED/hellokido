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
import { Skeleton } from '../../ui/Bits'
import { cx } from '../../ui/cx'

export function Rows({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cx('divide-y divide-line', className)}>{children}</ul>
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-12" />
      ))}
    </div>
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

/** An expense type as a small tablet with its picture, the size of a child's peg. Own types get a receipt. */
export function CategoryTablet({ code, className }: { code: string | null | undefined; className?: string }) {
  const Glyph = CATEGORY_ICONS[code ?? ''] ?? ReceiptIcon
  return (
    <span aria-hidden className={cx('grid size-8 shrink-0 place-items-center rounded-tablet bg-well text-ink-2', className)}>
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
    <span aria-hidden className={cx('grid size-8 shrink-0 place-items-center rounded-tablet bg-accent-wash text-accent-ink', className)}>
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
