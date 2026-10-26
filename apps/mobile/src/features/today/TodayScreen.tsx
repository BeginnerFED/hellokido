import { useEffect, useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type ScrollViewInstance, type ViewInstance } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated'
import { router, type Href } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { addDays, addMinutes, differenceInMinutes } from 'date-fns'
import { lessonsBetween, LessonError, SEATS_SHOWN, setAttendance, type AttendanceStatus, type Lesson, type Seat, type UsageMap } from '@hellokido/core/api'
import { holdsSeat } from '@hellokido/core/rules/attendance.js'
import { isPaymentDue, LESSON_MINUTES, lessonsLeftText, remainingText } from '@hellokido/core/view'
import { keys, useLabels, useUsageOf } from '../../data/queries'
import { useClock } from '../../lib/clock'
import { headerMenus, tasks, useOpenLesson } from '../../lib/navigation'
import { useI18n } from '../../providers/I18n'
import { tint, typeTone, useColors } from '../../theme/colors'
import { useActionMenu } from '../../ui/ActionMenu'
import { AttendancePicker } from '../../ui/AttendancePicker'
import { Avatar, EmptyState, firstNameOf, ListSkeleton, LiveMark, LoadError, Mark, Skeleton, TodoRow } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { Card, QuietCard, RoundButton, Screen, Section } from '../../ui/Screen'
import { LessonShape, ProgressTrack } from '../../ui/signature'
import { Text, together } from '../../ui/Text'
import { useToast } from '../../ui/Toast'
import { useLessonTitle } from '../../ui/UsageLine'
import { useEndingPackages, usePaymentsDue, useUnmarked } from './data'
import { ChildName, EndingSection, PaymentsSection, TomorrowSection, UnmarkedSection, useTomorrowReminders } from './sections'

type Open = 'unmarked' | 'payments' | 'ending' | 'tomorrow'

const lessonEnd = (lesson: Lesson) => addMinutes(new Date(lesson.event_date), LESSON_MINUTES)

/** "Ada, Defne, Aras" with "+2" for the rest: the children a waiting job is about. */
const names = (list: string[], max = 3) => {
  const unique = [...new Set(list)]
  return unique.length > max ? `${unique.slice(0, max).join(', ')} +${unique.length - max}` : unique.join(', ')
}

/**
 * The working day as a felt board: every lesson of the day as a card in its type's colour with
 * attendance in one tap, in a row that opens on the running lesson (or the next one; after the last,
 * the last one), and what waits for the admin as one card of jobs, each opening its list.
 */
export function TodayScreen() {
  const { t, plural, fmt, date } = useI18n()
  const i18n = useI18n()
  const toast = useToast()
  const client = useQueryClient()
  const { now, dayKey } = useClock()
  const menu = useActionMenu()
  const insets = useSafeAreaInsets()
  const scroll = useRef<ScrollViewInstance>(null)
  const [open, setOpen] = useState<Set<Open>>(() => new Set())
  const pendingJump = useRef<Open | null>(null)

  const todayStart = useMemo(() => new Date(`${dayKey}T00:00:00`), [dayKey])
  const tomorrowStart = useMemo(() => addDays(todayStart, 1), [todayStart])
  const rangeEnd = useMemo(() => addDays(todayStart, 2), [todayStart])
  const key = keys.lessons(todayStart.toISOString(), rangeEnd.toISOString())
  const lessons = useQuery({ queryKey: key, queryFn: () => lessonsBetween(todayStart, rangeEnd) })

  const todays = useMemo(
    () => (lessons.data ?? []).filter((lesson) => new Date(lesson.event_date) < tomorrowStart).sort((a, b) => a.event_date.localeCompare(b.event_date)),
    [lessons.data, tomorrowStart]
  )
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

  // The hero: the running lesson, else the next one. Once the day is over, the last lesson whose
  // attendance is still missing, else the last one with children, else the last one.
  const running = todays.find((lesson) => now >= new Date(lesson.event_date) && now < lessonEnd(lesson))
  const upcoming = todays.find((lesson) => new Date(lesson.event_date) > now)
  const lastOf = (test: (lesson: Lesson) => boolean) => [...todays].reverse().find(test)
  const hero =
    running ??
    upcoming ??
    lastOf((lesson) => lesson.seats.some((seat) => seat.status === 'scheduled')) ??
    lastOf((lesson) => lesson.seats.length > 0) ??
    todays[todays.length - 1]
  const phase: Phase = running ? 'running' : upcoming ? 'next' : 'done'
  // Lessons of today that have ended (other than the hero), whose missing attendance waits below
  const earlier = todays.filter((lesson) => lesson.id !== hero?.id && lessonEnd(lesson) <= now)

  const childCount = new Set(todays.flatMap((lesson) => lesson.seats.map((seat) => seat.registration_id))).size
  const weekday = date(now, { weekday: 'long' })
  const title = `${weekday.charAt(0).toLocaleUpperCase(i18n.tag)}${weekday.slice(1)}, ${date(now, { day: 'numeric', month: 'long' })}`
  const summary = !lessons.data
    ? undefined
    : todays.length === 0
      ? t.today.noLessons
      : fmt(phase === 'done' ? t.today.board.summaryPast : t.today.board.summary, {
          lessons: together(plural(t.today.lessonCount, todays.length)),
          children: together(plural(t.today.childCount, childCount))
        })

  // --- what waits ----------------------------------------------------------------------------
  const unmarked = useUnmarked(dayKey).query
  const payments = usePaymentsDue()
  const ending = useEndingPackages()
  const reminders = useTomorrowReminders(tomorrows, now)
  const earlierUnmarked = earlier.flatMap((lesson) => lesson.seats.filter((seat) => seat.status === 'scheduled').map((seat) => ({ lesson, seat })))

  const toggle = async (id: Open) => {
    const opening = !open.has(id)
    setOpen((current) => {
      const next = new Set(current)
      if (opening) next.add(id)
      else next.delete(id)
      return next
    })
    // The list opens below; the page moves to it once it has its place
    if (opening) pendingJump.current = id
  }
  const jump = async (id: Open) => {
    const target = places.current[id]
    const content = scroll.current?.getInnerViewRef()
    if (!target || !content) return
    const still = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false)
    // Its head lands just under the status bar
    target.measureLayout(content, (_x, y) => scroll.current?.scrollTo({ y: Math.max(y - insets.top - 6, 0), animated: !still }))
  }
  // Each list sits in a place of its own, measured against the page once it has opened
  const places = useRef<Partial<Record<Open, ViewInstance | null>>>({})
  const place = (id: Open) => ({
    ref: (view: ViewInstance | null) => {
      places.current[id] = view
    },
    onLayout: (event: { nativeEvent: { layout: { height: number } } }) => {
      if (pendingJump.current === id && event.nativeEvent.layout.height > 0) {
        pendingJump.current = null
        void jump(id)
      }
    },
    style: open.has(id) ? styles.place : undefined
  })
  const close = (id: Open) => () =>
    setOpen((current) => {
      const next = new Set(current)
      next.delete(id)
      return next
    })

  const jobs: { id: Open; row: Parameters<typeof TodoRow>[0] }[] = []
  const pastCount = unmarked.data?.length ?? 0
  const unmarkedCount = pastCount + earlierUnmarked.length
  if (unmarkedCount > 0) {
    // The most recent lesson first: today's ended ones, then the last day with gaps
    const first = earlierUnmarked.length > 0 ? earlierUnmarked[earlierUnmarked.length - 1].lesson : null
    const lessonIds = new Set([...earlierUnmarked.map((row) => row.lesson.id), ...(unmarked.data ?? []).map((row) => row.events.id)])
    const who = names([...earlierUnmarked.map((row) => firstNameOf(row.seat.child.student_name)), ...(unmarked.data ?? []).map((row) => firstNameOf(row.child.student_name))])
    const latest = first?.event_date ?? [...(unmarked.data ?? [])].sort((a, b) => b.events.event_date.localeCompare(a.events.event_date))[0]?.events.event_date
    const when = lessonIds.size > 1 ? plural(t.today.board.inLessons, lessonIds.size) : latest ? date(latest, { weekday: 'long', hour: '2-digit', minute: '2-digit' }) : ''
    jobs.push({
      id: 'unmarked',
      row: {
        icon: 'clipboard',
        title: plural(t.today.strip.unmarked, unmarkedCount),
        subtitle: [when, who].filter(Boolean).join(', '),
        alert: true,
        action: { label: t.today.board.enter, onPress: () => void toggle('unmarked') }
      }
    })
  }
  if (payments.total > 0) {
    const single = payments.total === 1 ? (payments.packages[0] ?? payments.byId.get(payments.fees[0]?.registrationId ?? '')) : undefined
    const fee = payments.total === 1 ? payments.fees[0] : undefined
    jobs.push({
      id: 'payments',
      row: {
        icon: 'lira',
        title: plural(t.today.strip.payments, payments.total),
        subtitle: names([...payments.packages.map((child) => child.student_name), ...payments.fees.map((line) => payments.byId.get(line.registrationId!)?.student_name ?? '')].filter(Boolean).map(firstNameOf)),
        alert: true,
        action: single
          ? { label: t.today.payments.collect, onPress: () => tasks.payment({ registrationId: single.id, choice: 'collect', entryId: fee?.id }) }
          : { label: t.today.board.see, onPress: () => void toggle('payments') }
      }
    })
  }
  if (ending.rows.length > 0) {
    const sorted = [...ending.rows].sort((a, b) => a.remaining - b.remaining)
    const single = ending.rows.length === 1 ? ending.rows[0].child : undefined
    jobs.push({
      id: 'ending',
      row: {
        icon: 'renew',
        title: plural(t.today.strip.ending, ending.rows.length),
        // Names like the other rows; the lessons left only fit when there is one child
        subtitle: single
          ? `${firstNameOf(single.student_name)}: ${lessonsLeftText(i18n, sorted[0].remaining)}`
          : names(sorted.map((row) => firstNameOf(row.child.student_name))),
        alert: ending.rows.some((row) => row.remaining === 0),
        action: single
          ? { label: t.today.ending.renew, onPress: () => tasks.payment({ registrationId: single.id, choice: 'renew' }) }
          : { label: t.today.board.see, onPress: () => void toggle('ending') }
      }
    })
  }
  if (reminders.items.length > 0) {
    const { items, sent, next } = reminders
    jobs.push({
      id: 'tomorrow',
      row: {
        icon: 'bell',
        title: t.today.board.tomorrowReminders,
        subtitle: !next ? t.messages.inOrder.done : sent > 0 ? fmt(t.today.tomorrow.progress, { sent, total: items.length }) : plural(t.today.board.toParents, items.length),
        onPress: () => void toggle('tomorrow'),
        expanded: open.has('tomorrow'),
        action: next
          ? { label: t.today.board.send, accessibilityLabel: fmt(t.messages.inOrder.label, { name: next.seat.child.student_name }), onPress: () => reminders.send(next) }
          : undefined
      }
    })
  }
  const waitingReady = !payments.registrations.isPending && !unmarked.isPending && ending.ready

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
      {menu.element}
      <Screen
        scrollRef={scroll}
        onRefresh={refresh}
        title={title}
        subtitle={summary}
        // The iPhone opens "+" from its own bar, as its own dropdown; Android keeps the round button
        bar={{ options: headerMenus([{ label: t.shell.quickAdd.title, icon: 'add', items: quickAdd }]), buttons: 1 }}
        actions={Platform.OS === 'ios' ? undefined : <RoundButton icon="add" label={t.shell.quickAdd.title} onPress={() => menu.open(t.shell.quickAdd.title, quickAdd)} />}
        gap={0}
      >
        {lessons.isError ? (
          <LoadError message={t.today.lessonsFailed} retryLabel={t.common.retry} onRetry={() => void lessons.refetch()} />
        ) : lessons.isPending ? (
          <View style={styles.skeleton}>
            <Skeleton height={300} radius={26} />
          </View>
        ) : !hero ? (
          <Card padded>
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
          </Card>
        ) : (
          <DayCarousel lessons={todays} hero={hero} next={upcoming} now={now} usage={usage} saving={saving} onMark={(seat, status) => void mark(seat, status)} />
        )}

        <Section title={t.today.board.waitingTitle} aside={jobs.length > 0 ? plural(t.today.board.jobs, jobs.length) : undefined} style={styles.waiting}>
          {!waitingReady && jobs.length === 0 ? (
            <ListSkeleton rows={2} />
          ) : jobs.length === 0 ? (
            payments.registrations.isError ? (
              <LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={() => void payments.registrations.refetch()} />
            ) : (
              <QuietCard>{t.today.nothingWaiting}</QuietCard>
            )
          ) : (
            <Card style={styles.todoCard}>
              {jobs.map((job) => (
                <TodoRow key={job.id} {...job.row} />
              ))}
            </Card>
          )}
        </Section>

        <View {...place('unmarked')}>
          <UnmarkedSection
            dayKey={dayKey}
            today={earlier}
            savingToday={saving}
            onMarkToday={(seat, status) => void mark(seat, status)}
            open={open.has('unmarked')}
            onClose={close('unmarked')}
          />
        </View>
        <View {...place('payments')}>
          <PaymentsSection dayKey={dayKey} open={open.has('payments')} onClose={close('payments')} />
        </View>
        <View {...place('ending')}>
          <EndingSection now={now} dayKey={dayKey} open={open.has('ending')} onClose={close('ending')} />
        </View>
        <View {...place('tomorrow')}>
          <TomorrowSection lessons={tomorrows} reminders={reminders} open={open.has('tomorrow')} onClose={close('tomorrow')} />
        </View>
      </Screen>
    </>
  )
}

type Phase = 'running' | 'next' | 'later' | 'done'

const GAP = 10
// The card in the middle of the row leaves this much of each neighbour in sight
const PEEK = 18
// After a swipe of their own, the row stays where the admin left it for this long
const LEFT_ALONE = 2 * 60_000

/**
 * The whole day as a row of felt cards to swipe, as the App Store shows its stories: it opens on the
 * lesson of the moment, with the earlier ones to the left and the later ones to the right. Once a
 * swipe settles the row takes the height of the card in view, so what follows never leaves a gap.
 */
function DayCarousel({
  lessons,
  hero,
  next,
  now,
  usage,
  saving,
  onMark
}: {
  lessons: Lesson[]
  hero: Lesson
  next: Lesson | undefined
  now: Date
  usage: UsageMap | undefined
  saving: Set<string>
  onMark: (seat: Seat, status: AttendanceStatus) => void
}) {
  const width = useWindowDimensions().width
  const still = useReducedMotion()
  const row = useRef<ScrollViewInstance>(null)
  const count = lessons.length
  const card = count === 1 ? width - 32 : width - 2 * (PEEK + GAP)
  const step = card + GAP
  const end = Math.max(0, 32 + count * step - GAP - width)
  // The first card keeps the page's edge, the last one too; those between sit in the middle
  const offsets = lessons.map((_, index) => Math.min(end, Math.max(0, 16 + index * step - (width - card) / 2)))
  const heroIndex = Math.max(0, lessons.findIndex((lesson) => lesson.id === hero.id))

  // The height changes only once the row is still: on Android a new height mid-swipe stops the snap halfway
  const height = useSharedValue(0)
  const frame = useAnimatedStyle(() => (height.get() > 0 ? { height: height.get() } : {}))
  const measured = useRef<number[]>([])
  const current = useRef(heroIndex)
  const fit = (animated: boolean) => {
    const list = measured.current
    if (list.length !== count || list.includes(0)) return
    const target = list[Math.min(current.current, count - 1)]
    height.set(animated && !still && height.get() > 0 ? withTiming(target, { duration: 240, easing: Easing.out(Easing.cubic) }) : target)
  }
  const nearest = (x: number) => offsets.reduce((best, offset, index) => (Math.abs(offset - x) < Math.abs(offsets[best] - x) ? index : best), 0)
  const settle = (x: number) => {
    current.current = nearest(x)
    fit(true)
  }

  const shown = useRef<string | null>(null)
  const touched = useRef(0)
  const show = (animated: boolean) => {
    shown.current = hero.id
    current.current = heroIndex
    row.current?.scrollTo({ x: offsets[heroIndex], animated })
    if (!animated) fit(false)
    else setTimeout(() => fit(true), 400)
  }
  // As the day moves on the row follows the lesson of the moment, unless the admin is looking elsewhere
  useEffect(() => {
    if (shown.current !== null && shown.current !== hero.id && Date.now() - touched.current > LEFT_ALONE) show(!still)
  }, [hero.id])

  const phaseOf = (lesson: Lesson): Phase =>
    lessonEnd(lesson) <= now ? 'done' : new Date(lesson.event_date) <= now ? 'running' : lesson.id === next?.id ? 'next' : 'later'

  return (
    <Animated.View style={[styles.carousel, frame]}>
      <ScrollView
        ref={row}
        horizontal
        scrollEnabled={count > 1}
        showsHorizontalScrollIndicator={false}
        // A tap on the iPhone's status bar still takes the page to its top
        scrollsToTop={false}
        contentInsetAdjustmentBehavior="never"
        snapToOffsets={offsets}
        decelerationRate="fast"
        disableIntervalMomentum
        onScrollBeginDrag={() => {
          touched.current = Date.now()
        }}
        onScrollEndDrag={(event) => {
          // Let go right on a card, the row has no glide left to wait for
          const x = event.nativeEvent.contentOffset.x
          const index = nearest(x)
          if (Math.abs(offsets[index] - x) < 1) settle(x)
        }}
        onMomentumScrollEnd={(event) => settle(event.nativeEvent.contentOffset.x)}
        onContentSizeChange={() => {
          if (shown.current === null) show(false)
        }}
        // The row keeps the tallest card's height and the frame around it clips
        style={styles.carouselScroll}
        contentContainerStyle={styles.carouselRow}
      >
        {lessons.map((lesson, index) => (
          <View
            key={lesson.id}
            style={{ width: card }}
            onLayout={(event) => {
              const own = event.nativeEvent.layout.height
              measured.current = Array.from({ length: count }, (_, at) => (at === index ? own : (measured.current[at] ?? 0)))
              fit(true)
            }}
          >
            <HeroLesson lesson={lesson} phase={phaseOf(lesson)} now={now} usage={usage} saving={saving} onMark={onMark} />
          </View>
        ))}
      </ScrollView>
    </Animated.View>
  )
}

/**
 * The lesson of the moment as a card in its type's felt: the time, a live mark, the type line with
 * age group and seats, how far it has run (or what attendance is missing once it is over), then
 * one attendance row per child. The head opens the lesson.
 */
function HeroLesson({ lesson, phase, now, usage, saving, onMark }: { lesson: Lesson; phase: Phase; now: Date; usage: UsageMap | undefined; saving: Set<string>; onMark: (seat: Seat, status: AttendanceStatus) => void }) {
  const c = useColors()
  const i18n = useI18n()
  const { t, fmt, plural, date } = i18n
  const labels = useLabels()
  const title = useLessonTitle()
  const openLesson = useOpenLesson()
  // With the phone's larger text the picker goes under the name, so the name and its line keep their words whole
  const stacked = useWindowDimensions().fontScale > 1.15
  const tone = typeTone(c, lesson.event_type)
  const start = new Date(lesson.event_date)
  const end = lessonEnd(lesson)
  const time = `${date(start, { hour: '2-digit', minute: '2-digit' })}–${date(end, { hour: '2-digit', minute: '2-digit' })}`
  const taken = lesson.seats.filter((seat) => holdsSeat(seat.status)).length
  const seats = fmt(t.today.lessonsCard.seatsShort, { count: taken, capacity: SEATS_SHOWN })
  const meta = [labels.ageGroup(lesson.age_group), seats].filter(Boolean).join(', ')
  const passed = Math.max(0, differenceInMinutes(now, start))
  const toStart = differenceInMinutes(start, now)
  const marked = lesson.seats.filter((seat) => seat.status !== 'scheduled').length
  const missing = lesson.seats.length - marked
  // A first name is enough on the card, unless two children of the lesson share it
  const firsts = lesson.seats.map((seat) => firstNameOf(seat.child.student_name))

  return (
    <View style={[styles.hero, { backgroundColor: tone.felt }]}>
      <Pressable
        onPress={() => openLesson(lesson.id)}
        accessibilityRole="button"
        accessibilityLabel={`${time}, ${title(lesson)}, ${meta}`}
        style={({ pressed }) => [styles.heroHead, pressed && { opacity: 0.7 }]}
      >
        <View style={styles.heroTop}>
          <Text variant="hero" tabular numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[styles.shrink, { color: tone.ink }]}>
            {time}
          </Text>
          <LiveMark live={phase === 'running'} type={lesson.event_type}>
            {phase === 'running' ? t.today.now : phase === 'next' ? t.today.board.next : phase === 'later' ? t.today.board.later : t.today.board.done}
          </LiveMark>
        </View>
        <View style={styles.heroType}>
          <LessonShape type={lesson.event_type} />
          <Text variant="headline" numberOfLines={1} style={[styles.typeName, { color: tone.ink }]}>
            {title(lesson)}
          </Text>
          <Text numberOfLines={1} style={[styles.typeMeta, { color: tone.ink }]}>
            {meta}
          </Text>
        </View>
      </Pressable>

      {phase === 'running' && (
        <View style={styles.progress}>
          <ProgressTrack share={passed / LESSON_MINUTES} type={lesson.event_type} />
          <View style={styles.progressWords}>
            <Text tabular style={[styles.progressText, { color: tone.ink }]}>
              {fmt(t.today.board.elapsed, { count: passed })}
            </Text>
            <Text tabular style={[styles.progressText, { color: tone.ink }]}>
              {fmt(t.today.board.left, { count: Math.max(0, LESSON_MINUTES - passed) })}
            </Text>
          </View>
        </View>
      )}
      {phase === 'next' && toStart <= 60 && (
        <Text tabular style={[styles.progressText, styles.startsIn, { color: tone.ink }]}>
          {fmt(t.today.board.startsIn, { count: Math.max(1, toStart) })}
        </Text>
      )}
      {phase === 'done' && lesson.seats.length > 0 && (
        <View style={[styles.progressWords, styles.startsIn]}>
          <Text style={[styles.progressText, styles.shrink, { color: tone.ink }]}>{missing > 0 ? plural(t.today.board.missing, missing) : t.today.lessonsCard.done}</Text>
          <Text tabular style={[styles.progressText, { color: tone.ink }]}>
            {fmt(t.today.lessonsCard.marked, { marked, total: lesson.seats.length })}
          </Text>
        </View>
      )}

      <View style={styles.heroRows}>
        {lesson.seats.length === 0 ? (
          <Text variant="sub" style={[styles.heroEmpty, { color: tone.ink }]}>
            {t.today.emptyLesson}
          </Text>
        ) : (
          lesson.seats.map((seat, index) => {
            const child = seat.child
            const first = firsts[index]
            const name = firsts.filter((other) => other === first).length > 1 ? child.student_name : first
            const left = usage?.[child.id]
            const low = left && !left.isFree && (left.remaining ?? 0) <= 2
            return (
              <View key={seat.id} style={[styles.attRow, stacked && styles.attRowStacked, index > 0 && { borderTopWidth: 1, borderTopColor: tint(tone.ink, 0.12) }]}>
                <View style={[styles.attWho, !stacked && styles.flex]}>
                  <Avatar name={child.student_name} size={36} type={lesson.event_type} />
                  <View style={styles.flex}>
                    <ChildName id={child.id} name={name} />
                    {child.is_active !== true ? (
                      <Mark tone="neutral">{t.today.archived}</Mark>
                    ) : isPaymentDue(child) ? (
                      <Mark tone="action">{t.children.pendingPayment}</Mark>
                    ) : (
                      <Text variant="sub" numberOfLines={2} style={[styles.left, { color: low ? c.amberInk : tone.ink, opacity: low ? 1 : 0.82 }]}>
                        {left ? remainingText(i18n, left) : ' '}
                      </Text>
                    )}
                  </View>
                </View>
                <AttendancePicker
                  compact={!stacked}
                  type={lesson.event_type}
                  status={seat.status}
                  onChange={(status) => onMark(seat, status)}
                  disabled={saving.has(seat.id)}
                  label={fmt(t.children.detail.lessonStatus, { name: child.student_name })}
                />
              </View>
            )
          })
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  hero: { borderRadius: 26, paddingTop: 18, paddingHorizontal: 18, paddingBottom: 8 },
  heroHead: { gap: 6 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  heroType: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  typeName: { flexShrink: 1 },
  typeMeta: { fontSize: 15, lineHeight: 20, opacity: 0.85, flexShrink: 2 },
  progress: { marginTop: 16, gap: 6 },
  progressWords: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  progressText: { fontSize: 13, lineHeight: 17, opacity: 0.9 },
  startsIn: { marginTop: 10 },
  heroRows: { marginTop: 8 },
  heroEmpty: { paddingVertical: 12, opacity: 0.85 },
  attRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  attRowStacked: { flexDirection: 'column', alignItems: 'stretch' },
  attWho: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // What is left of the package, a step under the name
  left: { fontSize: 12.5, lineHeight: 16 },
  skeleton: { marginTop: 10 },
  // The row runs to the screen's edges, so the neighbouring cards show there
  carousel: { marginHorizontal: -16, overflow: 'hidden' },
  carouselScroll: { flexGrow: 0, flexShrink: 0 },
  carouselRow: { paddingHorizontal: 16, gap: GAP, alignItems: 'flex-start' },
  waiting: { marginTop: 22 },
  todoCard: { paddingVertical: 2 },
  place: { marginTop: 22 }
})
