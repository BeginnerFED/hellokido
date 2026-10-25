import { useCallback, useMemo, type ReactNode } from 'react'
import { Alert, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import * as Haptics from 'expo-haptics'
import { addDays, addMinutes, isSameDay, isSameMonth, startOfDay } from 'date-fns'
import { deleteLesson, SEATS_SHOWN, type Lesson } from '@hellokido/core/api'
import { holdsSeat, isRecordedAttendance } from '@hellokido/core/rules/attendance.js'
import { byDay, DAY_END_HOUR, DAY_START_HOUR, dayKey, daysOf, layoutDay, LESSON_MINUTES, minutesOfDay, seatsTaken, unmarkedIn, weekKey } from '@hellokido/core/view'
import { useLabels, useRefresh } from '../../data/queries'
import { tasks } from '../../lib/navigation'
import { useI18n, type I18n } from '../../providers/I18n'
import { typeTone, useColors } from '../../theme/colors'
import type { MenuItem } from '../../ui/ActionMenu'
import { initialsOf, Mark, Skeleton } from '../../ui/Bits'
import { IconButton } from '../../ui/Button'
import { Icon } from '../../ui/Icon'
import { Card, Section } from '../../ui/Screen'
import { LessonShape } from '../../ui/signature'
import { SwipeRow, type RowAction } from '../../ui/SwipeRow'
import { Text, type TextTone } from '../../ui/Text'
import { useToast } from '../../ui/Toast'
import { useLessonTitle } from '../../ui/UsageLine'

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

/** "Pazar, 25 Ekim", as Today's title: the weekday first in every language, then the day ("2025" too when it is another year). */
export function dayTitle(i18n: Pick<I18n, 'date' | 'tag'>, day: Date, now = new Date()) {
  const weekday = i18n.date(day, { weekday: 'long' })
  const rest = i18n.date(day, day.getFullYear() === now.getFullYear() ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' })
  return `${weekday.charAt(0).toLocaleUpperCase(i18n.tag)}${weekday.slice(1)}, ${rest}`
}

/** A short line of what needs doing over a group (attendance missing, too many children): a 7pt dot and words in its ink. */
export function GroupNote({ tone, children, style }: { tone: Extract<TextTone, 'actionInk' | 'negativeInk'>; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors()
  const negative = tone === 'negativeInk'
  return (
    <View style={[styles.note, style]} accessibilityRole={negative ? 'alert' : undefined}>
      <View style={[styles.noteDot, { backgroundColor: negative ? c.negative : c.amber }]} />
      <Text variant="sub" weight="500" style={[styles.flex, { color: negative ? c.negativeInk : c.amberInk }]}>
        {children}
      </Text>
    </View>
  )
}

/**
 * The week or month on show with the arrows to step through it, as Finance steps through its
 * periods: two felt circles and the range between them, with a line under it.
 */
export function PeriodBar({
  label,
  under,
  onPrevious,
  onNext,
  previousLabel,
  nextLabel
}: {
  label: string
  under?: ReactNode
  onPrevious: () => void
  onNext: () => void
  previousLabel: string
  nextLabel: string
}) {
  return (
    <View style={styles.period}>
      <IconButton icon="chevronLeft" label={previousLabel} variant="felt" size={40} onPress={onPrevious} />
      <View style={styles.periodMiddle}>
        {/* A week across two years is the longest; it narrows a little rather than lose its end */}
        <Text
          weight="600"
          tabular
          align="center"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
          style={styles.periodLabel}
        >
          {label}
        </Text>
        {under}
      </View>
      <IconButton icon="chevronRight" label={nextLabel} variant="felt" size={40} onPress={onNext} />
    </View>
  )
}

/**
 * Seven days to pick from: the weekday over the day in a 40pt circle (today in the blue fill, the
 * chosen day in sky felt), and a small shape per lesson under it in its type's colour.
 */
export function WeekStrip({
  days,
  selected,
  lessons,
  now,
  waiting,
  onSelect
}: {
  days: Date[]
  selected: Date
  lessons: Lesson[]
  now: Date
  /** The week's lessons are still on their way: no day reads as empty yet. */
  waiting?: boolean
  onSelect: (day: Date) => void
}) {
  const c = useColors()
  const { t, plural, date } = useI18n()
  const grouped = useMemo(() => byDay(lessons), [lessons])
  return (
    <View style={styles.strip}>
      {days.map((day) => {
        const list = grouped.get(dayKey(day)) ?? []
        const on = isSameDay(day, selected)
        const isToday = isSameDay(day, now)
        // A day without lessons steps back a little, so the week's shape reads at a glance
        const quiet = !waiting && list.length === 0 && !isToday && !on
        const fill = on ? (isToday ? c.fill : c.skyFelt) : undefined
        const ink = on ? (isToday ? c.onFill : c.skyInk) : isToday ? c.accentInk : quiet ? c.ink3 : c.ink
        return (
          <Pressable
            key={dayKey(day)}
            onPress={() => {
              if (on) return
              void Haptics.selectionAsync()
              onSelect(day)
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${date(day, { weekday: 'long', day: 'numeric', month: 'long' })}${list.length ? `, ${plural(t.calendar.lessonCount, list.length)}` : ''}`}
            style={styles.day}
          >
            {({ pressed }) => (
              <>
                <Text variant="foot" weight={isToday ? '600' : '500'} numberOfLines={1} maxFontSizeMultiplier={1.2} style={{ color: isToday ? c.accentInk : c.ink3 }}>
                  {date(day, { weekday: 'short' })}
                </Text>
                {/* Drawn afresh when its fill changes: Android keeps a changed fill square instead of round */}
                <View key={fill ?? (pressed ? 'pressed' : 'clear')} style={[styles.dayNumber, { backgroundColor: fill ?? (pressed ? c.felt : 'transparent') }]}>
                  <Text weight={on || isToday ? '600' : '500'} tabular maxFontSizeMultiplier={1.2} style={[styles.dayText, { color: ink }]}>
                    {date(day, { day: 'numeric' })}
                  </Text>
                </View>
                <View style={styles.shapes}>
                  {list.slice(0, 4).map((lesson) => (
                    <LessonShape key={lesson.id} type={lesson.event_type} size={6} />
                  ))}
                </View>
              </>
            )}
          </Pressable>
        )
      })}
    </View>
  )
}

/** The week's theme as one felt row under the strip: a pencil, "Haftanın konusu" and the theme. */
export function WeekThemeRow({ theme, loading, onPress }: { theme: string | undefined; loading: boolean; onPress: () => void }) {
  const c = useColors()
  const { t } = useI18n()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${t.calendar.theme.label}: ${theme || t.calendar.theme.none}`}
      accessibilityHint={theme ? t.calendar.theme.edit : t.calendar.theme.add}
      style={({ pressed }) => [styles.theme, { backgroundColor: pressed ? c.pressed : c.felt }]}
    >
      <Icon name="edit" size={17} color={c.ink2} />
      <View style={styles.flex}>
        <Text variant="sub" tone="ink3">
          {t.calendar.theme.label}
        </Text>
        {loading ? (
          <View style={styles.themeWaiting}>
            <Skeleton height={13} width={150} radius={6} />
          </View>
        ) : (
          <Text weight="500" tone={theme ? 'ink' : 'accentInk'} numberOfLines={2}>
            {theme || t.calendar.theme.add}
          </Text>
        )}
      </View>
    </Pressable>
  )
}

/**
 * What a lesson's page offers that is safe from the day's board: its edit, add-children and copy
 * sheets, and deleting it after the very question the page asks.
 */
export function useLessonActions() {
  const { t, plural } = useI18n()
  const toast = useToast()
  const refresh = useRefresh()
  return useCallback(
    (lesson: Lesson): RowAction[] => {
      const recorded = lesson.seats.filter((seat) => isRecordedAttendance(seat.status)).length
      const remove = async () => {
        try {
          await deleteLesson(lesson.id)
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          toast({ title: t.calendar.lesson.deleted })
          refresh.lessons()
        } catch {
          toast({ tone: 'error', title: t.calendar.lesson.deleteFailed })
        }
      }
      const askDelete = () =>
        Alert.alert(
          t.calendar.lesson.deleteTitle,
          [t.calendar.lesson.deleteBody, recorded > 0 ? plural(t.calendar.lesson.deleteRecorded, recorded) : null].filter(Boolean).join('\n\n'),
          [
            { text: t.common.cancel, style: 'cancel' },
            { text: t.calendar.lesson.deleteConfirm, style: 'destructive', onPress: () => void remove() }
          ]
        )
      return [
        { key: 'edit', label: t.mobile.editLesson, icon: 'edit', onPress: () => tasks.lesson({ id: lesson.id }) },
        { key: 'addChildren', label: t.calendar.lesson.addChildren, icon: 'personAdd', onPress: () => tasks.lessonChildren(lesson.id) },
        { key: 'copy', label: t.mobile.copyLesson, icon: 'copy', onPress: () => tasks.lesson({ id: lesson.id, copy: true }) },
        { key: 'delete', label: t.calendar.lesson.delete, icon: 'delete', destructive: true, onPress: askDelete }
      ]
    },
    [t, plural, toast, refresh]
  )
}

// The day's board: 56pt an hour, the hours in a 52pt gutter at the left
const HOUR = 56
const GUTTER = 52
// Room over the first hour line for its label
const TOP = 8
const BLOCK = (LESSON_MINUTES / 60) * HOUR - 2
// Initials shown on a block before "+n"
const FACES = 6

const hourText = (hour: number) => `${String(hour).padStart(2, '0')}:00`

type DayTimelineProps = {
  day: Date
  lessons: Lesson[]
  now: Date
  onOpen: (lesson: Lesson) => void
  /** Held, a block offers these in the screen's action sheet. */
  actionsOf: (lesson: Lesson) => RowAction[]
  openMenu: (title: string | undefined, items: MenuItem[]) => void
}

/**
 * A day as the phone's Calendar draws it: an hour per line, each lesson a felt block in its type's
 * colour at its real time and length, and a pink line at the current time on today. Lessons that
 * overlap share the width. A block opens its lesson; held, it offers the lesson's own changes.
 */
export function DayTimeline({ day, lessons, now, onOpen, actionsOf, openMenu }: DayTimelineProps) {
  const c = useColors()
  const { date } = useI18n()
  const columns = useMemo(() => layoutDay(lessons), [lessons])
  const starts = lessons.map((lesson) => minutesOfDay(new Date(lesson.event_date)))
  // The board always shows the working hours; a lesson outside them widens it
  const first = Math.min(DAY_START_HOUR, ...starts.map((start) => Math.floor(start / 60)))
  const last = Math.max(DAY_END_HOUR, ...starts.map((start) => Math.ceil((start + LESSON_MINUTES) / 60)))
  const y = (minutes: number) => TOP + ((minutes - first * 60) / 60) * HOUR
  const nowMinutes = minutesOfDay(now)
  const showsNow = isSameDay(day, now) && nowMinutes >= first * 60 && nowMinutes <= last * 60
  const nowY = y(nowMinutes)
  const hours = Array.from({ length: last - first + 1 }, (_, index) => first + index)

  return (
    <View style={{ height: y(last * 60) + TOP }}>
      {hours.map((hour) => {
        const lineY = y(hour * 60)
        // The time chip on the now line takes the place of an hour label it would touch, as on the iPhone
        const covered = showsNow && Math.abs(nowY - lineY) < 15
        return (
          <View key={hour} pointerEvents="none" style={[styles.hourRow, { top: lineY }]}>
            <View style={styles.hourLabel}>
              {!covered && (
                <Text variant="foot" tone="ink3" tabular maxFontSizeMultiplier={1.15} style={styles.hourText}>
                  {hourText(hour)}
                </Text>
              )}
            </View>
            <View style={[styles.hourLine, { backgroundColor: c.line }]} />
          </View>
        )
      })}

      {showsNow && (
        <View pointerEvents="none" style={[styles.nowLine, { top: nowY - 1, backgroundColor: c.pink }]}>
          <View style={[styles.nowDot, { backgroundColor: c.pink }]} />
        </View>
      )}

      <View style={styles.blocks}>
        {lessons.map((lesson) => {
          const start = minutesOfDay(new Date(lesson.event_date))
          const place = columns.get(lesson.id) ?? { column: 0, columns: 1 }
          return (
            <View
              key={lesson.id}
              style={[
                styles.blockPlace,
                {
                  top: y(start) + 1,
                  height: BLOCK,
                  left: `${(place.column / place.columns) * 100}%`,
                  width: `${100 / place.columns}%`,
                  paddingLeft: place.column > 0 ? 3 : 0,
                  paddingRight: place.column < place.columns - 1 ? 3 : 0
                }
              ]}
            >
              <LessonBlock lesson={lesson} now={now} narrow={place.columns > 1} onOpen={() => onOpen(lesson)} actions={actionsOf(lesson)} openMenu={openMenu} />
            </View>
          )
        })}
      </View>

      {showsNow && (
        <View pointerEvents="none" style={[styles.nowChip, { top: nowY - 9, backgroundColor: c.nowChip }]}>
          <Text weight="600" tabular maxFontSizeMultiplier={1.1} style={[styles.nowText, { color: c.onNowChip }]}>
            {date(now, { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      )}
    </View>
  )
}

/**
 * One lesson on the day's board, a block of its type's felt: the hours and the seats, the shape with
 * the type and age group, then the children holding a seat as small circles of initials.
 */
function LessonBlock({
  lesson,
  now,
  narrow,
  onOpen,
  actions,
  openMenu
}: {
  lesson: Lesson
  now: Date
  narrow: boolean
  onOpen: () => void
  actions: RowAction[]
  openMenu: (title: string | undefined, items: MenuItem[]) => void
}) {
  const c = useColors()
  const { t, fmt, plural, date } = useI18n()
  const labels = useLabels()
  const title = useLessonTitle()
  const tone = typeTone(c, lesson.event_type)
  const start = new Date(lesson.event_date)
  const end = addMinutes(start, LESSON_MINUTES)
  const running = now >= start && now < end
  const taken = seatsTaken(lesson)
  const unmarked = unmarkedIn(lesson, now)
  const hours = `${date(start, { hour: '2-digit', minute: '2-digit' })}–${date(end, { hour: '2-digit', minute: '2-digit' })}`
  const name = [title(lesson), labels.ageGroup(lesson.age_group)].filter(Boolean).join(', ')
  const holders = lesson.seats.filter((seat) => holdsSeat(seat.status))
  const faces = holders.slice(0, holders.length > FACES ? FACES - 1 : FACES)
  const rest = holders.length - faces.length
  const face = { backgroundColor: tone.dark ? tone.track : c.raised, borderColor: tone.felt }

  return (
    <SwipeRow actions={actions} openMenu={openMenu} menuTitle={`${date(start, { hour: '2-digit', minute: '2-digit' })} ${title(lesson)}`} onPress={onOpen}>
      {(press) => (
        <Pressable
          {...press}
          accessibilityRole="button"
          accessibilityLabel={[
            `${hours} ${title(lesson)}`,
            labels.ageGroup(lesson.age_group),
            running ? t.calendar.now : null,
            fmt(t.today.seats, { count: taken, capacity: SEATS_SHOWN }),
            unmarked > 0 ? plural(t.calendar.unmarked, unmarked) : null,
            holders.length > 0 ? holders.map((seat) => seat.child.student_name).join(', ') : t.calendar.lesson.noChildren
          ]
            .filter(Boolean)
            .join(', ')}
          style={({ pressed }) => [styles.block, { backgroundColor: tone.felt }, pressed && styles.pressed]}
        >
          <View style={styles.blockTop}>
            <Text tabular numberOfLines={1} maxFontSizeMultiplier={1.15} style={[styles.blockHours, { color: tone.ink }]}>
              {hours}
            </Text>
            {/* A child past the planned six turns the count red, as on the lesson's page */}
            <Text weight="600" tabular maxFontSizeMultiplier={1.15} style={[styles.blockSeats, { color: taken > SEATS_SHOWN ? c.negativeInk : tone.ink }]}>
              {taken}/{SEATS_SHOWN}
            </Text>
          </View>
          <View style={styles.blockName}>
            <LessonShape type={lesson.event_type} size={10} />
            <Text weight="600" numberOfLines={1} maxFontSizeMultiplier={1.15} style={[styles.blockTitle, { color: tone.ink }]}>
              {name}
            </Text>
          </View>
          <View style={styles.blockFoot}>
            {holders.length === 0 ? (
              <Text numberOfLines={1} maxFontSizeMultiplier={1.15} style={[styles.blockEmpty, { color: tone.ink }]}>
                {t.calendar.lesson.noChildren}
              </Text>
            ) : (
              <View style={styles.faces}>
                {faces.map((seat) => (
                  <View key={seat.id} style={[styles.face, face]}>
                    <Text weight="600" maxFontSizeMultiplier={1} style={[styles.faceText, { color: tone.ink }]}>
                      {initialsOf(seat.child.student_name)}
                    </Text>
                  </View>
                ))}
                {rest > 0 && (
                  <View style={[styles.face, face]}>
                    <Text weight="600" tabular maxFontSizeMultiplier={1} style={[styles.faceText, { color: tone.ink }]}>
                      +{rest}
                    </Text>
                  </View>
                )}
              </View>
            )}
            {unmarked > 0 && !narrow && <Mark tone="action">{plural(t.calendar.unmarkedShort, unmarked)}</Mark>}
          </View>
          {/* Two blocks side by side leave no room for the words; the amber dot alone says it */}
          {unmarked > 0 && narrow && <View style={[styles.cornerDot, { backgroundColor: c.amber }]} />}
        </Pressable>
      )}
    </SwipeRow>
  )
}

/** The day's board at rest while its lessons load: the hour lines and two quiet blocks. */
export function TimelineSkeleton() {
  const c = useColors()
  const hours = [DAY_START_HOUR, DAY_START_HOUR + 1, DAY_START_HOUR + 2, DAY_START_HOUR + 3, DAY_START_HOUR + 4]
  return (
    <View style={{ height: TOP + 4 * HOUR + TOP }}>
      {hours.map((hour, index) => (
        <View key={hour} style={[styles.hourRow, { top: TOP + index * HOUR }]}>
          <View style={styles.hourLabel}>
            <Text variant="foot" tone="ink3" tabular style={styles.hourText}>
              {hourText(hour)}
            </Text>
          </View>
          <View style={[styles.hourLine, { backgroundColor: c.line }]} />
        </View>
      ))}
      <View style={styles.blocks}>
        <View style={[styles.blockPlace, { top: TOP + HOUR + 1, height: BLOCK }]}>
          <Skeleton height={BLOCK} radius={18} />
        </View>
        <View style={[styles.blockPlace, { top: TOP + 3 * HOUR + 1, height: BLOCK }]}>
          <Skeleton height={BLOCK - 28} radius={18} />
        </View>
      </View>
    </View>
  )
}

/**
 * A month as days with a shape per lesson, the weeks' themes under it; a day opens in the day view,
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
      <View style={[styles.grid, { backgroundColor: c.felt }]}>
        {/* Short names: Turkish narrow ones repeat (P S Ç P C C P) and cannot be told apart */}
        <View style={[styles.week, styles.weekdays]}>
          {daysOf(weeks[0]).map((day) => (
            <Text key={day.getDay()} variant="foot" weight="500" tone="ink3" align="center" numberOfLines={1} maxFontSizeMultiplier={1.2} style={styles.cell}>
              {date(day, { weekday: 'short' })}
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
                  style={[styles.cell, styles.monthDay]}
                >
                  {({ pressed }) => (
                    <>
                      {/* Days of the neighbouring months fade, so the month's edges read in any month */}
                      <View
                        key={isToday ? 'today' : pressed ? 'pressed' : 'clear'}
                        style={[styles.monthNumber, { backgroundColor: isToday ? c.fill : pressed ? c.pressed : 'transparent' }, !inMonth && !isToday && styles.outside]}
                      >
                        <Text
                          weight={isToday ? '600' : '500'}
                          tabular
                          maxFontSizeMultiplier={1.2}
                          style={[styles.monthText, { color: isToday ? c.onFill : inMonth && day >= todayStart ? c.ink : c.ink3 }]}
                        >
                          {date(day, { day: 'numeric' })}
                        </Text>
                      </View>
                      <View style={[styles.shapes, !inMonth && styles.outside]}>
                        {list.slice(0, 4).map((lesson) => (
                          <LessonShape key={lesson.id} type={lesson.event_type} size={6} color={inMonth ? undefined : c.mute} />
                        ))}
                      </View>
                    </>
                  )}
                </Pressable>
              )
            })}
          </View>
        ))}
      </View>

      <Section title={t.calendar.theme.label}>
        <Card>
          {weeks.map((monday) => {
            const theme = themes?.[weekKey(monday)]?.trim()
            return (
              <Pressable
                key={dayKey(monday)}
                onPress={() => onTheme(monday)}
                accessibilityRole="button"
                accessibilityLabel={`${weekRange(i18n, monday)}: ${theme || t.calendar.theme.none}`}
                accessibilityHint={theme ? t.calendar.theme.edit : t.calendar.theme.add}
                style={({ pressed }) => [styles.themeRow, pressed && { backgroundColor: c.pressed }]}
              >
                <Text variant="sub" tone="ink3" tabular numberOfLines={1} style={styles.themeDates}>
                  {weekRange(i18n, monday, false)}
                </Text>
                {themes === undefined ? (
                  <View style={styles.flex}>
                    <Skeleton height={12} width={90} radius={6} />
                  </View>
                ) : (
                  <Text weight={theme ? '500' : '400'} tone={theme ? 'ink' : 'ink3'} numberOfLines={3} style={styles.flex}>
                    {theme || t.calendar.theme.add}
                  </Text>
                )}
                <Icon name="edit" size={15} color={c.ink3} />
              </Pressable>
            )
          })}
        </Card>
      </Section>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 4 },
  noteDot: { width: 7, height: 7, borderRadius: 4, marginTop: 6 },
  period: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  periodMiddle: { flex: 1, minWidth: 0, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  periodLabel: { fontSize: 18, lineHeight: 23, letterSpacing: -0.2 },
  strip: { flexDirection: 'row', marginHorizontal: -4 },
  day: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 2 },
  dayNumber: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 17, lineHeight: 22 },
  shapes: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 6 },
  theme: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 11, minHeight: 62, borderRadius: 20 },
  themeWaiting: { height: 21, justifyContent: 'center' },
  hourRow: { position: 'absolute', left: 0, right: 0, height: 1, flexDirection: 'row', alignItems: 'center' },
  hourLabel: { width: GUTTER, height: 16, justifyContent: 'center' },
  hourText: { fontSize: 12, lineHeight: 16, paddingLeft: 4 },
  hourLine: { flex: 1, height: 1 },
  nowLine: { position: 'absolute', left: GUTTER - 6, right: 0, height: 2 },
  nowDot: { position: 'absolute', left: -5, top: -4, width: 10, height: 10, borderRadius: 5 },
  nowChip: { position: 'absolute', left: 0, height: 18, borderRadius: 8, paddingHorizontal: 5, justifyContent: 'center' },
  nowText: { fontSize: 11.5, lineHeight: 15 },
  blocks: { position: 'absolute', left: GUTTER, right: 0, top: 0, bottom: 0 },
  blockPlace: { position: 'absolute', left: 0, width: '100%' },
  block: { flex: 1, borderRadius: 18, paddingTop: 8, paddingBottom: 9, paddingLeft: 14, paddingRight: 12, gap: 1, overflow: 'hidden' },
  pressed: { transform: [{ scale: 0.98 }] },
  blockTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  blockHours: { fontSize: 12.5, lineHeight: 17, flexShrink: 1 },
  blockSeats: { fontSize: 13.5, lineHeight: 17 },
  blockName: { flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 },
  blockTitle: { fontSize: 16, lineHeight: 21, flexShrink: 1 },
  blockFoot: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 'auto', minWidth: 0 },
  blockEmpty: { fontSize: 13, lineHeight: 17, opacity: 0.8, flexShrink: 1 },
  faces: { flexDirection: 'row', flexShrink: 0 },
  face: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, marginRight: -5, alignItems: 'center', justifyContent: 'center' },
  faceText: { fontSize: 10, lineHeight: 13 },
  cornerDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4 },
  month: { gap: 28 },
  grid: { borderRadius: 26, paddingHorizontal: 6, paddingBottom: 8 },
  week: { flexDirection: 'row' },
  weekdays: { paddingTop: 12, paddingBottom: 4 },
  cell: { flex: 1, minWidth: 0 },
  monthDay: { alignItems: 'center', gap: 3, paddingVertical: 4, minHeight: 54 },
  monthNumber: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  monthText: { fontSize: 16, lineHeight: 21 },
  outside: { opacity: 0.45 },
  themeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 11, minHeight: 54 },
  themeDates: { width: 104 }
})
