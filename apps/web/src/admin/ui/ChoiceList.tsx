import type { ReactNode } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { CaretRightIcon } from '@phosphor-icons/react'
import { cx } from './cx'

export type ChoiceItem<K extends string = string> = {
  id: K
  title: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  /** Yellow tablet: this choice is waiting for the admin. */
  tone?: 'accent' | 'action'
  isDisabled?: boolean
}

/** A short list of next steps; choosing one moves on at once, so there is no separate "continue". */
export function ChoiceList<K extends string>({
  items,
  onChoose,
  className,
  ...aria
}: {
  items: ChoiceItem<K>[]
  onChoose: (id: K) => void
  className?: string
  'aria-label'?: string
}) {
  return (
    <ul aria-label={aria['aria-label']} className={cx('flex flex-col gap-2', className)}>
      {items.map((item) => (
        <li key={item.id}>
          {/* A felt row that lifts off the board under the pointer */}
          <AriaButton
            onPress={() => onChoose(item.id)}
            isDisabled={item.isDisabled}
            className={cx(
              'on-felt group flex w-full items-start gap-3.5 rounded-tile bg-felt px-3.5 py-3 text-left outline-none',
              'transition-[background-color,box-shadow,scale] duration-150 data-pressed:scale-[0.99]',
              'data-hovered:bg-raised data-hovered:shadow-lift data-focus-visible:ring-2 data-focus-visible:ring-focus data-disabled:opacity-50'
            )}
          >
            {item.icon && (
              <span
                aria-hidden
                className={cx(
                  'grid size-9 shrink-0 place-items-center rounded-full',
                  item.tone === 'action' ? 'bg-action-wash text-amber-ink' : 'bg-piece text-accent-ink group-data-hovered:bg-felt'
                )}
              >
                {item.icon}
              </span>
            )}
            <span className="min-w-0 flex-1 py-px">
              <span className="block text-[0.9375rem] font-medium text-ink">{item.title}</span>
              {item.hint && <span className="mt-0.5 block text-[0.8125rem] leading-snug text-ink-2 text-pretty">{item.hint}</span>}
            </span>
            <CaretRightIcon aria-hidden className="mt-2.5 size-4 shrink-0 text-ink-3 group-data-disabled:invisible" />
          </AriaButton>
        </li>
      ))}
    </ul>
  )
}
