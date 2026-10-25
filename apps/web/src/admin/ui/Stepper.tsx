import type { ReactNode } from 'react'
import { Button as AriaButton, Group } from 'react-aria-components'
import { MinusIcon, PlusIcon } from '@phosphor-icons/react'
import { fieldLabelClass } from './Field'
import { cx } from './cx'

type Props = {
  label: ReactNode
  value: number
  onChange: (value: number) => void
  min?: number
  max: number
  decreaseLabel: string
  increaseLabel: string
  description?: ReactNode
  isDisabled?: boolean
  className?: string
}

/** A small whole-number count (extra lessons): minus, the number, plus. */
export function Stepper({ label, value, onChange, min = 0, max, decreaseLabel, increaseLabel, description, isDisabled, className }: Props) {
  const count = Math.min(Math.max(Math.trunc(Number(value)) || 0, min), max)
  const buttonClass =
    'grid size-9 place-items-center rounded-full text-ink-2 outline-none transition-colors data-hovered:bg-hover data-hovered:text-ink data-disabled:opacity-35 data-focus-visible:ring-2 data-focus-visible:ring-focus'
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <div className="flex items-center gap-3">
        <span className={cx(fieldLabelClass, 'min-w-0 flex-1')}>{label}</span>
        <Group
          aria-label={typeof label === 'string' ? label : undefined}
          isDisabled={isDisabled}
          className="flex items-center gap-1 rounded-full bg-field p-[3px] data-disabled:opacity-50"
        >
          <AriaButton aria-label={decreaseLabel} isDisabled={isDisabled || count <= min} onPress={() => onChange(count - 1)} className={buttonClass}>
            <MinusIcon aria-hidden weight="bold" className="size-3.5" />
          </AriaButton>
          <span aria-live="polite" className={cx('w-7 text-center text-[0.9375rem] tabular', count > 0 ? 'font-semibold text-ink' : 'text-ink-3')}>
            {count}
          </span>
          <AriaButton aria-label={increaseLabel} isDisabled={isDisabled || count >= max} onPress={() => onChange(count + 1)} className={buttonClass}>
            <PlusIcon aria-hidden weight="bold" className="size-3.5" />
          </AriaButton>
        </Group>
      </div>
      {description && <span className="text-[0.8125rem] text-ink-3">{description}</span>}
    </div>
  )
}
