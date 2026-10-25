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
    <ul aria-label={aria['aria-label']} className={cx('-mx-2 flex flex-col gap-0.5', className)}>
      {items.map((item) => (
        <li key={item.id}>
          <AriaButton
            onPress={() => onChoose(item.id)}
            isDisabled={item.isDisabled}
            className={cx(
              'group flex w-full items-start gap-3.5 rounded-control px-2 py-2.5 text-left outline-none transition-colors duration-150',
              'data-hovered:bg-well data-pressed:bg-well data-focus-visible:ring-2 data-focus-visible:ring-focus data-disabled:opacity-50'
            )}
          >
            {item.icon && (
              <span
                aria-hidden
                className={cx(
                  'grid size-9 shrink-0 place-items-center rounded-tablet',
                  item.tone === 'action' ? 'bg-action-wash text-action-ink' : 'bg-accent-wash text-accent-ink'
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
