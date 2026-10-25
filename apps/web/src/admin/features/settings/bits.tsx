import { useRef, type ReactNode } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { CaretRightIcon } from '@phosphor-icons/react'
import { useI18n } from '../../providers/I18n'
import { TextField } from '../../ui/Field'
import { keepCaret } from '../../ui/caret'
import { cx } from '../../ui/cx'
import { capitalFirst, type Names } from './rules'

/** A part of the settings page as a card: what it is for in the header, its controls below the rule. */
export function SettingsSection({ id, title, body, children }: { id: string; title: string; body?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 overflow-hidden rounded-panel border border-line bg-surface">
      <div className="px-4 pt-[1.125rem] pb-3.5 sm:px-6">
        <h2 id={`${id}-title`} tabIndex={-1} className="text-[0.96875rem] leading-snug font-semibold tracking-[-0.01em] outline-none">
          {title}
        </h2>
        {body && <p className="mt-0.5 max-w-[62ch] text-[0.84375rem] text-ink-3 text-pretty">{body}</p>}
      </div>
      <div className="border-t border-line px-4 py-4 sm:px-6">{children}</div>
    </section>
  )
}

export function SettingList({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cx('-my-1.5 divide-y divide-line', className)}>{children}</ul>
}

type RowProps = {
  title: ReactNode
  onPress: () => void
  /** The tablet at the start of the row (a category's picture, a day of the month). */
  lead?: ReactNode
  /** A small mark after the title, such as "Hidden". */
  mark?: ReactNode
  meta?: ReactNode
  /** The value at the end of the row (a price, an amount). */
  trail?: ReactNode
  /** Hidden or paused rows step back. */
  muted?: boolean
}

/** A row that opens its own sheet; the whole row is the button. */
export function SettingRow({ title, onPress, lead, mark, meta, trail, muted }: RowProps) {
  return (
    <li>
      <AriaButton
        onPress={onPress}
        className={cx(
          'group -mx-3 flex w-[calc(100%+1.5rem)] items-center gap-3 rounded-control px-3 py-2.5 text-left outline-none',
          'transition-colors duration-150 data-hovered:bg-surface-2 data-pressed:bg-hover data-focus-visible:ring-2 data-focus-visible:ring-focus'
        )}
      >
        {lead}
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className={cx('min-w-0 truncate text-[0.9375rem] font-medium', muted ? 'text-ink-2' : 'text-ink')}>{title}</span>
            {mark}
          </span>
          {meta && <span className="block truncate text-[0.8125rem] text-ink-3">{meta}</span>}
        </span>
        {trail && <span className="shrink-0 text-sm tabular">{trail}</span>}
        <CaretRightIcon aria-hidden weight="bold" className="size-4 shrink-0 text-ink-3 transition-colors group-data-hovered:text-ink-2" />
      </AriaButton>
    </li>
  )
}

/** A name in the three languages: Turkish is required, the others fall back to it. */
export function NameFields({ value, onChange, errorMessage, autoFocus }: { value: Names; onChange: (next: Names) => void; errorMessage?: string; autoFocus?: boolean }) {
  const { t } = useI18n()
  const trRef = useRef<HTMLInputElement>(null)
  const enRef = useRef<HTMLInputElement>(null)
  const ukRef = useRef<HTMLInputElement>(null)
  const refs = { tr: trRef, en: enRef, uk: ukRef }

  const field = (lang: keyof Names, extra?: { errorMessage?: string; autoFocus?: boolean }) => (
    <TextField
      ref={refs[lang]}
      label={t.settings.names[lang]}
      value={value[lang]}
      onChange={(text) => keepCaret(refs[lang].current, text, (typed) => capitalFirst(typed, lang), (next) => onChange({ ...value, [lang]: next }))}
      autoComplete="off"
      {...extra}
    />
  )

  return (
    <div className="flex flex-col gap-4">
      {field('tr', { errorMessage, autoFocus })}
      <div className="flex flex-col gap-1.5">
        <div className="grid items-start gap-4 sm:grid-cols-2">
          {field('en')}
          {field('uk')}
        </div>
        <p className="text-[0.8125rem] text-ink-3">{t.settings.names.hint}</p>
      </div>
    </div>
  )
}
