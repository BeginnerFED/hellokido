import { useMemo, useState } from 'react'
import type { Registration } from '@hellokido/core/api'
import { useRegistrations } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { LoadError, Skeleton } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { Checkbox } from '../../ui/Choice'
import { SearchField } from '../../ui/Field'
import { byName, matchesChild } from '../children/rules'

/**
 * Active children to tick for a lesson. Those already chosen when the list opened stay on top, and
 * the order does not jump around while ticking. Archived children are never offered.
 */
export function ChildPicker({
  selected,
  onToggle,
  onDone
}: {
  selected: Set<string>
  onToggle: (child: Registration, on: boolean) => void
  onDone: () => void
}) {
  const { t, plural } = useI18n()
  const registrations = useRegistrations()
  const [query, setQuery] = useState('')
  const [pinned] = useState(() => new Set(selected))

  const list = useMemo(() => {
    const active = (registrations.data ?? []).filter((row) => row.is_active === true)
    const top = active.filter((row) => pinned.has(row.id)).sort(byName)
    const rest = active.filter((row) => !pinned.has(row.id)).sort(byName)
    return [...top, ...rest].filter((row) => matchesChild(row, query))
  }, [registrations.data, pinned, query])

  return (
    <div className="on-felt flex flex-col gap-3 rounded-[1.25rem] bg-felt p-3">
      <SearchField value={query} onChange={setQuery} placeholder={t.calendar.lesson.pickerSearch} label={t.calendar.lesson.chooseChildren} autoFocus />
      {registrations.isError ? (
        <LoadError message={t.calendar.lesson.pickerFailed} retryLabel={t.common.retry} onRetry={() => void registrations.refetch()} />
      ) : !registrations.data ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-10" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <p className="py-4 text-center text-sm text-ink-3">{t.calendar.lesson.pickerEmpty}</p>
      ) : (
        <ul aria-label={t.calendar.lesson.chooseChildren} className="relative -mx-1 max-h-72 overflow-y-auto overscroll-contain">
          {list.map((child) => (
            <li key={child.id}>
              <Checkbox
                isSelected={selected.has(child.id)}
                onChange={(on) => onToggle(child, on)}
                className="rounded-[0.875rem] px-2 py-2 transition-colors duration-150 data-hovered:bg-hover"
              >
                <span className="block text-[0.9375rem] font-medium text-ink">{child.student_name}</span>
                <span className="block text-[0.8125rem] text-ink-3">
                  {[child.student_age, child.parent_name].filter(Boolean).join(' · ')}
                </span>
              </Checkbox>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-3 border-t border-line pt-3">
        <span className="min-w-0 flex-1 text-[0.84375rem] text-ink-2">{plural(t.calendar.lesson.selected, selected.size)}</span>
        <Button size="sm" variant="secondary" onPress={onDone}>
          {t.calendar.lesson.pickerDone}
        </Button>
      </div>
    </div>
  )
}
