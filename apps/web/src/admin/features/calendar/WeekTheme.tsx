import { useState } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { PencilSimpleIcon, PlusIcon } from '@phosphor-icons/react'
import { saveThemes } from '@hellokido/core/api'
import { useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useToast } from '../../providers/Toasts'
import { Button } from '../../ui/Button'
import { TextField } from '../../ui/Field'
import { cx } from '../../ui/cx'
import { weekKey } from './model'

const MAX_LENGTH = 80

/**
 * The theme of one week, edited where it is shown. Enter saves, Esc puts the old text back; an
 * emptied theme is removed. Themes stand apart from lessons: copying a week never copies them.
 */
export function WeekTheme({
  week,
  theme,
  variant = 'line',
  isLoading,
  className
}: {
  /** Any day of the week. */
  week: Date
  theme: string | undefined
  variant?: 'line' | 'cell'
  isLoading?: boolean
  className?: string
}) {
  const { t, fmt, date } = useI18n()
  const toast = useToast()
  const refresh = useRefresh()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const key = weekKey(week)
  const current = theme?.trim() ?? ''

  const open = () => {
    setDraft(current)
    setEditing(true)
  }

  const save = async () => {
    const next = draft.trim()
    if (next === current) return setEditing(false)
    setSaving(true)
    try {
      await saveThemes(next ? [{ week_start: key, theme: next }] : [], next ? [] : [key])
      await refresh.themes()
      toast({ title: next ? t.calendar.theme.saved : t.calendar.theme.removed })
      setEditing(false)
    } catch {
      toast({ tone: 'error', title: t.calendar.theme.saveFailed })
    } finally {
      setSaving(false)
    }
  }

  const label = fmt(t.calendar.theme.editWeek, { date: date(new Date(`${key}T00:00:00`), { day: 'numeric', month: 'long' }) })

  if (editing) {
    return (
      <div className={cx('flex flex-col gap-2', variant === 'line' && 'w-full max-w-xl pt-2', className)}>
        <TextField
          aria-label={label}
          value={draft}
          onChange={setDraft}
          placeholder={t.calendar.theme.placeholder}
          maxLength={MAX_LENGTH}
          autoFocus
          autoComplete="off"
          isDisabled={saving}
          description={variant === 'line' ? t.calendar.theme.hint : undefined}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void save()
            if (event.key === 'Escape') setEditing(false)
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onPress={() => void save()} isPending={saving}>
            {t.common.save}
          </Button>
          <Button size="sm" variant="ghost" onPress={() => setEditing(false)} isDisabled={saving}>
            {t.common.cancel}
          </Button>
        </div>
      </div>
    )
  }

  if (variant === 'cell') {
    return (
      <AriaButton
        aria-label={current ? `${label}: ${current}` : label}
        onPress={open}
        isDisabled={isLoading}
        className={cx(
          'group flex w-full items-start gap-1.5 rounded-[0.625rem] px-2 py-1.5 text-left text-[0.8125rem] leading-snug outline-none',
          'transition-colors duration-150 data-hovered:bg-hover data-focus-visible:ring-2 data-focus-visible:ring-focus',
          className
        )}
      >
        {isLoading ? (
          <span aria-hidden className="h-3 w-16 animate-shimmer rounded-full bg-track" />
        ) : current ? (
          <span className="line-clamp-4 font-medium text-ink">{current}</span>
        ) : (
          <span className="flex items-center gap-1 text-ink-3 group-data-hovered:text-accent-ink">
            <PlusIcon aria-hidden weight="bold" className="size-3" />
            {t.calendar.theme.add}
          </span>
        )}
      </AriaButton>
    )
  }

  // The line under the page title: "Haftanın konusu: …" and a quiet way to change it
  return (
    <div className={cx('flex min-h-8 min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-[0.96875rem] leading-[1.375rem] text-ink-2', className)}>
      <span>{t.calendar.theme.label}:</span>
      {isLoading ? (
        <span aria-hidden className="h-3.5 w-28 animate-shimmer rounded-full bg-track" />
      ) : (
        <span className={cx('min-w-0', current ? 'font-medium text-ink' : 'text-ink-3')}>{current || t.calendar.theme.none}</span>
      )}
      <Button
        size="sm"
        variant="ghost"
        onPress={open}
        isDisabled={isLoading}
        className="-ml-1 px-2.5"
        icon={current ? <PencilSimpleIcon aria-hidden className="size-3.5" /> : <PlusIcon aria-hidden weight="bold" className="size-3.5" />}
      >
        {current ? t.calendar.theme.edit : t.calendar.theme.add}
      </Button>
    </div>
  )
}
