import type { Key, ReactNode } from 'react'
import {
  Button as AriaButton,
  Checkbox as AriaCheckbox,
  FieldError,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Radio,
  RadioGroup,
  Select as AriaSelect,
  SelectValue,
  Switch as AriaSwitch,
  ToggleButton,
  ToggleButtonGroup,
  type CheckboxProps,
  type SwitchProps
} from 'react-aria-components'
import { CaretDownIcon, CaretUpDownIcon, CheckIcon } from '@phosphor-icons/react'
import { fieldLabelClass, inputClass } from './Field'
import { popoverClass } from './Menu'
import { cx } from './cx'

/** A row of a select's list: 40 tall, the nav's pill hover. */
const listItemClass =
  'group flex min-h-10 items-center gap-2.5 rounded-full px-3 py-2 text-[0.9375rem] outline-none select-none data-focused:bg-hover'

export type Option<K extends string = string> = {
  id: K
  label: string
  description?: string
  icon?: ReactNode
  /** A count after a chip's label. */
  badge?: ReactNode
  isDisabled?: boolean
}

/** The closed select shows the chosen label only, never the option's description, count or check. */
const selectedOnly = ({ isPlaceholder, selectedText, defaultChildren }: { isPlaceholder: boolean; selectedText: string; defaultChildren: ReactNode }) =>
  isPlaceholder ? defaultChildren : selectedText

type SelectProps<K extends string> = {
  label?: ReactNode
  options: Option<K>[]
  value: K | null
  onChange: (value: K) => void
  placeholder?: string
  errorMessage?: string
  isRequired?: boolean
  isDisabled?: boolean
  className?: string
  'aria-label'?: string
}

export function Select<K extends string>({
  label,
  options,
  value,
  onChange,
  placeholder,
  errorMessage,
  isRequired,
  isDisabled,
  className,
  ...aria
}: SelectProps<K>) {
  return (
    <AriaSelect
      aria-label={aria['aria-label']}
      selectedKey={value}
      onSelectionChange={(key: Key | null) => key != null && onChange(String(key) as K)}
      placeholder={placeholder}
      isRequired={isRequired}
      isDisabled={isDisabled}
      isInvalid={Boolean(errorMessage)}
      className={cx('flex flex-col gap-1.5', className)}
    >
      {label && <Label className={fieldLabelClass}>{label}</Label>}
      <AriaButton className={cx(inputClass, 'flex h-[2.875rem] items-center gap-2 text-left data-pressed:border-accent data-focus-visible:border-accent')}>
        <SelectValue className="min-w-0 flex-1 truncate data-placeholder:text-ink-3">{selectedOnly}</SelectValue>
        <CaretUpDownIcon aria-hidden className="size-4 shrink-0 text-ink-3" />
      </AriaButton>
      <FieldError className="text-[0.84375rem] text-negative-ink">{errorMessage}</FieldError>
      <Popover offset={6} className={cx(popoverClass, 'w-(--trigger-width) max-h-80')}>
        <ListBox items={options} className="outline-none">
          {(item) => (
            <ListBoxItem
              id={item.id}
              textValue={item.label}
              className={listItemClass}
            >
              {item.icon && <span className="grid size-5 place-items-center text-ink-2">{item.icon}</span>}
              <span className="min-w-0 flex-1">
                <span className="block truncate">{item.label}</span>
                {item.description && <span className="block text-[0.8125rem] text-ink-3">{item.description}</span>}
              </span>
              <CheckIcon aria-hidden weight="bold" className="size-4 text-accent opacity-0 group-data-selected:opacity-100" />
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </AriaSelect>
  )
}

type SegmentedProps<K extends string> = {
  label?: ReactNode
  options: Option<K>[]
  value: K | null
  onChange: (value: K) => void
  className?: string
  size?: 'sm' | 'md'
  'aria-label'?: string
  isDisabled?: boolean
  /** As wide as its labels (a toolbar switch) instead of filling the row. */
  fit?: boolean
}

/** A row of mutually exclusive choices, faster than a dropdown for two to five options. */
export function Segmented<K extends string>({ label, options, value, onChange, className, size = 'md', isDisabled, fit, ...aria }: SegmentedProps<K>) {
  const group = (
    <ToggleButtonGroup
      aria-label={aria['aria-label'] ?? (typeof label === 'string' ? label : undefined)}
      selectionMode="single"
      disallowEmptySelection
      isDisabled={isDisabled}
      selectedKeys={value ? [value] : []}
      onSelectionChange={(keys) => {
        const next = [...keys][0]
        if (next != null) onChange(String(next) as K)
      }}
      className={cx('flex gap-0.5 rounded-full bg-track p-[3px]', fit ? 'w-fit' : label ? 'w-full' : (className ?? 'w-full'))}
    >
      {options.map((option) => (
        <ToggleButton
          key={option.id}
          id={option.id}
          isDisabled={option.isDisabled}
          className={cx(
            'relative flex items-center justify-center gap-1.5 rounded-full font-medium whitespace-nowrap text-ink-2 outline-none',
            // Taller to a fingertip than it looks, over the group's own padding
            'pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-1',
            fit ? 'shrink-0 px-[0.8125rem]' : 'min-w-0 flex-1 px-2',
            'transition-[background-color,color,box-shadow] duration-180 ease-out data-hovered:text-ink',
            'data-selected:bg-raised data-selected:text-ink data-selected:shadow-lift',
            'data-focus-visible:ring-2 data-focus-visible:ring-focus data-disabled:opacity-45',
            size === 'sm' ? 'h-7 text-[0.8125rem]' : 'h-8 text-sm max-lg:h-9'
          )}
        >
          {option.icon}
          <span className="truncate">{option.label}</span>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )
  if (!label) return group
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <span className={fieldLabelClass}>{label}</span>
      {group}
    </div>
  )
}

type RadioListProps<K extends string> = {
  label: ReactNode
  options: Option<K>[]
  value: K | null
  onChange: (value: K) => void
  isDisabled?: boolean
  className?: string
}

/** One of a few choices that each need a line of explanation, such as the date it leads to. */
export function RadioList<K extends string>({ label, options, value, onChange, isDisabled, className }: RadioListProps<K>) {
  return (
    <RadioGroup
      value={value}
      onChange={(next) => onChange(next as K)}
      isDisabled={isDisabled}
      className={cx('flex flex-col gap-1.5', className)}
    >
      <Label className={fieldLabelClass}>{label}</Label>
      <div className="flex flex-col divide-y divide-line overflow-hidden rounded-control bg-field">
        {options.map((option) => (
          <Radio
            key={option.id}
            value={option.id}
            isDisabled={option.isDisabled}
            className={cx(
              'group flex items-center gap-3 px-3.5 py-3 outline-none first:rounded-t-control last:rounded-b-control',
              'transition-colors duration-150 data-hovered:bg-hover data-disabled:opacity-45 data-focus-visible:ring-2 data-focus-visible:ring-focus data-focus-visible:ring-inset'
            )}
          >
            <span
              aria-hidden
              className="grid size-[1.125rem] shrink-0 place-items-center rounded-full border-[1.5px] border-mute bg-raised transition-colors duration-150 group-data-selected:border-fill group-data-selected:bg-fill"
            >
              <span className="size-1.5 rounded-full bg-on-accent opacity-0 group-data-selected:opacity-100" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.9375rem] font-medium text-ink">{option.label}</span>
              {option.description && <span className="block text-[0.8125rem] text-ink-2">{option.description}</span>}
            </span>
          </Radio>
        ))}
      </div>
    </RadioGroup>
  )
}

type ChipsProps<K extends string> = {
  options: Option<K>[]
  selected: K[]
  onChange: (next: K[]) => void
  multiple?: boolean
  'aria-label': string
  className?: string
}

/** Filter chips: tap to turn on, tap again to turn off. */
export function Chips<K extends string>({ options, selected, onChange, multiple, className, ...aria }: ChipsProps<K>) {
  return (
    <ToggleButtonGroup
      aria-label={aria['aria-label']}
      selectionMode={multiple ? 'multiple' : 'single'}
      selectedKeys={selected}
      onSelectionChange={(keys) => onChange([...keys].map((key) => String(key) as K))}
      className={cx('flex flex-wrap gap-2', className)}
    >
      {options.map((option) => (
        <ToggleButton
          key={option.id}
          id={option.id}
          isDisabled={option.isDisabled}
          className={cx(
            // Filter chips are outlined pills; a chosen one turns sky felt inside a strong accent
            // outline with a tick, so it stands out from the rest even at a glance
            'group relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[0.84375rem] font-medium whitespace-nowrap text-ink outline-none',
            'shadow-[inset_0_0_0_1.5px_var(--line)]',
            'pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-1.5',
            'transition-[background-color,color,box-shadow] duration-150 data-hovered:shadow-[inset_0_0_0_1.5px_var(--line-strong)] data-disabled:opacity-45',
            'data-selected:bg-sky-felt data-selected:pl-2.5 data-selected:text-sky-ink data-selected:shadow-[inset_0_0_0_1.5px_var(--accent-ink)]',
            'data-selected:data-hovered:shadow-[inset_0_0_0_1.5px_var(--accent-ink)]',
            'data-focus-visible:ring-2 data-focus-visible:ring-focus'
          )}
        >
          <CheckIcon aria-hidden weight="bold" className="hidden size-3.5 shrink-0 group-data-selected:block" />
          {option.icon}
          {option.label}
          {option.badge !== undefined && (
            <span className="font-semibold text-ink-3 tabular group-data-selected:text-sky-ink">{option.badge}</span>
          )}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )
}

type ChipSelectProps<K extends string> = {
  options: Option<K>[]
  value: K
  onChange: (value: K) => void
  /** The choice that means "no filter"; any other value shows the chip as on. */
  neutral: K
  'aria-label': string
  className?: string
}

/** A filter that picks one of many, drawn as a chip so it can sit in a row of chips. */
export function ChipSelect<K extends string>({ options, value, onChange, neutral, className, ...aria }: ChipSelectProps<K>) {
  const on = value !== neutral
  return (
    <AriaSelect
      aria-label={aria['aria-label']}
      selectedKey={value}
      onSelectionChange={(key: Key | null) => key != null && onChange(String(key) as K)}
      className={cx('shrink-0', className)}
    >
      <AriaButton
        className={cx(
          'relative inline-flex h-8 max-w-[16rem] items-center gap-1 rounded-full pr-2.5 pl-3 text-[0.84375rem] font-medium whitespace-nowrap outline-none',
          'pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-1.5',
          'transition-[background-color,color,box-shadow] duration-150 data-focus-visible:ring-2 data-focus-visible:ring-focus',
          on
            ? 'bg-sky-felt text-sky-ink shadow-[inset_0_0_0_1.5px_var(--accent-ink)]'
            : 'text-ink shadow-[inset_0_0_0_1.5px_var(--line)] data-hovered:shadow-[inset_0_0_0_1.5px_var(--line-strong)]'
        )}
      >
        <SelectValue className="min-w-0 truncate">{selectedOnly}</SelectValue>
        <CaretDownIcon aria-hidden weight="bold" className="size-3.5 shrink-0 opacity-70" />
      </AriaButton>
      <Popover offset={6} placement="bottom start" className={cx(popoverClass, 'max-h-80')}>
        <ListBox items={options} className="outline-none">
          {(item) => (
            <ListBoxItem id={item.id} textValue={item.label} className={listItemClass}>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.badge !== undefined && <span className="text-[0.8125rem] text-ink-3 tabular">{item.badge}</span>}
              <CheckIcon aria-hidden weight="bold" className="size-4 text-accent opacity-0 group-data-selected:opacity-100" />
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </AriaSelect>
  )
}

export function Checkbox({ children, className, ...props }: Omit<CheckboxProps, 'children' | 'className'> & { children: ReactNode; className?: string }) {
  return (
    <AriaCheckbox {...props} className={cx('group flex items-start gap-2.5 text-sm text-ink outline-none', className)}>
      <span
        aria-hidden
        className={cx(
          'mt-px grid size-[1.125rem] shrink-0 place-items-center rounded-[0.3125rem] border-[1.5px] border-mute bg-raised transition-colors duration-150',
          // A pointer over it darkens the edge, or the fill once ticked
          'group-data-hovered:border-ink-3 group-data-selected:border-fill group-data-selected:bg-fill',
          'group-data-selected:group-data-hovered:border-[color-mix(in_oklab,var(--fill)_86%,black)] group-data-selected:group-data-hovered:bg-[color-mix(in_oklab,var(--fill)_86%,black)]',
          'group-data-focus-visible:ring-2 group-data-focus-visible:ring-focus'
        )}
      >
        <CheckIcon weight="bold" className="size-3 text-on-accent opacity-0 group-data-selected:opacity-100" />
      </span>
      <span className="min-w-0">{children}</span>
    </AriaCheckbox>
  )
}

export function Switch({ children, className, ...props }: Omit<SwitchProps, 'children' | 'className'> & { children: ReactNode; className?: string }) {
  return (
    <AriaSwitch {...props} className={cx('group flex items-center gap-3 text-sm text-ink outline-none', className)}>
      <span className="min-w-0 flex-1">{children}</span>
      <span
        aria-hidden
        className={cx(
          'flex h-6 w-10 shrink-0 items-center rounded-full bg-mute p-0.5 transition-colors duration-150',
          // A pointer over it darkens the track a step, on or off
          'group-data-hovered:bg-[color-mix(in_oklab,var(--mute)_86%,var(--ink))] group-data-selected:bg-fill group-data-selected:group-data-hovered:bg-[color-mix(in_oklab,var(--fill)_86%,black)]',
          'group-data-focus-visible:ring-2 group-data-focus-visible:ring-focus'
        )}
      >
        <span className="size-5 rounded-full bg-white shadow-lift transition-transform duration-200 ease-out-expo group-data-selected:translate-x-4" />
      </span>
    </AriaSwitch>
  )
}
