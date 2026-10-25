import { useMemo, useState } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarBlankIcon } from '@phosphor-icons/react'
import { LessonError, setAttendance, type AttendanceStatus, type Lesson, type Seat } from '@hellokido/core/api'
import { keys, useUsageOf } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useToast } from '../../providers/Toasts'
import { ButtonLink, textLinkClass } from '../../ui/Button'
import { Page } from '../../ui/Page'
import { DayRibbon, HeroCard } from './board'
import { useWaiting } from './data'
import { TomorrowCard, WaitingCard, type WorkTab } from './sections'

/**
 * The working day as a felt board: the day's lessons on a time strip, the lesson of the moment
 * with attendance in one tap, everything waiting for the admin in one card, and tomorrow's reminders.
 */
export default function TodayPage() {
  const i18n = useI18n()
  const { t, plural, fmt, date } = i18n
  const toast = useToast()
  const client = useQueryClient()
  const waiting = useWaiting()
  const { now, day } = waiting
  const { key, query: lessons, todays, tomorrows } = day

  const usage = useUsageOf(useMemo(() => todays.flatMap((lesson) => lesson.seats.map((seat) => seat.child)), [todays]))
  const [saving, setSaving] = useState<Set<string>>(() => new Set())
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [workTab, setWorkTab] = useState<WorkTab>('all')

  const chosen = chosenId ? todays.find((lesson) => lesson.id === chosenId) : undefined
  const hero = chosen ?? waiting.hero

  const patch = (seatId: string, status: AttendanceStatus) =>
    client.setQueryData<Lesson[]>(key, (list) =>
      list?.map((lesson) => ({ ...lesson, seats: lesson.seats.map((seat) => (seat.id === seatId ? { ...seat, status } : seat)) }))
    )

  // Optimistic: the answer shows at once and goes back if it could not be saved
  const mark = async (seat: Seat, status: AttendanceStatus) => {
    if (seat.status === status || saving.has(seat.id)) return
    const before = seat.status
    setSaving((set) => new Set(set).add(seat.id))
    await client.cancelQueries({ queryKey: key })
    patch(seat.id, status)
    try {
      await setAttendance(seat.id, status)
    } catch (error) {
      patch(seat.id, before)
      // The child was taken out of the lesson meanwhile: show the lesson as it is now
      if (error instanceof LessonError && error.code === 'not_found') {
        toast({ tone: 'info', title: t.today.lessonGone })
        void lessons.refetch()
      } else {
        toast({ tone: 'error', title: t.children.detail.statusFailed })
      }
    } finally {
      setSaving((set) => {
        const next = new Set(set)
        next.delete(seat.id)
        return next
      })
    }
    void client.invalidateQueries({ queryKey: ['usage'] })
    void client.invalidateQueries({ queryKey: keys.childLessons(seat.registration_id) })
    // Other lesson views read again when they open; this list already shows the answer
    void client.invalidateQueries({ queryKey: ['lessons'], refetchType: 'none' })
  }

  const jumpToWork = () => {
    setWorkTab('all')
    const card = document.getElementById('work')
    if (!card) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    card.tabIndex = -1
    card.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' })
    card.focus({ preventScroll: true })
  }

  const childCount = new Set(todays.flatMap((lesson) => lesson.seats.map((seat) => seat.registration_id))).size
  const weekday = date(now, { weekday: 'long' })
  const title = `${weekday.charAt(0).toLocaleUpperCase(i18n.tag)}${weekday.slice(1)}, ${date(now, { day: 'numeric', month: 'long' })}`
  const dayLine = !lessons.data
    ? null
    : todays.length === 0
      ? t.today.noLessons
      : fmt(waiting.phase === 'done' ? t.today.board.summaryPast : t.today.board.summary, {
          lessons: plural(t.today.lessonCount, todays.length),
          children: plural(t.today.childCount, childCount)
        })

  const summary = (
    <>
      {dayLine && `${dayLine}. `}
      {waiting.ready && waiting.total > 0 && (
        <AriaButton onPress={jumpToWork} className={textLinkClass('action')}>
          {plural(t.today.waiting, waiting.total)}.
        </AriaButton>
      )}
    </>
  )

  return (
    <Page
      title={title}
      crumb={t.today.title}
      summary={summary}
      width="wide"
      toolbar={
        <ButtonLink href="/calendar" variant="quiet" icon={<CalendarBlankIcon aria-hidden className="size-[1.125rem]" />}>
          {t.today.openCalendar}
        </ButtonLink>
      }
    >
      <div className="flex flex-col gap-[1.125rem]">
        <DayRibbon lessons={todays} now={now} heroId={hero?.id} onSelect={setChosenId} isPending={lessons.isPending} />
        {/* Phones read it in order: the lesson, what waits, then tomorrow */}
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <HeroCard
              lesson={hero}
              now={now}
              usage={usage}
              saving={saving}
              onMark={(seat, status) => void mark(seat, status)}
              isPending={lessons.isPending}
              isError={lessons.isError}
              onRetry={() => void lessons.refetch()}
            />
          </div>
          <WaitingCard
            waiting={waiting}
            tab={workTab}
            onTab={setWorkTab}
            saving={saving}
            onMarkToday={(seat, status) => void mark(seat, status)}
            className="lg:col-start-2 lg:row-span-2 lg:row-start-1"
          />
          <TomorrowCard
            lessons={tomorrows}
            isPending={lessons.isPending}
            isError={lessons.isError}
            onRetry={() => void lessons.refetch()}
            now={now}
            className="min-w-0 lg:col-start-1 lg:row-start-2"
          />
        </div>
      </div>
    </Page>
  )
}
