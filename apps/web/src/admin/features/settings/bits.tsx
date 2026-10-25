import { useRef, useState, type ReactNode } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { CaretDownIcon, CaretRightIcon, PlusIcon } from '@phosphor-icons/react'
import { useI18n } from '../../providers/I18n'
import { Skeleton } from '../../ui/Bits'
import { TextField } from '../../ui/Field'
import { keepCaret } from '../../ui/caret'
import { cx } from '../../ui/cx'
import { capitalFirst, type Names } from './rules'

/** The card's side padding, for what is not a row (forms, notes, the add button). */
export const PAD = 'px-4 sm:px-[1.375rem]'

/**
 * A part of the settings page as a felt card: a 19/600 title and what it is for, then its rows or
 * its form on the felt itself. No rule under the header and no border.
 */
export function SettingsSection({ id, title, body, children }: { id: string; title: string; body?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="on-felt min-w-0 scroll-mt-24 overflow-hidden rounded-panel bg-felt text-ink">
      <div className={cx(PAD, 'pt-[1.125rem] pb-3')}>
        <h2 id={`${id}-title`} tabIndex={-1} className="rounded-[0.25rem] text-[1.1875rem] leading-[1.5625rem] font-semibold tracking-[-0.015em] outline-none">
          {title}
        </h2>
        {body && <p className="mt-1 max-w-[62ch] text-[0.84375rem] leading-[1.25rem] text-ink-3 text-pretty">{body}</p>}
      </div>
      {children}
    </section>
  )
}

/** The padded part of a settings card that holds a form or a line of text. */
export function SettingBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(PAD, 'pt-1 pb-5', className)}>{children}</div>
}

/** Rows of a settings card, edge to edge on the felt with a line between them. */
export function SettingList({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cx('pb-2', className)}>{children}</ul>
}

/** Loading rows inside a settings card. */
export function SettingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden className={cx(PAD, 'flex flex-col gap-2 pt-1 pb-5')}>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-12" />
      ))}
    </div>
  )
}

const rowClass = cx(
  'group flex w-full min-h-[3.5rem] items-center gap-3 py-2.5 text-left outline-none',
  PAD,
  'transition-colors duration-150 data-hovered:bg-hover data-pressed:bg-hover',
  'data-focus-visible:ring-2 data-focus-visible:ring-focus data-focus-visible:ring-inset'
)

type RowProps = {
  title: ReactNode
  onPress: () => void
  /** The piece at the start of the row (a category's picture, a day of the month). */
  lead?: ReactNode
  /** A small mark after the title, such as "Hidden". */
  mark?: ReactNode
  meta?: ReactNode
  /** The value at the end of the row (a price, an amount). */
  trail?: ReactNode
  /** Hidden or paused rows step back. */
  muted?: boolean
}

/** A quiet row that opens its own sheet; the whole row is the button. */
export function SettingRow({ title, onPress, lead, mark, meta, trail, muted }: RowProps) {
  return (
    <li className="border-t border-line first:border-t-0">
      <AriaButton onPress={onPress} className={rowClass}>
        {lead}
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className={cx('min-w-0 truncate text-[0.96875rem] leading-[1.3125rem] font-medium', muted ? 'text-ink-3' : 'text-ink')}>{title}</span>
            {mark}
          </span>
          {meta && <span className="block truncate text-[0.84375rem] leading-[1.125rem] text-ink-3">{meta}</span>}
        </span>
        {trail && <span className="shrink-0 text-[0.96875rem] tabular">{trail}</span>}
        <CaretRightIcon aria-hidden weight="bold" className="size-4 shrink-0 text-ink-3 transition-colors group-data-hovered:text-ink-2" />
      </AriaButton>
    </li>
  )
}

/** The last row of a list: add one more. */
export function SettingAddRow({ children, onPress }: { children: ReactNode; onPress: () => void }) {
  return (
    <li className="border-t border-line first:border-t-0">
      <AriaButton onPress={onPress} className={cx(rowClass, 'min-h-[3.25rem] text-[0.9375rem] font-medium text-accent-ink')}>
        <PlusIcon aria-hidden weight="bold" className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{children}</span>
      </AriaButton>
    </li>
  )
}

/** The round piece at the start of a row: a picture or a day. */
export function RowPiece({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return (
    <span
      aria-hidden
      className={cx('grid size-9 shrink-0 place-items-center rounded-full bg-piece text-[0.84375rem] font-semibold tabular', muted ? 'text-ink-3' : 'text-ink-2')}
    >
      {children}
    </span>
  )
}

/**
 * The name, in Turkish. English and Ukrainian names wait behind a closed row: empty, they show the
 * Turkish name, so most rows never need them.
 */
export function NameFields({ value, onChange, errorMessage, autoFocus }: { value: Names; onChange: (next: Names) => void; errorMessage?: string; autoFocus?: boolean }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const trRef = useRef<HTMLInputElement>(null)
  const enRef = useRef<HTMLInputElement>(null)
  const ukRef = useRef<HTMLInputElement>(null)
  const refs = { tr: trRef, en: enRef, uk: ukRef }

  const field = (lang: keyof Names, extra?: { errorMessage?: string; autoFocus?: boolean }) => (
    <TextField
      ref={refs[lang]}
      label={lang === 'tr' ? t.settings.names.name : t.settings.names[lang]}
      value={value[lang]}
      onChange={(text) => keepCaret(refs[lang].current, text, (typed) => capitalFirst(typed, lang), (next) => onChange({ ...value, [lang]: next }))}
      autoComplete="off"
      {...extra}
    />
  )

  return (
    <div className="flex flex-col gap-4">
      {field('tr', { errorMessage, autoFocus })}
      {open ? (
        <div className="flex flex-col gap-1.5">
          <div className="grid items-start gap-4 sm:grid-cols-2">
            {field('en')}
            {field('uk')}
          </div>
          <p className="text-[0.8125rem] text-ink-3">{t.settings.names.hint}</p>
        </div>
      ) : (
        <AriaButton
          onPress={() => {
            setOpen(true)
            requestAnimationFrame(() => enRef.current?.focus())
          }}
          className="relative -mt-1.5 inline-flex w-fit items-center gap-1.5 rounded-[0.25rem] text-sm font-medium text-accent-ink outline-none data-hovered:underline data-hovered:underline-offset-[3px] data-focus-visible:ring-2 data-focus-visible:ring-focus pointer-coarse:after:absolute pointer-coarse:after:-inset-x-1 pointer-coarse:after:-inset-y-3"
        >
          {t.settings.names.more}
          <CaretDownIcon aria-hidden weight="bold" className="size-3.5" />
        </AriaButton>
      )}
    </div>
  )
}
