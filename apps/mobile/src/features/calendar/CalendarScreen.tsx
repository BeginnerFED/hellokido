import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated'
import { Stack } from 'expo-router'
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
import { EmptyState, LoadError, Skeleton } from '../../ui/Bits'
import { Button, IconButton } from '../../ui/Button'
import { Segmented } from '../../ui/Fields'
import { Icon } from '../../ui/Icon'
import { Screen, Section } from '../../ui/Screen'
import { Text } from '../../ui/Text'
import { AgendaCard, AgendaSkeleton, MonthDots, WeekStrip, weekRange } from './parts'

type Mode = 'day' | 'month'

/**
 * Lessons a day at a time under a strip of the week, as the web panel shows them on phones; the
 * month view shows which days have lessons and the theme of each week.
 */
export function CalendarScreen() {
  const c = useColors()
  const i18n = useI18n()
  const { t, plural, date } = i18n
  const client = useQueryClient()
  const openLesson = useOpenLesson()
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

  const showsNow = mode === 'month' ? isSameMonth(selected, now) : isSameWeek(selected, now, { weekStartsOn: 1 })
  const step = (direction: 1 | -1) => setSelected((day) => (mode === 'month' ? addMonths(day, direction) : addDays(day, direction * 7)))
  const [previousLabel, nextLabel] = mode === 'month' ? [t.calendar.previousMonth, t.calendar.nextMonth] : [t.calendar.previousWeek, t.calendar.nextWeek]
  const heading = mode === 'month' ? upperFirst(date(selected, { month: 'long', year: 'numeric' })) : weekRange(i18n, monday)
  const theme = themesShown?.[weekKey(selected)]?.trim()

  const createOn = (day: Date) => tasks.lesson({ day: dayKey(day) })
  const refresh = () => Promise.all([lessons.refetch(), themes.refetch(), client.invalidateQueries({ queryKey: ['usage'] })])

  return (
    <>
      <Stack.Screen options={headerButton(c, t.calendar.newLesson, 'add', () => createOn(selected))} />
      <Screen onRefresh={refresh} gap={24}>
        <View style={styles.top}>
          <Segmented<Mode>
            options={[
              { id: 'day', label: t.calendar.views.day },
              { id: 'month', label: t.calendar.views.month }
            ]}
            value={mode}
            onChange={setMode}
          />
          <View style={styles.nav}>
            {/* A week across two years is the longest heading; it narrows a little rather than lose its end */}
            <Text
              variant="headline"
              accessibilityRole="header"
              accessibilityLiveRegion="polite"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
              tabular
              style={styles.flex}
            >
              {heading}
            </Text>
            {!showsNow && (
              <Button size="sm" onPress={() => setSelected(new Date(`${todayKey}T00:00:00`))}>
                {t.common.today}
              </Button>
            )}
            <IconButton icon="chevronLeft" label={previousLabel} variant="well" onPress={() => step(-1)} />
            <IconButton icon="chevronRight" label={nextLabel} variant="well" onPress={() => step(1)} />
          </View>
          {mode === 'day' && (
            <>
              <WeekStrip days={daysOf(monday)} selected={selected} lessons={list} now={now} onSelect={setSelected} />
              <Pressable
                onPress={() => tasks.weekTheme(dayKey(monday))}
                accessibilityRole="button"
                accessibilityLabel={`${t.calendar.theme.label}: ${theme || t.calendar.theme.none}`}
                accessibilityHint={theme ? t.calendar.theme.edit : t.calendar.theme.add}
                // The line stays slim; the fingertip still gets 44 points
                hitSlop={{ top: 6, bottom: 6 }}
                style={({ pressed }) => [styles.theme, pressed && { opacity: 0.6 }]}
              >
                <Text variant="foot" tone="ink3">
                  {t.calendar.theme.label}
                </Text>
                {themesShown === undefined ? (
                  <Skeleton height={12} width={110} radius={6} />
                ) : (
                  <Text variant="foot" weight={theme ? '600' : '400'} tone={theme ? 'ink' : 'ink3'} numberOfLines={2} style={styles.flex}>
                    {theme || t.calendar.theme.none}
                  </Text>
                )}
                <Icon name={theme ? 'edit' : 'add'} size={14} color={c.accentInk} />
              </Pressable>
            </>
          )}
        </View>

        {lessons.isError ? (
          <LoadError message={t.calendar.loadFailed} retryLabel={t.common.retry} onRetry={() => void lessons.refetch()} />
        ) : mode === 'day' ? (
          <Section
            title={date(selected, { weekday: 'long', day: 'numeric', month: 'long' })}
            aside={!waiting && dayLessons.length > 0 ? plural(t.calendar.lessonCount, dayLessons.length) : undefined}
          >
            {waiting ? (
              <AgendaSkeleton />
            ) : (
              // Another day's lessons settle in softly instead of jumping into place
              <Animated.View key={dayKey(selected)} entering={still ? undefined : FadeIn.duration(180)}>
                {dayLessons.length === 0 ? (
                  <View style={[styles.empty, { borderColor: c.lineStrong }]}>
                    <EmptyState
                      icon="calendar"
                      title={t.calendar.noLessonsDay}
                      action={
                        <Button size="sm" icon="add" onPress={() => createOn(selected)}>
                          {t.calendar.addLessonDay}
                        </Button>
                      }
                    />
                  </View>
                ) : (
                  <View style={styles.list}>
                    {dayLessons.map((lesson) => (
                      <AgendaCard key={lesson.id} lesson={lesson} now={now} onOpen={() => openLesson(lesson.id)} />
                    ))}
                    <Button variant="plain" size="sm" icon="add" onPress={() => createOn(selected)} style={styles.addMore}>
                      {t.calendar.addLessonDay}
                    </Button>
                  </View>
                )}
              </Animated.View>
            )}
          </Section>
        ) : waiting && !lessons.data ? (
          <Skeleton height={320} radius={18} />
        ) : (
          <View style={waiting && styles.dim}>
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
  flex: { flex: 1, minWidth: 0 },
  top: { gap: 12 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4, minHeight: 44 },
  theme: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, minHeight: 32 },
  list: { gap: 12 },
  empty: { borderRadius: 18, borderWidth: 1, borderStyle: 'dashed' },
  addMore: { alignSelf: 'flex-start', marginLeft: 4 },
  dim: { opacity: 0.6 }
})
