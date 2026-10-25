import { forwardRef, type ReactNode } from 'react'
import {
  Button as AriaButton,
  Link as AriaLink,
  type ButtonProps as AriaButtonProps,
  type LinkProps as AriaLinkProps
} from 'react-aria-components'
import { cx } from './cx'
import { Spinner } from './Spinner'

/**
 * - primary: the one filled button of an area (fill, white text);
 * - secondary: a raised felt piece with a lift, for row actions (Tahsil et, Yenile, Gir, Kaydet);
 * - quiet: felt with no shadow, for toolbar extras (Takvimi aç); a step darker on a felt card;
 * - ghost: text only until hovered;
 * - danger / danger-soft: deleting and other things that cannot be undone.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'quiet' | 'danger' | 'danger-soft'
export type ButtonSize = 'sm' | 'md' | 'lg'

export function buttonClass(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md', extra?: string | false) {
  return cx(
    'relative inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap select-none rounded-full outline-none',
    'transition-[background-color,color,scale,box-shadow] duration-150 ease-standard',
    'data-focus-visible:ring-2 data-focus-visible:ring-focus data-focus-visible:ring-offset-2 data-focus-visible:ring-offset-page',
    'data-pressed:scale-[0.98] data-disabled:cursor-not-allowed data-disabled:opacity-45',
    // A fingertip gets 44 px around a small button without the button growing
    size === 'sm' && 'h-8 px-[0.8125rem] text-sm pointer-coarse:after:absolute pointer-coarse:after:-inset-1.5',
    size === 'md' && 'h-10 px-[1.0625rem] text-[0.9375rem] max-lg:h-11',
    size === 'lg' && 'h-12 px-5 text-[0.96875rem]',
    variant === 'primary' && 'bg-fill text-on-fill data-hovered:bg-[color-mix(in_oklab,var(--fill)_86%,black)]',
    variant === 'secondary' && 'bg-raised text-ink shadow-lift data-hovered:bg-[color-mix(in_oklab,var(--raised)_94%,var(--ink))]',
    variant === 'quiet' && 'bg-quiet text-ink data-hovered:bg-[color-mix(in_oklab,var(--quiet)_92%,var(--ink))]',
    variant === 'ghost' && 'text-ink-2 data-hovered:bg-hover data-hovered:text-ink',
    variant === 'danger' && 'bg-negative text-on-negative data-hovered:bg-[color-mix(in_oklab,var(--negative)_86%,black)]',
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

const iconSize = (size: ButtonSize) => (size === 'sm' ? 'w-8' : size === 'md' ? 'w-10 max-lg:w-11' : 'w-12')

type IconButtonProps = Omit<AriaButtonProps, 'className' | 'children'> & {
  label: string
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  children: ReactNode
}

/** A round button that only shows an icon; `label` is what screen readers say. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = 'ghost', size = 'md', className, children, ...props },
  ref
) {
  return (
    <AriaButton ref={ref} aria-label={label} {...props} className={buttonClass(variant, size, cx('px-0!', iconSize(size), className))}>
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

/** A round link that only shows an icon (call, WhatsApp). */
export function IconLink({ label, variant = 'ghost', size = 'md', className, children, ...props }: IconLinkProps) {
  return (
    <AriaLink aria-label={label} {...props} className={buttonClass(variant, size, cx('no-underline px-0!', iconSize(size), className))}>
      {children}
    </AriaLink>
  )
}

/** An underlined text action inside a sentence or a card footer ("Dersi aç", "7 iş seni bekliyor"). */
export function textLinkClass(tone: 'ink' | 'action' | 'inherit' = 'ink') {
  return cx(
    'rounded-[0.25rem] font-medium underline decoration-1 underline-offset-[3px] outline-none',
    'data-focus-visible:ring-2 data-focus-visible:ring-focus',
    tone === 'ink' && 'text-ink data-hovered:decoration-2',
    tone === 'action' && 'text-amber-ink data-hovered:decoration-2',
    tone === 'inherit' && 'text-inherit data-hovered:decoration-2'
  )
}
