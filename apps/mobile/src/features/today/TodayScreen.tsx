import { useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native'
import { router, Stack, type Href } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { addDays, addMinutes } from 'date-fns'
import { lessonsBetween, LessonError, SEATS_SHOWN, setAttendance, type AttendanceStatus, type Lesson, type Seat, type UsageMap } from '@hellokido/core/api'
import { holdsSeat } from '@hellokido/core/rules/attendance.js'
import { isPaymentDue, LESSON_MINUTES } from '@hellokido/core/view'
import { keys, useLabels, useUsageOf } from '../../data/queries'
import { useClock } from '../../lib/clock'
import { headerMenu, tasks, useOpenLesson } from '../../lib/navigation'
import { useI18n } from '../../providers/I18n'
import { useColors } from '../../theme/colors'
import { useActionMenu } from '../../ui/ActionMenu'
import { AttendancePicker } from '../../ui/AttendancePicker'
import { EmptyState, LoadError, Mark, Skeleton } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { Icon, type IconName } from '../../ui/Icon'
import { Card, Screen, Section } from '../../ui/Screen'
import { AgeTablet, LessonShape, Peg, SocketBoard } from '../../ui/signature'
import { DOT, Text } from '../../ui/Text'
import { useToast } from '../../ui/Toast'
import { UsageLine, useLessonTitle } from '../../ui/UsageLine'
import { useEndingPackages, usePaymentsDue, useUnmarked } from './data'
import { ChildName, EndingSection, PaymentsSection, TomorrowSection, UnmarkedSection } from './sections'

/** A count and its word ("12 çocuk") as one unbreakable piece of a sentence. */
const keepTogether = (text: string) => text.replace(/ /g, ' ')

/**
 * The working day: today's lessons with attendance in one tap, forgotten attendance, tomorrow's
 * reminders, and the families who owe a payment or need a new package.
 */
export function TodayScreen() {
  const c = useColors()
  const { t, plural, date } = useI18n()
  const toast = useToast()
  const client = useQueryClient()
  const { now, dayKey } = useClock()
  const menu = useActionMenu()
  const scroll = useRef<ScrollViewInstance>(null)
  const offsets = useRef<Record<string, number>>({})

  const todayStart = useMemo(() => new Date(`${dayKey}T00:00:00`), [dayKey])
  const tomorrowStart = useMemo(() => addDays(todayStart, 1), [todayStart])
  const rangeEnd = useMemo(() => addDays(todayStart, 2), [todayStart])
  const key = keys.lessons(todayStart.toISOString(), rangeEnd.toISOString())
  const lessons = useQuery({ queryKey: key, queryFn: () => lessonsBetween(todayStart, rangeEnd) })

  const todays = useMemo(() => (lessons.data ?? []).filter((lesson) => new Date(lesson.event_date) < tomorrowStart), [lessons.data, tomorrowStart])
  const tomorrows = useMemo(() => (lessons.data ?? []).filter((lesson) => new Date(lesson.event_date) >= tomorrowStart), [lessons.data, tomorrowStart])
  const usage = useUsageOf(useMemo(() => (lessons.data ?? []).flatMap((lesson) => lesson.seats.map((seat) => seat.child)), [lessons.data]))
  const [saving, setSaving] = useState<Set<string>>(() => new Set())
  // Answers on their way, read at once: a second tap before the next render never sends twice
  const inFlight = useRef(new Set<string>())

  const patch = (seatId: string, status: AttendanceStatus) =>
    client.setQueryData<Lesson[]>(key, (list) => list?.map((lesson) => ({ ...lesson, seats: lesson.seats.map((seat) => (seat.id === seatId ? { ...seat, status } : seat)) })))

  // Optimistic: the answer shows at once and goes back if it could not be saved
  const mark = async (seat: Seat, status: AttendanceStatus) => {
    if (seat.status === status || inFlight.current.has(seat.id)) return
    inFlight.current.add(seat.id)
    const before = seat.status
    setSaving((set) => new Set(set).add(seat.id))
    await client.cancelQueries({ queryKey: key })
    patch(seat.id, status)
    try {
      await setAttendance(seat.id, status)
    } catch (error) {
      patch(seat.id, before)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      // The child was taken out of the lesson meanwhile: show the lesson as it is now
      if (error instanceof LessonError && error.code === 'not_found') {
        toast({ tone: 'info', title: t.today.lessonGone })
        void lessons.refetch()
      } else {
        toast({ tone: 'error', title: t.children.detail.statusFailed })
      }
    } finally {
      inFlight.current.delete(seat.id)
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

  const childCount = new Set(todays.flatMap((lesson) => lesson.seats.map((seat) => seat.registration_id))).size
  const day = date(now, { weekday: 'long', day: 'numeric', month: 'long' })
  // "3 ders" and "12 çocuk" stay whole when the line wraps
  const counts = lessons.data && todays.length > 0 ? `${keepTogether(plural(t.today.lessonCount, todays.length))}, ${keepTogether(plural(t.today.childCount, childCount))}` : null
  const summary = counts ? `${day}${DOT}${counts}` : day

  // What waits for the admin, counted from the same queries as the sections it jumps to
  const [unmarkedOpen, setUnmarkedOpen] = useState(false)
  const unmarked = useUnmarked(dayKey).query
  const payments = usePaymentsDue()
  const ending = useEndingPackages(now)
  const waiting = [
    { id: 'payments', count: payments.total, label: t.today.strip.payments, icon: 'card' as IconName },
    { id: 'ending', count: ending.rows.length, label: t.today.strip.ending, icon: 'refresh' as IconName },
    { id: 'unmarked', count: unmarked.data?.length ?? 0, label: t.today.strip.unmarked, icon: 'check' as IconName }
  ].filter((item) => item.count > 0)

  const jump = async (id: string) => {
    if (id === 'unmarked') setUnmarkedOpen(true)
    const y = offsets.current[id]
    if (y === undefined) return
    const still = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false)
    scroll.current?.scrollTo({ y: Math.max(y - 12, 0), animated: !still })
  }
  const remember = (id: string) => (event: { nativeEvent: { layout: { y: number } } }) => {
    offsets.current[id] = event.nativeEvent.layout.y
  }

  const refresh = () =>
    Promise.all([
      lessons.refetch(),
      unmarked.refetch(),
      payments.registrations.refetch(),
      client.invalidateQueries({ queryKey: ['usage'] }),
      client.invalidateQueries({ queryKey: keys.finance('pending') })
    ])

  const quickAdd = [
    { label: t.shell.quickAdd.payment, icon: 'money' as const, onPress: () => tasks.payment() },
    { label: t.shell.quickAdd.expense, icon: 'receipt' as const, onPress: () => tasks.expense() },
    { label: t.shell.quickAdd.note, icon: 'note' as const, onPress: () => tasks.note() },
    { label: t.shell.quickAdd.waitlist, icon: 'waitlist' as const, onPress: () => tasks.waitlist() }
  ]

  return (
    <>
      <Stack.Screen options={headerMenu(c, t.shell.quickAdd.title, quickAdd, (items) => menu.open(t.shell.quickAdd.title, items))} />
      {menu.element}
      <Screen scrollRef={scroll} onRefresh={refresh}>
        <View style={styles.top}>
          <Text variant="sub" tone="ink2" style={styles.summary}>
            {summary}
          </Text>
          {waiting.length > 0 && (
            // What waits, as soft blue pills that scroll sideways; each jumps to its list below
            <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel={t.today.strip.label} style={styles.stripScroll} contentContainerStyle={styles.strip}>
              {waiting.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => void jump(item.id)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.pill, { backgroundColor: pressed ? c.accentWash2 : c.accentWash, borderColor: c.accentLine }]}
                >
                  <Icon name={item.icon} size={17} color={c.accentInk} />
                  <Text variant="sub" weight="500" tone="accentInk" numberOfLines={1} style={{ fontSize: 14 }}>
                    {plural(item.label, item.count)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>

        <Section title={t.today.lessonsTitle}>
          {lessons.isError ? (
            <LoadError message={t.today.lessonsFailed} retryLabel={t.common.retry} onRetry={() => void lessons.refetch()} />
          ) : lessons.isPending ? (
            <View style={styles.cards}>
              <Skeleton height={220} radius={18} />
              <Skeleton height={160} radius={18} />
            </View>
          ) : todays.length === 0 ? (
            <View style={[styles.emptyCard, { borderColor: c.lineStrong }]}>
              <EmptyState
                icon="calendar"
                title={t.today.noLessons}
                body={t.today.noLessonsBody}
                action={
                  <Button size="sm" onPress={() => router.navigate('/(tabs)/(calendar)/calendar' as Href)}>
                    {t.today.openCalendar}
                  </Button>
                }
              />
            </View>
          ) : (
            <View style={styles.cards}>
              {todays.map((lesson) => (
                <LessonCard key={lesson.id} lesson={lesson} usage={usage} now={now} saving={saving} onMark={(seat, status) => void mark(seat, status)} />
              ))}
            </View>
          )}
        </Section>

        <UnmarkedSection dayKey={dayKey} open={unmarkedOpen} onOpenChange={setUnmarkedOpen} onLayout={remember('unmarked')} />
        <PaymentsSection dayKey={dayKey} onLayout={remember('payments')} />
        <EndingSection now={now} dayKey={dayKey} onLayout={remember('ending')} />
        <TomorrowSection lessons={tomorrows} isPending={lessons.isPending} isError={lessons.isError} onRetry={() => void lessons.refetch()} now={now} />
      </Screen>
    </>
  )
}

function LessonCard({ lesson, usage, now, saving, onMark }: { lesson: Lesson; usage: UsageMap | undefined; now: Date; saving: Set<string>; onMark: (seat: Seat, status: AttendanceStatus) => void }) {
  const c = useColors()
  const { t, fmt, date } = useI18n()
  const labels = useLabels()
  const title = useLessonTitle()
  const openLesson = useOpenLesson()
  const start = new Date(lesson.event_date)
  const running = now >= start && now < addMinutes(start, LESSON_MINUTES)
  const taken = lesson.seats.filter((seat) => holdsSeat(seat.status)).length
  const capacity = fmt(t.today.seats, { count: taken, capacity: SEATS_SHOWN })
  const time = date(start, { hour: '2-digit', minute: '2-digit' })

  return (
    <Card inset={60}>
      {/* The lesson itself opens from its head: children to add, time to change */}
      <Pressable
        onPress={() => openLesson(lesson.id)}
        accessibilityRole="button"
        accessibilityLabel={`${time} ${title(lesson)}, ${labels.ageGroup(lesson.age_group)}, ${capacity}`}
        style={({ pressed }) => [styles.lessonHead, pressed && { backgroundColor: c.well }]}
      >
        <View style={styles.lessonTop}>
          <Text variant="title" tabular>
            {time}
          </Text>
          <View style={styles.flex}>
            <View style={styles.lessonName}>
              <LessonShape type={lesson.event_type} />
              <Text variant="sub" weight="600" numberOfLines={1} style={styles.shrink}>
                {title(lesson)}
              </Text>
            </View>
            <AgeTablet group={lesson.age_group} label={labels.ageGroup(lesson.age_group)} />
          </View>
          {running && <Mark tone="accent">{t.today.now}</Mark>}
        </View>
        <SocketBoard capacity={SEATS_SHOWN} label={capacity} seats={lesson.seats.map((seat) => ({ id: seat.id, name: seat.child.student_name, status: seat.status }))} />
      </Pressable>
      {lesson.seats.length === 0 ? (
        <Text variant="sub" tone="ink3" style={styles.emptyLesson}>
          {t.today.emptyLesson}
        </Text>
      ) : (
        lesson.seats.map((seat) => {
          const child = seat.child
          return (
            <View key={seat.id} style={styles.seat}>
              <View style={styles.seatHead}>
                <Peg seat={{ id: seat.id, name: child.student_name, status: seat.status }} />
                <View style={styles.flex}>
                  <ChildName id={child.id} name={child.student_name}>
                    {child.is_active !== true && <Mark tone="neutral">{t.today.archived}</Mark>}
                    {isPaymentDue(child) && <Mark tone="action">{t.children.pendingPayment}</Mark>}
                  </ChildName>
                  {/* The child's beads: marking "attended" moves the string on in the same row */}
                  <View style={styles.usage}>
                    {child.student_age ? (
                      <Text variant="foot" tone="ink3" numberOfLines={1}>
                        {child.student_age}
                      </Text>
                    ) : null}
                    <UsageLine usage={usage?.[child.id]} />
                  </View>
                </View>
              </View>
              <AttendancePicker status={seat.status} onChange={(status) => onMark(seat, status)} disabled={saving.has(seat.id)} label={fmt(t.children.detail.lessonStatus, { name: child.student_name })} />
            </View>
          )
        })
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  top: { gap: 14, marginTop: -6 },
  summary: { paddingHorizontal: 4 },
  stripScroll: { marginHorizontal: -16 },
  strip: { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  pill: { height: 46, borderRadius: 14, borderWidth: 1, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9 },
  cards: { gap: 14 },
  emptyCard: { borderRadius: 18, borderWidth: 1, borderStyle: 'dashed' },
  lessonHead: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14, gap: 12 },
  lessonTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lessonName: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  emptyLesson: { paddingHorizontal: 16, paddingVertical: 14 },
  seat: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  seatHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  usage: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10, rowGap: 3, marginTop: 3 }
})
