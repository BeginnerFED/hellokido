import type { ReactNode } from 'react'
import {
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  MenuTrigger,
  Popover,
  Separator,
  type MenuItemProps,
  type PopoverProps
} from 'react-aria-components'
import { cx } from './cx'

export const popoverClass =
  'min-w-[12rem] overflow-auto rounded-panel border border-line bg-surface p-1.5 text-ink shadow-lift outline-none data-entering:animate-pop-in data-exiting:animate-pop-out'

type MenuProps = {
  trigger: ReactNode
  children: ReactNode
  placement?: PopoverProps['placement']
  label?: string
}

/** A trigger (usually an IconButton) that opens a list of actions. */
export function Menu({ trigger, children, placement = 'bottom end', label }: MenuProps) {
  return (
    <MenuTrigger>
      {trigger}
      <Popover placement={placement} offset={6} className={popoverClass}>
        <AriaMenu aria-label={label} className="outline-none">
          {children}
        </AriaMenu>
      </Popover>
    </MenuTrigger>
  )
}

type ItemProps = Omit<MenuItemProps, 'className' | 'children'> & {
  icon?: ReactNode
  tone?: 'default' | 'danger'
  hint?: ReactNode
  children: ReactNode
}

export function MenuItem({ icon, tone = 'default', hint, children, ...props }: ItemProps) {
  const textValue = typeof children === 'string' ? children : undefined
  return (
    <AriaMenuItem
      textValue={textValue}
      {...props}
      className={cx(
        'flex cursor-default items-center gap-2.5 rounded-[0.5rem] px-2.5 py-2 text-sm outline-none select-none',
        'data-focused:bg-well data-disabled:opacity-45',
        tone === 'danger' ? 'text-negative-ink' : 'text-ink'
      )}
    >
      {icon && <span className={cx('grid size-5 place-items-center', tone === 'danger' ? '' : 'text-ink-2')}>{icon}</span>}
      <span className="min-w-0 flex-1">{children}</span>
      {hint && <span className="text-[0.8125rem] text-ink-3">{hint}</span>}
    </AriaMenuItem>
  )
}

export function MenuSeparator() {
  return <Separator className="mx-2 my-1 h-px bg-line" />
}
