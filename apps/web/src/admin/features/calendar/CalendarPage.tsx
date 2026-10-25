import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { addDays, addMonths, isSameDay, isSameMonth, isSameWeek, isValid, parse, startOfDay } from 'date-fns'
import { ArrowSquareOutIcon, CaretLeftIcon, CaretRightIcon, CopyIcon, DotsThreeIcon } from '@phosphor-icons/react'
import { lessonsBetween, LessonError, moveLesson, themesBetween, type Lesson } from '@hellokido/core/api'
import { keys, useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useToast } from '../../providers/Toasts'
import { useActions } from '../../shell/Actions'
import { LoadError, Skeleton } from '../../ui/Bits'
import { Button, IconButton } from '../../ui/Button'
import { Segmented } from '../../ui/Choice'
import { Menu, MenuItem } from '../../ui/Menu'
import { Notice } from '../../ui/Notice'
import { Page } from '../../ui/Page'
import { useWideLayout } from '../../ui/useMediaQuery'
import { cx } from '../../ui/cx'
import { useClock } from '../today/clock'
import { CopyWeekSheet } from './CopyWeekSheet'
import { DayAgenda, DayRail, WeekStrip } from './DayAgenda'
import { dateRange } from './labels'
import { MonthDots, MonthGrid } from './MonthGrid'
import { dayKey, daysOf, rangeOf, weekKey, weekStart, type CalendarView } from './model'
import { WeekBoard } from './WeekBoard'
import { WeekTheme } from './WeekTheme'

/**
 * Lessons by week, day or month. Wide screens plan on the week board; phones work a day at a time
 * under a strip of the week. The view and the date live in the address, so a reload or a link
 * comes back to the same place.
 */
export default function CalendarPage() {
  const i18n = useI18n()
  const { t, date } = i18n
  const toast = useToast()
  const refresh = useRefresh()
  const client = useQueryClient()
  const { startTask } = useActions()
  const { now, dayKey: todayKey } = useClock()
  const wide = useWideLayout()
  const [params, setParams] = useSearchParams()
  const [copy, setCopy] = useState({ open: false, key: 0 })

  // Phones have no week board: a week there is the strip above a day
  const asked = params.get('view')
  const view: CalendarView = asked === 'month' ? 'month' : asked === 'day' || !wide ? 'day' : 'week'
  const dateParam = params.get('date')
  const anchor = useMemo(() => {
    const parsed = dateParam ? parse(dateParam, 'yyyy-MM-dd', new Date()) : null
    return parsed && isValid(parsed) ? parsed : new Date(`${todayKey}T00:00:00`)
  }, [dateParam, todayKey])

  const go = (next: { view?: CalendarView; date?: Date }) =>
    setParams(
      (current) => {
        const search = new URLSearchParams(current)
        if (next.view) search.set('view', next.view)
        if (next.date) search.set('date', dayKey(next.date))
        return search
      },
      { replace: true }
    )

  const range = useMemo(() => rangeOf(view === 'month' ? 'month' : 'week', anchor), [view, anchor])
  const lessonsKey = keys.lessons(range.start.toISOString(), range.end.toISOString())
  const lessons = useQuery({ queryKey: lessonsKey, queryFn: () => lessonsBetween(range.start, range.end), placeholderData: keepPreviousData })
  const themeFrom = weekKey(range.start)
  const themeTo = weekKey(addDays(range.end, -1))
  const themes = useQuery({ queryKey: keys.themes(themeFrom, themeTo), queryFn: () => themesBetween(themeFrom, themeTo), placeholderData: keepPreviousData })
  const themesLoading = themes.isPending || themes.isPlaceholderData
  const list = lessons.isPlaceholderData ? [] : (lessons.data ?? [])
  const waiting = lessons.isPending || lessons.isPlaceholderData

  const open = (lesson: Lesson) => startTask('lesson', { lessonId: lesson.id })
  const createAt = (start: Date) => startTask('lesson', { start: start.toISOString(), withTime: true })
  const createOn = (day: Date) => startTask('lesson', { start: startOfDay(day).toISOString(), withTime: false })

  const moveFailed = (error: unknown) =>
    toast({
      tone: 'error',
      title:
        error instanceof LessonError && error.code === 'minute_taken'
          ? t.calendar.minuteTaken
          : error instanceof LessonError && error.code === 'not_found'
            ? t.calendar.lesson.notFound
            : t.calendar.moveFailed
    })

  // The lesson moves on the board at once; it goes back if the move cannot be saved
  const move = async (lesson: Lesson, start: Date) => {
    const from = new Date(lesson.event_date)
    const place = (at: Date) =>
      client.setQueryData<Lesson[]>(lessonsKey, (rows) => rows?.map((row) => (row.id === lesson.id ? { ...row, event_date: at.toISOString() } : row)))
    await client.cancelQueries({ queryKey: lessonsKey })
    place(start)
    try {
      await moveLesson(lesson.id, start)
      toast({
        title: t.calendar.moved,
        body: date(start, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }),
        action: { label: t.common.undo, onAction: () => void moveBack(lesson.id, from) }
      })
    } catch (error) {
      place(from)
      moveFailed(error)
    } finally {
      refresh.lessons()
    }
  }

  const moveBack = async (id: string, from: Date) => {
    try {
      await moveLesson(id, from)
    } catch (error) {
      moveFailed(error)
    } finally {
      refresh.lessons()
    }
  }

  // Phones step a week at a time, as the strip does; the wide day view steps a day
  const step = (direction: 1 | -1) => {
    if (view === 'month') return go({ date: addMonths(anchor, direction) })
    go({ date: addDays(anchor, view === 'day' && wide ? direction : direction * 7) })
  }
  const stepLabels =
    view === 'month'
      ? [t.calendar.previousMonth, t.calendar.nextMonth]
      : view === 'day' && wide
        ? [t.calendar.previousDay, t.calendar.nextDay]
        : [t.calendar.previousWeek, t.calendar.nextWeek]
  const showsToday =
    view === 'month' ? isSameMonth(anchor, now) : view === 'day' ? isSameDay(anchor, now) : isSameWeek(anchor, now, { weekStartsOn: 1 })

  const monday = weekStart(anchor)
  // The page is titled by what it shows; phones, which work a day at a time, name the month
  // Long month names, unless that runs past the toolbar (a Ukrainian or English range across two months)
  const titled = (month: 'long' | 'short') =>
    view === 'day'
      ? date(anchor, { weekday: 'long', day: 'numeric', month, year: 'numeric' })
      : dateRange(i18n, monday, addDays(monday, 6), { day: 'numeric', month, year: 'numeric' })
  const shown = view === 'month' || !wide ? date(anchor, { month: 'long', year: 'numeric' }) : titled('long').length > 24 ? titled('short') : titled('long')
  const heading = `${shown.charAt(0).toLocaleUpperCase(i18n.tag)}${shown.slice(1)}`

  // The week being copied is the one on screen; from the month view the week is shown first
  const openCopy = () => {
    if (view === 'month') go({ view: wide ? 'week' : 'day' })
    setCopy((state) => ({ open: true, key: state.key + 1 }))
  }

  const viewOptions = (wide ? (['week', 'day', 'month'] as const) : (['day', 'month'] as const)).map((id) => ({ id, label: t.calendar.views[id] }))

  const toolbar = (
    <>
      <div className="flex items-center gap-1">
        <IconButton label={stepLabels[0]} variant="quiet" onPress={() => step(-1)}>
          <CaretLeftIcon aria-hidden weight="bold" className="size-4" />
        </IconButton>
        <Button variant="quiet" onPress={() => go({ date: new Date(`${todayKey}T00:00:00`) })} isDisabled={showsToday}>
          {t.common.today}
        </Button>
        <IconButton label={stepLabels[1]} variant="quiet" onPress={() => step(1)}>
          <CaretRightIcon aria-hidden weight="bold" className="size-4" />
        </IconButton>
      </div>
      <Segmented<CalendarView> aria-label={t.calendar.view} options={viewOptions} value={view} onChange={(next) => go({ view: next })} fit />
      <Menu
        label={t.calendar.more}
        trigger={
          <IconButton label={t.calendar.more} variant="quiet" className="max-lg:ml-auto">
            <DotsThreeIcon aria-hidden weight="bold" className="size-5" />
          </IconButton>
        }
      >
        <MenuItem icon={<CopyIcon className="size-[1.125rem]" />} onAction={openCopy}>
          {t.calendar.copyWeek}
        </MenuItem>
        <MenuItem icon={<ArrowSquareOutIcon className="size-[1.125rem]" />} href="/takvim" target="_blank" rel="noopener">
          {t.calendar.publicCalendar}
        </MenuItem>
      </Menu>
    </>
  )

  return (
    <Page
      title={<span aria-live="polite">{heading}</span>}
      crumb={t.calendar.title}
      toolbar={toolbar}
      // Looking at another week or day, a new lesson starts there rather than back on today
      action={{ label: t.calendar.newLesson, onPress: () => (showsToday ? startTask('lesson') : createOn(anchor)) }}
      width="wide"
    >
      {/* The week's theme reads as the line under the title */}
      {view !== 'month' && (
        <WeekTheme week={anchor} theme={themes.data?.[weekKey(anchor)]} isLoading={themesLoading} className="mb-4 lg:-mt-3.5 lg:mb-5" />
      )}

      {lessons.isError ? (
        <LoadError message={t.calendar.loadFailed} retryLabel={t.common.retry} onRetry={() => void lessons.refetch()} />
      ) : lessons.isPending ? (
        <Skeleton className={cx('rounded-panel', view === 'day' ? 'h-72' : 'h-[36rem]')} />
      ) : (
        <div aria-busy={waiting} className={cx('transition-opacity duration-200', waiting && 'opacity-60')}>
          {view === 'week' && (
            <div className="flex flex-col gap-3">
              {!waiting && list.length === 0 && (
                <Notice>
                  <span className="font-medium">{t.calendar.noLessonsWeek}</span> {t.calendar.noLessonsWeekBody}
                </Notice>
              )}
              <WeekBoard
                start={monday}
                lessons={list}
                now={now}
                onOpen={open}
                onCreate={createAt}
                onMove={(lesson, start) => void move(lesson, start)}
                onOpenDay={(day) => go({ view: 'day', date: day })}
              />
            </div>
          )}
          {view === 'day' && (
            // Wide screens fill the space beside the day with a month to jump from and the day in numbers
            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_19.5rem]">
              <div className="flex min-w-0 flex-col gap-5">
                <WeekStrip days={daysOf(monday)} selected={anchor} lessons={list} now={now} onSelect={(day) => go({ date: day })} />
                <DayAgenda day={anchor} lessons={list} now={now} isPending={waiting} onOpen={open} onCreate={createOn} />
              </div>
              {wide && (
                <div className="max-xl:hidden">
                  <DayRail day={anchor} lessons={list} now={now} isPending={waiting} onSelect={(day) => go({ date: day })} />
                </div>
              )}
            </div>
          )}
          {view === 'month' &&
            (wide ? (
              <MonthGrid
                anchor={anchor}
                lessons={list}
                themes={themes.data}
                themesLoading={themesLoading}
                now={now}
                onOpenDay={(day) => go({ view: 'day', date: day })}
                onOpen={open}
                onCreateDay={createOn}
              />
            ) : (
              <MonthDots anchor={anchor} lessons={list} themes={themes.data} themesLoading={themesLoading} now={now} onOpenDay={(day) => go({ view: 'day', date: day })} />
            ))}
        </div>
      )}

      <CopyWeekSheet
        key={copy.key}
        isOpen={copy.open}
        onOpenChange={(next) => setCopy((state) => ({ ...state, open: next }))}
        source={monday}
        onGoToWeek={(target) => go({ view: wide ? 'week' : 'day', date: target })}
      />
    </Page>
  )
}
