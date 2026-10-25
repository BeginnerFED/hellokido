import { useMemo } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { addDays, addMinutes, isSameDay, isSameMonth, startOfDay } from 'date-fns'
import { SEATS_SHOWN, type Lesson, type Seat } from '@hellokido/core/api'
import { holdsSeat } from '@hellokido/core/rules/attendance.js'
import { byDay, dayKey, daysOf, LESSON_MINUTES, seatsTaken, unmarkedIn, weekKey } from '@hellokido/core/view'
import { useLabels } from '../../data/queries'
import { useI18n, type I18n } from '../../providers/I18n'
import { tint, useColors, type Colors } from '../../theme/colors'
import { Mark, Skeleton } from '../../ui/Bits'
import { Icon } from '../../ui/Icon'
import { AgeTablet, LessonShape } from '../../ui/signature'
import { Text } from '../../ui/Text'
import { useLessonTitle } from '../../ui/UsageLine'

/**
 * The colour a lesson carries, as on the web calendar: English sky, sensory pink, special events
 * plain; lessons that are over turn neutral, so a week reads as done and still to come.
 */
export function lessonLook(c: Colors, type: string, past: boolean) {
  if (past) return { background: c.surface2, border: c.line }
  if (type === 'ingilizce') return { background: c.accentWash, border: tint(c.accent, 0.3) }
  if (type === 'duyusal') return { background: c.pinkWash, border: tint(c.pink, 0.34) }
  return { background: c.surface, border: c.lineStrong }
}

const dotColor = (c: Colors, type: string) => (type === 'ingilizce' ? c.accent : type === 'duyusal' ? c.pink : c.ink3)

/**
 * "19–25 October 2026", "28 Oct – 3 Nov 2026": the dates the two ends share are written once. Under
 * a month's own heading the year is left out ("2–8 Nov").
 */
export function weekRange(i18n: Pick<I18n, 'date'>, monday: Date, withYear = true) {
  const sunday = addDays(monday, 6)
  const short = { day: 'numeric', month: 'short' } as const
  if (!withYear) return isSameMonth(monday, sunday) ? `${i18n.date(monday, { day: 'numeric' })}–${i18n.date(sunday, short)}` : `${i18n.date(monday, short)} – ${i18n.date(sunday, short)}`
  if (isSameMonth(monday, sunday)) return `${i18n.date(monday, { day: 'numeric' })}–${i18n.date(sunday, { day: 'numeric', month: 'long', year: 'numeric' })}`
  const sameYear = monday.getFullYear() === sunday.getFullYear()
  return `${i18n.date(monday, sameYear ? short : { ...short, year: 'numeric' })} – ${i18n.date(sunday, { ...short, year: 'numeric' })}`
}

/** Seven days to pick from; a dot per lesson, so a full day reads before it is opened. */
export function WeekStrip({ days, selected, lessons, now, onSelect }: { days: Date[]; selected: Date; lessons: Lesson[]; now: Date; onSelect: (day: Date) => void }) {
  const c = useColors()
  const { t, plural, date } = useI18n()
  const grouped = useMemo(() => byDay(lessons), [lessons])
  const todayStart = startOfDay(now)
  return (
    <View style={[styles.strip, { backgroundColor: c.surface }]}>
      {days.map((day) => {
        const list = grouped.get(dayKey(day)) ?? []
        const on = isSameDay(day, selected)
        const isToday = isSameDay(day, now)
        const past = day < todayStart
        return (
          <Pressable
            key={dayKey(day)}
            onPress={() => onSelect(day)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${date(day, { weekday: 'long', day: 'numeric', month: 'long' })}${list.length ? `, ${plural(t.calendar.lessonCount, list.length)}` : ''}`}
            style={({ pressed }) => [styles.day, on ? { backgroundColor: c.accentSolid } : pressed && { backgroundColor: c.well }]}
          >
            <Text variant="caption" weight="500" numberOfLines={1} style={{ color: on ? c.onAccent : isToday ? c.accentInk : past ? c.ink3 : c.ink2 }}>
              {date(day, { weekday: 'short' })}
            </Text>
            <View style={[styles.dayNumber, isToday && { borderWidth: 1.5, borderColor: on ? c.onAccent : c.accent }]}>
              <Text variant="callout" weight="600" tabular style={{ color: on ? c.onAccent : past ? c.ink3 : c.ink }}>
                {date(day, { day: 'numeric' })}
              </Text>
            </View>
            <View style={styles.dots}>
              {list.slice(0, 4).map((lesson) => (
                <View key={lesson.id} style={[styles.dot, { backgroundColor: on ? c.onAccent : dotColor(c, lesson.event_type) }]} />
              ))}
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}

/** Children of a lesson by name; those who gave up their place stay listed, struck through. */
export function SeatNames({ seats }: { seats: Seat[] }) {
  const c = useColors()
  return (
    <View style={styles.names}>
      {seats.map((seat) => {
        const holds = holdsSeat(seat.status)
        // The same colours as the tiles and the attendance picker: green came, pink make-up
        const fill = seat.status === 'attended' ? c.positive : seat.status === 'makeup' ? c.pink : null
        return (
          <View key={seat.id} style={styles.name}>
            <View
              style={[
                styles.nameDot,
                !holds ? { backgroundColor: c.lineStrong } : fill ? { backgroundColor: fill } : { borderWidth: 1.5, borderColor: c.accent, backgroundColor: c.surface }
              ]}
            />
            <Text variant="foot" tone={holds ? 'ink' : 'ink3'} numberOfLines={1} style={!holds && styles.struck}>
              {seat.child.student_name}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

/** One lesson of the day: when, what, who; the whole card opens the lesson. */
export function AgendaCard({ lesson, now, onOpen }: { lesson: Lesson; now: Date; onOpen: () => void }) {
  const c = useColors()
  const { t, fmt, plural, date } = useI18n()
  const labels = useLabels()
  const title = useLessonTitle()
  const start = new Date(lesson.event_date)
  const end = addMinutes(start, LESSON_MINUTES)
  const past = start < startOfDay(now)
  const running = now >= start && now < end
  const taken = seatsTaken(lesson)
  const unmarked = unmarkedIn(lesson, now)
  const look = lessonLook(c, lesson.event_type, past)
  const time = date(start, { hour: '2-digit', minute: '2-digit' })

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${time} ${title(lesson)}, ${labels.ageGroup(lesson.age_group)}, ${fmt(t.today.seats, { count: taken, capacity: SEATS_SHOWN })}`}
      style={({ pressed }) => [styles.card, { backgroundColor: look.background, borderColor: look.border }, pressed && { opacity: 0.75 }]}
    >
      <View style={styles.cardHead}>
        <View style={styles.times}>
          <Text variant="headline" tabular>
            {time}
          </Text>
          <Text variant="caption" tone="ink3" tabular>
            {date(end, { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        <View style={styles.flex}>
          <View style={styles.titleLine}>
            <LessonShape type={lesson.event_type} />
            <Text variant="sub" weight="600" numberOfLines={1} style={styles.shrink}>
              {title(lesson)}
            </Text>
          </View>
          <View style={styles.marks}>
            <AgeTablet group={lesson.age_group} label={labels.ageGroup(lesson.age_group)} />
            {running && <Mark tone="accent">{t.calendar.now}</Mark>}
            {unmarked > 0 && <Mark tone="action">{plural(t.calendar.unmarked, unmarked)}</Mark>}
          </View>
        </View>
        <Text variant="foot" weight="600" tone={taken > SEATS_SHOWN ? 'actionInk' : 'ink2'} tabular>
          {taken}/{SEATS_SHOWN}
        </Text>
      </View>
      <View style={[styles.cardFoot, { borderTopColor: look.border }]}>
        {lesson.seats.length === 0 ? (
          <Text variant="foot" tone="ink3">
            {t.calendar.lesson.noChildren}
          </Text>
        ) : (
          <SeatNames seats={lesson.seats} />
        )}
      </View>
    </Pressable>
  )
}

export function AgendaSkeleton() {
  return (
    <View style={styles.list}>
      <Skeleton height={112} radius={16} />
      <Skeleton height={112} radius={16} />
    </View>
  )
}

/**
 * A month as days with a dot per lesson, the weeks' themes under it; a day opens in the day view,
 * where its lessons are.
 */
export function MonthDots({
  weeks,
  anchor,
  lessons,
  themes,
  now,
  onOpenDay,
  onTheme
}: {
  weeks: Date[]
  anchor: Date
  lessons: Lesson[]
  themes: Record<string, string> | undefined
  now: Date
  onOpenDay: (day: Date) => void
  onTheme: (monday: Date) => void
}) {
  const c = useColors()
  const i18n = useI18n()
  const { t, plural, date } = i18n
  const grouped = useMemo(() => byDay(lessons), [lessons])
  const todayStart = startOfDay(now)

  return (
    <View style={styles.month}>
      <View style={[styles.grid, { backgroundColor: c.surface }]}>
        <View style={styles.week}>
          {daysOf(weeks[0]).map((day) => (
            <Text key={day.getDay()} variant="caption" weight="500" tone="ink3" align="center" style={styles.cell}>
              {date(day, { weekday: 'narrow' })}
            </Text>
          ))}
        </View>
        {weeks.map((monday) => (
          <View key={dayKey(monday)} style={styles.week}>
            {daysOf(monday).map((day) => {
              const list = grouped.get(dayKey(day)) ?? []
              const isToday = isSameDay(day, now)
              const inMonth = isSameMonth(day, anchor)
              return (
                <Pressable
                  key={dayKey(day)}
                  onPress={() => onOpenDay(day)}
                  accessibilityRole="button"
                  accessibilityLabel={`${date(day, { weekday: 'long', day: 'numeric', month: 'long' })}${list.length ? `, ${plural(t.calendar.lessonCount, list.length)}` : ''}`}
                  style={({ pressed }) => [styles.cell, styles.monthDay, pressed && { backgroundColor: c.well }]}
                >
                  <View style={[styles.monthNumber, isToday && { backgroundColor: c.accentSolid }]}>
                    <Text
                      variant="sub"
                      weight="600"
                      tabular
                      style={{ color: isToday ? c.onAccent : inMonth && day >= todayStart ? c.ink : c.ink3 }}
                    >
                      {date(day, { day: 'numeric' })}
                    </Text>
                  </View>
                  <View style={styles.dots}>
                    {list.slice(0, 4).map((lesson) => (
                      <View key={lesson.id} style={[styles.dot, { backgroundColor: inMonth ? dotColor(c, lesson.event_type) : c.lineStrong }]} />
                    ))}
                  </View>
                </Pressable>
              )
            })}
          </View>
        ))}
      </View>

      <View>
        <Text variant="section" accessibilityRole="header" style={styles.themesTitle}>
          {t.calendar.theme.label}
        </Text>
        <View style={[styles.themes, { backgroundColor: c.surface }]}>
          {weeks.map((monday, index) => {
            const theme = themes?.[weekKey(monday)]?.trim()
            return (
              <View key={dayKey(monday)}>
                {index > 0 && <View style={[styles.separator, { backgroundColor: c.line }]} />}
                <Pressable
                  onPress={() => onTheme(monday)}
                  accessibilityRole="button"
                  accessibilityLabel={`${weekRange(i18n, monday)}: ${theme || t.calendar.theme.none}`}
                  style={({ pressed }) => [styles.themeRow, pressed && { backgroundColor: c.well }]}
                >
                  <Text variant="foot" tone="ink2" tabular numberOfLines={1} style={styles.themeDates}>
                    {weekRange(i18n, monday, false)}
                  </Text>
                  {themes === undefined ? (
                    <Skeleton height={12} width={90} radius={6} />
                  ) : (
                    <Text variant="sub" weight={theme ? '500' : '400'} tone={theme ? 'ink' : 'ink3'} numberOfLines={3} style={styles.flex}>
                      {theme || t.calendar.theme.add}
                    </Text>
                  )}
                  <Icon name="chevronRight" size={12} color={c.ink3} weight="semibold" />
                </Pressable>
              </View>
            )
          })}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  strip: { flexDirection: 'row', borderRadius: 16, padding: 5, gap: 2 },
  day: { flex: 1, alignItems: 'center', gap: 2, borderRadius: 12, paddingTop: 6, paddingBottom: 7 },
  dayNumber: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  list: { gap: 12 },
  card: { borderRadius: 18, borderWidth: 1 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 11 },
  times: { width: 52 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  marks: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 4, marginTop: 4 },
  cardFoot: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingVertical: 10 },
  names: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4 },
  name: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%' },
  nameDot: { width: 7, height: 7, borderRadius: 4 },
  struck: { textDecorationLine: 'line-through' },
  month: { gap: 24 },
  grid: { borderRadius: 16, padding: 5 },
  week: { flexDirection: 'row' },
  cell: { flex: 1 },
  monthDay: { alignItems: 'center', gap: 3, paddingVertical: 5, borderRadius: 10, minHeight: 50 },
  monthNumber: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  themesTitle: { marginBottom: 10, paddingHorizontal: 4 },
  themes: { borderRadius: 16, overflow: 'hidden' },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  themeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 11, minHeight: 50 },
  themeDates: { width: 118 }
})
