import { forwardRef, type ReactNode } from 'react'
import {
  Button as AriaButton,
  Link as AriaLink,
  type ButtonProps as AriaButtonProps,
  type LinkProps as AriaLinkProps
} from 'react-aria-components'
import { cx } from './cx'
import { Spinner } from './Spinner'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'quiet' | 'danger' | 'danger-soft'
export type ButtonSize = 'sm' | 'md' | 'lg'

export function buttonClass(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md', extra?: string | false) {
  return cx(
    'relative inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap select-none rounded-full outline-none',
    'transition-[background-color,border-color,color,scale] duration-150 ease-standard',
    'data-focus-visible:ring-2 data-focus-visible:ring-focus data-focus-visible:ring-offset-2 data-focus-visible:ring-offset-ground',
    'data-pressed:scale-[0.98] data-disabled:cursor-not-allowed data-disabled:opacity-45',
    // A fingertip gets 44 px around a small button without the button growing
    size === 'sm' && 'h-8 px-3 text-[0.8125rem] pointer-coarse:after:absolute pointer-coarse:after:-inset-1.5',
    size === 'md' && 'h-[2.375rem] px-4 text-sm max-lg:h-11',
    size === 'lg' && 'h-12 px-5 text-[0.9375rem]',
    variant === 'primary' &&
      'border border-accent-solid bg-accent-solid text-on-accent data-hovered:border-[color-mix(in_oklab,var(--accent-solid)_86%,black)] data-hovered:bg-[color-mix(in_oklab,var(--accent-solid)_86%,black)]',
    variant === 'secondary' && 'border border-line bg-surface text-ink data-hovered:border-line-strong data-hovered:bg-surface-2',
    variant === 'ghost' && 'text-ink-2 data-hovered:bg-hover data-hovered:text-ink',
    variant === 'quiet' && 'text-accent-ink data-hovered:bg-accent-wash',
    variant === 'danger' &&
      'border border-negative bg-negative text-on-negative data-hovered:bg-[color-mix(in_oklab,var(--negative)_86%,black)]',
    variant === 'danger-soft' && 'text-negative-ink data-hovered:bg-negative-wash',
    extra
  )
}

type ButtonProps = Omit<AriaButtonProps, 'className' | 'children'> & {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  icon?: ReactNode
  children?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', className, icon, children, isPending, ...props },
  ref
) {
  return (
    <AriaButton ref={ref} {...props} isPending={isPending} className={buttonClass(variant, size, className)}>
      {isPending ? <Spinner className="size-4" /> : icon}
      {children}
    </AriaButton>
  )
})

type IconButtonProps = Omit<AriaButtonProps, 'className' | 'children'> & {
  label: string
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  children: ReactNode
}

/** A square button that only shows an icon; `label` is what screen readers say. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = 'ghost', size = 'md', className, children, ...props },
  ref
) {
  return (
    <AriaButton
      ref={ref}
      aria-label={label}
      {...props}
      className={buttonClass(
        variant,
        size,
        cx('px-0!', size === 'sm' ? 'w-8' : size === 'md' ? 'w-[2.375rem] max-lg:w-11' : 'w-12', className)
      )}
    >
      {children}
    </AriaButton>
  )
})

type ButtonLinkProps = Omit<AriaLinkProps, 'className' | 'children'> & {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  icon?: ReactNode
  children?: ReactNode
}

export function ButtonLink({ variant = 'secondary', size = 'md', className, icon, children, ...props }: ButtonLinkProps) {
  return (
    <AriaLink {...props} className={buttonClass(variant, size, cx('no-underline', className))}>
      {icon}
      {children}
    </AriaLink>
  )
}

type IconLinkProps = Omit<AriaLinkProps, 'className' | 'children'> & {
  label: string
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  children: ReactNode
}

/** A square link that only shows an icon (call, WhatsApp). */
export function IconLink({ label, variant = 'ghost', size = 'md', className, children, ...props }: IconLinkProps) {
  return (
    <AriaLink
      aria-label={label}
      {...props}
      className={buttonClass(
        variant,
        size,
        cx('no-underline px-0!', size === 'sm' ? 'w-8' : size === 'md' ? 'w-[2.375rem] max-lg:w-11' : 'w-12', className)
      )}
    >
      {children}
    </AriaLink>
  )
}
