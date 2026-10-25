import { useMemo, useState } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { addDays, addMonths, isSameMonth, isSameWeek } from 'date-fns'
import { lessonsBetween, themesBetween } from '@hellokido/core/api'
import { upperFirst } from '@hellokido/core/rules/text.js'
import { byDay, dayKey, daysOf, rangeOf, weekKey, weekStart } from '@hellokido/core/view'
import { keys } from '../../data/queries'
import { useClock } from '../../lib/clock'
import { headerButton, tasks, useOpenLesson } from '../../lib/navigation'
import { useI18n } from '../../providers/I18n'
import { useColors } from '../../theme/colors'
import { useActionMenu } from '../../ui/ActionMenu'
import { EmptyState, LoadError, Skeleton } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { Card, RoundButton, Screen, Section } from '../../ui/Screen'
import { Text } from '../../ui/Text'
import { dayTitle, DayTimeline, MonthDots, PeriodBar, TimelineSkeleton, useLessonActions, WeekStrip, WeekThemeRow, weekRange } from './parts'

type Mode = 'day' | 'month'

/**
 * A day at a time on an hour board under its week, as the phone's Calendar draws a day; the month
 * view shows which days have lessons and the theme of each week.
 */
export function CalendarScreen() {
  const c = useColors()
  const i18n = useI18n()
  const { t, plural, date } = i18n
  const client = useQueryClient()
  const openLesson = useOpenLesson()
  const menu = useActionMenu()
  const lessonActions = useLessonActions()
  const { now, dayKey: todayKey } = useClock()
  const still = useReducedMotion()
  const [mode, setMode] = useState<Mode>('day')
  const [selected, setSelected] = useState(() => new Date(`${todayKey}T00:00:00`))

  const range = useMemo(() => rangeOf(mode === 'month' ? 'month' : 'week', selected), [mode, selected])
  const lessons = useQuery({
    queryKey: keys.lessons(range.start.toISOString(), range.end.toISOString()),
    queryFn: () => lessonsBetween(range.start, range.end),
    placeholderData: keepPreviousData
  })
  const themeFrom = weekKey(range.start)
  const themeTo = weekKey(addDays(range.end, -1))
  const themes = useQuery({ queryKey: keys.themes(themeFrom, themeTo), queryFn: () => themesBetween(themeFrom, themeTo), placeholderData: keepPreviousData })
  // Another week's lessons never stand in for this one's while it loads
  const waiting = lessons.isPending || lessons.isPlaceholderData
  const list = useMemo(() => (lessons.isPlaceholderData ? [] : (lessons.data ?? [])), [lessons.data, lessons.isPlaceholderData])
  const themesShown = themes.isPlaceholderData ? undefined : themes.data

  const monday = weekStart(selected)
  const dayLessons = useMemo(() => byDay(list).get(dayKey(selected)) ?? [], [list, selected])
  const weeks = useMemo(() => {
    const mondays: Date[] = []
    for (let day = range.start; day < range.end; day = addDays(day, 7)) mondays.push(day)
    return mondays
  }, [range])
  // The month view reads whole weeks; only the month's own days count toward its total
  const shownCount = mode === 'month' ? list.filter((lesson) => isSameMonth(new Date(lesson.event_date), selected)).length : list.length

  const showsNow = mode === 'month' ? isSameMonth(selected, now) : isSameWeek(selected, now, { weekStartsOn: 1 })
  const step = (direction: 1 | -1) => setSelected((day) => (mode === 'month' ? addMonths(day, direction) : addDays(day, direction * 7)))
  const [previousLabel, nextLabel] = mode === 'month' ? [t.calendar.previousMonth, t.calendar.nextMonth] : [t.calendar.previousWeek, t.calendar.nextWeek]
  const heading = mode === 'month' ? upperFirst(date(selected, { month: 'long', year: 'numeric' })) : weekRange(i18n, monday)
  const theme = themesShown?.[weekKey(selected)]?.trim()

  const createOn = (day: Date) => tasks.lesson({ day: dayKey(day) })
  const refresh = () => Promise.all([lessons.refetch(), themes.refetch(), client.invalidateQueries({ queryKey: ['usage'] })])

  return (
    <>
      {menu.element}
      <Screen
        onRefresh={refresh}
        gap={0}
        title={t.calendar.title}
        // "+" in the iPhone's own bar, as on the other tabs; Android keeps the round button
        bar={{ options: headerButton(c, t.calendar.newLesson, 'add', () => createOn(selected)), buttons: 1 }}
        actions={Platform.OS !== 'ios' ? <RoundButton icon="add" label={t.calendar.newLesson} onPress={() => createOn(selected)} /> : undefined}
      >
        <PeriodBar
          label={heading}
          previousLabel={previousLabel}
          nextLabel={nextLabel}
          onPrevious={() => step(-1)}
          onNext={() => step(1)}
          expanded={mode === 'month'}
          onToggle={() => setMode(mode === 'month' ? 'day' : 'month')}
          toggleHint={mode === 'month' ? t.calendar.showWeek : t.calendar.showMonth}
          under={
            !showsNow ? (
              <Button variant="plain" size="sm" onPress={() => setSelected(new Date(`${todayKey}T00:00:00`))} style={styles.today}>
                {t.common.today}
              </Button>
            ) : (
              <Text variant="sub" tone="ink3" tabular numberOfLines={1}>
                {waiting ? ' ' : plural(t.calendar.lessonCount, shownCount)}
              </Text>
            )
          }
        />

        {mode === 'day' && (
          <View style={styles.week}>
            <WeekStrip days={daysOf(monday)} selected={selected} lessons={list} now={now} waiting={waiting} onSelect={setSelected} />
            <WeekThemeRow theme={theme} loading={themesShown === undefined} onPress={() => tasks.weekTheme(dayKey(monday))} />
          </View>
        )}

        {lessons.isError ? (
          <View style={styles.below}>
            <LoadError message={t.calendar.loadFailed} retryLabel={t.common.retry} onRetry={() => void lessons.refetch()} />
          </View>
        ) : mode === 'day' ? (
          <Section
            title={dayTitle(i18n, selected, now)}
            aside={!waiting && dayLessons.length > 0 ? plural(t.calendar.lessonCount, dayLessons.length) : undefined}
            style={styles.below}
          >
            {waiting ? (
              <TimelineSkeleton />
            ) : (
              // Another day's lessons settle in softly instead of jumping into place
              <Animated.View key={dayKey(selected)} entering={still ? undefined : FadeIn.duration(180)}>
                {dayLessons.length === 0 ? (
                  <Card padded>
                    <EmptyState
                      icon="calendar"
                      title={t.calendar.noLessonsDay}
                      action={
                        <Button icon="add" size="sm" onPress={() => createOn(selected)}>
                          {t.calendar.addLessonDay}
                        </Button>
                      }
                    />
                  </Card>
                ) : (
                  <DayTimeline day={selected} lessons={dayLessons} now={now} onOpen={(lesson) => openLesson(lesson.id)} actionsOf={lessonActions} openMenu={menu.open} />
                )}
              </Animated.View>
            )}
          </Section>
        ) : waiting && !lessons.data ? (
          <View style={styles.monthPlace}>
            <Skeleton height={330} radius={26} />
          </View>
        ) : (
          <View style={[styles.monthPlace, waiting && styles.dim]}>
            <MonthDots
              weeks={weeks}
              anchor={selected}
              lessons={list}
              themes={themesShown}
              now={now}
              onOpenDay={(day) => {
                setSelected(day)
                setMode('day')
              }}
              onTheme={(week) => tasks.weekTheme(dayKey(week))}
            />
          </View>
        )}
      </Screen>
    </>
  )
}

const styles = StyleSheet.create({
  // Takes the height of the line it replaces; it still answers to a whole fingertip
  today: { marginVertical: -7 },
  week: { marginTop: 14, gap: 14 },
  below: { marginTop: 24 },
  monthPlace: { marginTop: 16 },
  dim: { opacity: 0.6 }
})
