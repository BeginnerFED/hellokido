import { forwardRef, useState, type ReactNode } from 'react'
import {
  FieldError,
  Input,
  Label,
  SearchField as AriaSearchField,
  Text,
  TextArea as AriaTextArea,
  TextField as AriaTextField,
  Button as AriaButton,
  type TextFieldProps as AriaTextFieldProps
} from 'react-aria-components'
import { MagnifyingGlassIcon, XIcon } from '@phosphor-icons/react'
import { formatMoney, parseAmount, sanitizeAmountInput } from '@hellokido/core/rules/money.js'
import { cx } from './cx'

export const fieldLabelClass = 'text-[0.84375rem] font-semibold text-ink-2'

/** A felt field: felt on the page and in sheets, raised on a felt card (the --field colour). */
export const inputClass = cx(
  'w-full min-w-0 rounded-control border-[1.5px] border-transparent bg-field px-3.5 text-[0.96875rem] text-ink',
  'placeholder:text-ink-3 outline-none transition-[border-color,box-shadow] duration-150',
  'data-hovered:border-line-strong',
  'data-focused:border-accent data-focused:ring-3 data-focused:ring-accent/20',
  'data-invalid:border-negative data-invalid:data-focused:ring-negative/20',
  'data-disabled:text-ink-3 data-disabled:opacity-70'
)

type Common = {
  label?: ReactNode
  description?: ReactNode
  errorMessage?: string
  className?: string
}

type TextFieldProps = Omit<AriaTextFieldProps, 'className' | 'children'> &
  Common & {
    placeholder?: string
    suffix?: ReactNode
    /** A control inside the field's right edge (e.g. show password). */
    endSlot?: ReactNode
    inputClassName?: string
    inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
    autoComplete?: string
  }

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, description, errorMessage, className, placeholder, suffix, endSlot, inputClassName, inputMode, autoComplete, ...props },
  ref
) {
  return (
    <AriaTextField {...props} isInvalid={props.isInvalid ?? Boolean(errorMessage)} className={cx('flex flex-col gap-1.5', className)}>
      {label && <Label className={fieldLabelClass}>{label}</Label>}
      <div className="relative">
        <Input
          ref={ref}
          placeholder={placeholder}
          inputMode={inputMode}
          autoComplete={autoComplete}
          className={cx(inputClass, 'h-[2.875rem]', suffix ? 'pr-24' : '', endSlot ? 'pr-12' : '', inputClassName)}
        />
        {endSlot && <div className="absolute inset-y-0 right-1.5 flex items-center">{endSlot}</div>}
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-ink-3 tabular dark:text-ink-2">
            {suffix}
          </span>
        )}
      </div>
      {description && !errorMessage && (
        <Text slot="description" className="text-[0.8125rem] text-ink-3">
          {description}
        </Text>
      )}
      <FieldError className="text-[0.8125rem] text-negative-ink">{errorMessage}</FieldError>
    </AriaTextField>
  )
})

type TextAreaProps = Omit<AriaTextFieldProps, 'className' | 'children'> & Common & { placeholder?: string; rows?: number }

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, description, errorMessage, className, placeholder, rows = 3, ...props },
  ref
) {
  return (
    <AriaTextField {...props} isInvalid={Boolean(errorMessage)} className={cx('flex flex-col gap-1.5', className)}>
      {label && <Label className={fieldLabelClass}>{label}</Label>}
      <AriaTextArea ref={ref} placeholder={placeholder} rows={rows} className={cx(inputClass, 'resize-y py-3 leading-normal')} />
      {description && !errorMessage && (
        <Text slot="description" className="text-[0.8125rem] text-ink-3">
          {description}
        </Text>
      )}
      <FieldError className="text-[0.8125rem] text-negative-ink">{errorMessage}</FieldError>
    </AriaTextField>
  )
})

type AmountFieldProps = Common & {
  value: string
  onChange: (value: string) => void
  isRequired?: boolean
  isDisabled?: boolean
  autoFocus?: boolean
  placeholder?: string
}

/**
 * Amounts are typed and shown the Turkish way in every language: 13.850 or 13.850,50.
 * The preview on the right shows how the text was read, so a slip of 1000x is visible at once.
 */
export function AmountField({ value, onChange, label, description, errorMessage, className, ...rest }: AmountFieldProps) {
  const parsed = value.trim() ? parseAmount(value) : null
  const preview = parsed !== null && Number.isFinite(parsed) ? `${formatMoney(parsed)} ₺` : '₺'
  return (
    <TextField
      {...rest}
      label={label}
      description={description}
      errorMessage={errorMessage}
      className={className}
      value={value}
      onChange={(text) => onChange(sanitizeAmountInput(text))}
      inputMode="decimal"
      autoComplete="off"
      inputClassName="tabular text-[1.0625rem] font-medium"
      suffix={preview}
    />
  )
}

type SearchFieldProps = {
  value: string
  onChange: (value: string) => void
  placeholder: string
  label: string
  className?: string
  autoFocus?: boolean
}

export function SearchField({ value, onChange, placeholder, label, className, autoFocus }: SearchFieldProps) {
  const [focused, setFocused] = useState(false)
  return (
    <AriaSearchField
      aria-label={label}
      value={value}
      onChange={onChange}
      autoFocus={autoFocus}
      onFocusChange={setFocused}
      className={cx('group relative flex items-center', className)}
    >
      <MagnifyingGlassIcon
        aria-hidden
        className={cx('pointer-events-none absolute left-4 size-[1.125rem] transition-colors', focused ? 'text-accent' : 'text-ink-3')}
      />
      <Input placeholder={placeholder} className={cx(inputClass, 'h-[2.625rem] rounded-full pr-10 pl-11 text-[0.90625rem] max-lg:h-11 [&::-webkit-search-cancel-button]:hidden')} />
      <AriaButton className="absolute right-1.5 grid size-8 place-items-center rounded-full text-ink-3 outline-none data-hovered:bg-hover data-hovered:text-ink data-focus-visible:ring-2 data-focus-visible:ring-focus group-data-empty:hidden">
        <XIcon aria-hidden className="size-4" />
      </AriaButton>
    </AriaSearchField>
  )
}
