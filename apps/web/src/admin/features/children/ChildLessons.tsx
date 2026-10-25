import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { setAttendance, type AttendanceStatus, type ChildLesson, type Registration } from '@hellokido/core/api'
import { isAttendanceOverdue } from '@hellokido/core/rules/attendance.js'
import { keys, useChildLessons, useLabels } from '../../data/queries'
import { useI18n, type I18n } from '../../providers/I18n'
import { useToast } from '../../providers/Toasts'
import { LoadError, Skeleton } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { Section } from '../../ui/Page'
import { LessonShape } from '../../ui/signature'
import { cx } from '../../ui/cx'
import { StatusMenu } from '../lessons/StatusMenu'
import { isFree } from './rules'

/** The statuses a lesson can be given from here; "scheduled" is never chosen by hand. */
const STATUSES: AttendanceStatus[] = ['attended', 'no_show', 'postponed', 'makeup']
const STEP = 10
const FIRST_UPCOMING = 3

function lessonWhen(i18n: Pick<I18n, 'date'>, value: string) {
  const day = new Date(value)
  const thisYear = day.getFullYear() === new Date().getFullYear()
  const date = i18n.date(day, thisYear ? { weekday: 'short', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' })
  return `${date}, ${i18n.date(day, { hour: '2-digit', minute: '2-digit' })}`
}

/**
 * Every lesson of the child across all periods: what comes next first, then the past, newest
 * first, with a rule where the current package begins. Attendance can be corrected on any of them.
 */
export function ChildLessons({ registration, level, className }: { registration: Registration; level: 2 | 3; className?: string }) {
  const i18n = useI18n()
  const Subheading = level === 3 ? 'h4' : 'h3'
  const { t, fmt, plural } = i18n
  const labels = useLabels()
  const toast = useToast()
  const client = useQueryClient()
  const lessons = useChildLessons(registration.id)
  const [saving, setSaving] = useState<Set<string>>(() => new Set())
  const [shownUpcoming, setShownUpcoming] = useState(FIRST_UPCOMING)
  const [shownPast, setShownPast] = useState(STEP)

  const { upcoming, past } = useMemo(() => {
    const now = Date.now()
    const rows = lessons.data ?? []
    return {
      upcoming: rows.filter((row) => new Date(row.events!.event_date).getTime() >= now).reverse(),
      past: rows.filter((row) => new Date(row.events!.event_date).getTime() < now)
    }
  }, [lessons.data])

  const key = keys.childLessons(registration.id)
  const patch = (id: string, status: string) =>
    client.setQueryData<ChildLesson[]>(key, (rows) => rows?.map((row) => (row.id === id ? { ...row, status } : row)))

  const change = async (lesson: ChildLesson, status: AttendanceStatus) => {
    if (lesson.status === status || saving.has(lesson.id)) return
    const before = lesson.status
    setSaving((set) => new Set(set).add(lesson.id))
    await client.cancelQueries({ queryKey: key })
    patch(lesson.id, status)
    try {
      await setAttendance(lesson.id, status)
    } catch {
      patch(lesson.id, before)
      toast({ tone: 'error', title: t.children.detail.statusFailed })
    } finally {
      setSaving((set) => {
        const next = new Set(set)
        next.delete(lesson.id)
        return next
      })
    }
    // The child's numbers and every lesson view follow; this list already shows the new status
    void client.invalidateQueries({ queryKey: ['usage'] })
    void client.invalidateQueries({ queryKey: ['lessons'] })
  }

  const total = lessons.data?.length ?? 0
  // The past of the current package, then (under a rule) lessons of earlier packages
  const startsAt = isFree(registration) ? null : new Date(registration.package_start_date).getTime()
  const shownPastRows = past.slice(0, shownPast)
  const split = startsAt === null ? -1 : shownPastRows.findIndex((row) => new Date(row.events!.event_date).getTime() < startsAt)
  const currentRows = split === -1 ? shownPastRows : shownPastRows.slice(0, split)
  const earlierRows = split === -1 ? [] : shownPastRows.slice(split)

  const row = (lesson: ChildLesson) => {
    const event = lesson.events!
    const overdue = isAttendanceOverdue(lesson.status, event.event_date)
    const title = event.event_type === 'ozel' && event.custom_description ? event.custom_description : labels.lessonType(event.event_type)
    const when = lessonWhen(i18n, event.event_date)
    const notes = [
      lesson.cancellation_reason && fmt(t.children.detail.cancelReason, { text: lesson.cancellation_reason }),
      lesson.makeup_notes && fmt(t.children.detail.makeupNote, { text: lesson.makeup_notes }),
      lesson.postponed_notes && fmt(t.children.detail.postponedNote, { text: lesson.postponed_notes })
    ].filter(Boolean)
    return (
      <li key={lesson.id} className="flex items-start gap-3 py-2.5">
        <LessonShape type={event.event_type} className="mt-[0.3125rem]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">
            {title}
            <span className="font-normal text-ink-3"> · {labels.ageGroup(event.age_group)}</span>
          </p>
          <p className="text-[0.8125rem] text-ink-2 tabular">
            {when}
            {lesson.is_makeup && <span className="text-pink-ink"> · {t.children.detail.makeup}</span>}
          </p>
          {notes.map((note) => (
            <p key={note as string} className="mt-0.5 text-[0.8125rem] text-ink-3 text-pretty">
              {note}
            </p>
          ))}
        </div>
        <StatusMenu
          status={lesson.status}
          options={STATUSES}
          onChange={(status) => void change(lesson, status)}
          label={fmt(t.children.detail.lessonStatus, { name: when })}
          overdue={overdue}
          overdueLabel={t.children.detail.notMarked}
          isDisabled={saving.has(lesson.id)}
        />
      </li>
    )
  }

  const more = (rest: number, onPress: () => void) =>
    rest > 0 && (
      <Button variant="ghost" size="sm" className="mt-1 -ml-3" onPress={onPress}>
        {plural(t.children.detail.showMore, Math.min(STEP, rest))}
      </Button>
    )

  return (
    <Section level={level} title={t.children.detail.lessonsTitle} aside={total > 0 ? plural(t.children.form.lessons, total) : undefined} className={className}>
      {lessons.isPending ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((item) => (
            <Skeleton key={item} className="h-12" />
          ))}
        </div>
      ) : lessons.isError ? (
        <LoadError message={t.children.detail.lessonsFailed} retryLabel={t.common.retry} onRetry={() => void lessons.refetch()} />
      ) : total === 0 ? (
        <p className="text-sm text-ink-2">{t.children.detail.lessonsEmpty}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {upcoming.length > 0 && (
            <div>
              <Subheading className="text-[0.8125rem] font-medium text-ink-3">{t.children.detail.upcoming}</Subheading>
              <ul className="divide-y divide-line">{upcoming.slice(0, shownUpcoming).map(row)}</ul>
              {more(upcoming.length - shownUpcoming, () => setShownUpcoming((count) => count + STEP))}
            </div>
          )}
          {past.length > 0 && (
            <div>
              {upcoming.length > 0 && <Subheading className="text-[0.8125rem] font-medium text-ink-3">{t.children.detail.past}</Subheading>}
              {currentRows.length > 0 && <ul className="divide-y divide-line">{currentRows.map(row)}</ul>}
              {earlierRows.length > 0 && (
                <>
                  <Subheading className={cx('flex items-center gap-3 pb-0.5 text-[0.75rem] font-medium text-ink-3', currentRows.length > 0 && 'pt-3')}>
                    {t.children.detail.earlierPackages}
                    <span aria-hidden className="h-px flex-1 bg-line" />
                  </Subheading>
                  <ul className="divide-y divide-line">{earlierRows.map(row)}</ul>
                </>
              )}
              {more(past.length - shownPast, () => setShownPast((count) => count + STEP))}
            </div>
          )}
        </div>
      )}
    </Section>
  )
}
