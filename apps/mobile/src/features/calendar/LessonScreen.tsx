import { useMemo, useRef, useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import { router, Stack } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { addMinutes, differenceInMinutes, startOfDay } from 'date-fns'
import {
  deleteLesson,
  loadLesson,
  LESSON_ROW_LIMIT,
  LessonError,
  saveLesson,
  SEATS_SHOWN,
  setAttendance,
  type AttendanceStatus,
  type LessonDetail,
  type LessonType
} from '@hellokido/core/api'
import { holdsSeat, isRecordedAttendance } from '@hellokido/core/rules/attendance.js'
import { isPaymentDue, LESSON_MINUTES, remainingText } from '@hellokido/core/view'
import { keys, useLabels, useRefresh, useUsageOf } from '../../data/queries'
import { useClock } from '../../lib/clock'
import { headerButton, tasks } from '../../lib/navigation'
import { useI18n } from '../../providers/I18n'
import { typeTone, useColors } from '../../theme/colors'
import { AttendancePicker } from '../../ui/AttendancePicker'
import { EmptyState, LiveMark, LoadError, Mark, Skeleton } from '../../ui/Bits'
import { Button, IconButton } from '../../ui/Button'
import { ActionRow, Card, GroupFooter, Screen, Section } from '../../ui/Screen'
import { LessonShape, Peg, PEG, ProgressTrack } from '../../ui/signature'
import { DOT, Text } from '../../ui/Text'
import { useToast } from '../../ui/Toast'
import { useLessonTitle } from '../../ui/UsageLine'
import { ChildName } from '../today/sections'
import { dayTitle, GroupNote } from './parts'

type Seat = LessonDetail['seats'][number]

// How far the page scrolls before its bar takes the lesson's name: past the head card's first lines
const TITLE_AFTER = 110

/** One lesson: who is in it with their attendance, children to add or take out, and the lesson's own changes. */
export function LessonScreen({ id }: { id: string }) {
  const { t } = useI18n()
  // Set once the lesson is deleted here: the page stops reading it while it goes away
  const [gone, setGone] = useState(false)
  const detail = useQuery({ queryKey: keys.lesson(id), queryFn: () => loadLesson(id), enabled: !gone })

  if (gone) return <Stack.Screen options={{ title: '' }} />
  if (detail.isError) {
    return (
      <Screen>
        <Stack.Screen options={{ title: '' }} />
        {detail.error instanceof LessonError ? (
          <Card padded>
            <EmptyState
              icon="calendar"
              title={t.calendar.lesson.notFound}
              action={
                <Button size="sm" onPress={() => router.back()}>
                  {t.common.back}
                </Button>
              }
            />
          </Card>
        ) : (
          <LoadError message={t.calendar.lesson.loadFailed} retryLabel={t.common.retry} onRetry={() => void detail.refetch()} />
        )}
      </Screen>
    )
  }
  if (!detail.data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: '' }} />
        <View style={styles.waiting}>
          <Skeleton height={168} radius={26} />
          <Skeleton height={20} width="40%" style={styles.waitingHead} />
          <Skeleton height={240} radius={26} />
        </View>
      </Screen>
    )
  }
  return <LessonPage detail={detail.data} onRefresh={() => detail.refetch()} onGone={() => setGone(true)} />
}

function LessonPage({ detail, onRefresh, onGone }: { detail: LessonDetail; onRefresh: () => Promise<unknown>; onGone: () => void }) {
  const c = useColors()
  const i18n = useI18n()
  const { t, fmt, plural, date } = i18n
  const labels = useLabels()
  const title = useLessonTitle()
  const toast = useToast()
  const refresh = useRefresh()
  const client = useQueryClient()
  const { now } = useClock()
  const [saving, setSaving] = useState<Set<string>>(() => new Set())
  // Answers on their way, read at once: a second tap before the next render never sends twice
  const inFlight = useRef(new Set<string>())
  const [removing, setRemoving] = useState<string | null>(null)
  // The bar takes the lesson's name once its card has scrolled away, as the phone's own detail pages
  const [named, setNamed] = useState(false)

  const lesson = detail.lesson
  const key = keys.lesson(lesson.id)
  const tone = typeTone(c, lesson.event_type)
  const start = new Date(lesson.event_date)
  const end = addMinutes(start, LESSON_MINUTES)
  const dayPassed = start < startOfDay(now)
  const running = now >= start && now < end
  const ended = now >= end
  const seats = useMemo(() => [...detail.seats].sort((a, b) => a.child.student_name.localeCompare(b.child.student_name, 'tr')), [detail.seats])
  const usage = useUsageOf(useMemo(() => seats.map((seat) => seat.child), [seats]))
  const holders = seats.filter((seat) => holdsSeat(seat.status)).length
  const unmarked = dayPassed ? seats.filter((seat) => seat.status === 'scheduled').length : 0
  const recorded = seats.filter((seat) => isRecordedAttendance(seat.status)).length
  const passed = Math.max(0, differenceInMinutes(now, start))

  const patch = (seatId: string, status: AttendanceStatus) =>
    client.setQueryData<LessonDetail>(key, (current) => current && { ...current, seats: current.seats.map((seat) => (seat.id === seatId ? { ...seat, status } : seat)) })

  // Optimistic, as on Today: the answer shows at once and goes back if it could not be saved
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
      if (error instanceof LessonError && error.code === 'not_found') {
        toast({ tone: 'info', title: t.today.lessonGone })
        void onRefresh()
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
    refresh.attendance(seat.registration_id)
    void client.invalidateQueries({ queryKey: ['lessons'] })
  }

  // Taking a child out is a save of the lesson without them, worked out against what this page shows
  const takeOut = async (seat: Seat, confirmed: boolean) => {
    setRemoving(seat.registration_id)
    try {
      await saveLesson({
        lessonId: lesson.id,
        snapshot: new Map(detail.seats.map((row) => [row.registration_id, { participantId: row.id, status: row.status, name: row.child.student_name }])),
        fields: { start, ageGroup: lesson.age_group, type: lesson.event_type as LessonType, description: lesson.custom_description },
        children: detail.seats.filter((row) => row.registration_id !== seat.registration_id).map((row) => ({ registrationId: row.registration_id, status: row.status })),
        timeChanged: false,
        maxCapacity: lesson.max_capacity ?? LESSON_ROW_LIMIT,
        removalConfirmed: confirmed
      })
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      toast({ title: fmt(t.mobile.childRemoved, { name: seat.child.student_name }) })
      refresh.lessons()
      refresh.attendance(seat.registration_id)
    } catch (error) {
      // Attendance was marked meanwhile on another phone: ask again with what that means
      if (error instanceof LessonError && error.code === 'needs_confirmation') return askTakeOut(seat, true)
      if (error instanceof LessonError && error.code === 'not_found') {
        toast({ tone: 'info', title: t.calendar.lesson.notFound })
        refresh.lessons()
      } else {
        toast({ tone: 'error', title: t.calendar.lesson.saveFailed })
        void onRefresh()
      }
    } finally {
      setRemoving(null)
    }
  }

  const askTakeOut = (seat: Seat, recordedNow = isRecordedAttendance(seat.status)) =>
    Alert.alert(
      fmt(t.mobile.removeChildTitle, { name: seat.child.student_name }),
      recordedNow ? fmt(t.calendar.lesson.removeRecorded, { names: seat.child.student_name }) : undefined,
      [
        { text: t.common.cancel, style: 'cancel' },
        { text: recordedNow ? t.calendar.lesson.removeAnyway : t.mobile.removeChild, style: 'destructive', onPress: () => void takeOut(seat, recordedNow) }
      ]
    )

  const remove = async () => {
    try {
      await deleteLesson(lesson.id)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      toast({ title: t.calendar.lesson.deleted })
      onGone()
      router.back()
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

  const time = `${date(start, { hour: '2-digit', minute: '2-digit' })}–${date(end, { hour: '2-digit', minute: '2-digit' })}`
  const meta = [labels.ageGroup(lesson.age_group), fmt(t.today.lessonsCard.seatsShort, { count: holders, capacity: SEATS_SHOWN })].filter(Boolean).join(', ')

  return (
    <>
      <Stack.Screen options={{ title: named ? title(lesson) : '', ...headerButton(c, t.mobile.editLesson, 'edit', () => tasks.lesson({ id: lesson.id })) }} />
      <Screen
        onRefresh={onRefresh}
        gap={0}
        onScroll={(event) => {
          const past = event.nativeEvent.contentOffset.y > TITLE_AFTER
          if (past !== named) setNamed(past)
        }}
      >
        {/* The lesson in its type's felt, as on Today: the day, the hours, what and for whom */}
        <View style={[styles.hero, { backgroundColor: tone.felt }]}>
          <Text variant="sub" weight="500" numberOfLines={1} style={[styles.heroDay, { color: tone.ink }]}>
            {dayTitle(i18n, start, now)}
          </Text>
          <View style={styles.heroTop}>
            <Text variant="hero" tabular numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} accessibilityRole="header" style={[styles.shrink, { color: tone.ink }]}>
              {time}
            </Text>
            {(running || ended) && (
              <LiveMark live={running} type={lesson.event_type}>
                {running ? t.today.now : t.today.board.done}
              </LiveMark>
            )}
          </View>
          <View style={styles.heroType}>
            <LessonShape type={lesson.event_type} />
            <Text variant="headline" numberOfLines={2} style={[styles.typeName, { color: tone.ink }]}>
              {title(lesson)}
            </Text>
          </View>
          <Text tabular numberOfLines={2} style={[styles.typeMeta, { color: holders > SEATS_SHOWN ? c.negativeInk : tone.ink }]}>
            {meta}
          </Text>
          {running && (
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
        </View>

        {(unmarked > 0 || holders > SEATS_SHOWN) && (
          <View style={styles.notes}>
            {unmarked > 0 && <GroupNote tone="actionInk">{plural(t.calendar.unmarked, unmarked)}</GroupNote>}
            {holders > SEATS_SHOWN && <GroupNote tone="actionInk">{fmt(t.calendar.lesson.seats, { count: holders })}</GroupNote>}
          </View>
        )}

        <Section title={t.calendar.lesson.children} aside={seats.length > 0 ? `${holders}/${SEATS_SHOWN}` : undefined} style={styles.section}>
          <Card>
            {seats.map((seat) => {
              const child = seat.child
              const overdue = dayPassed && seat.status === 'scheduled'
              const busy = removing === seat.registration_id
              const left = usage?.[child.id]
              const low = Boolean(left && !left.isFree && (left.remaining ?? 0) <= 2)
              return (
                <View key={seat.id} style={[styles.seat, busy && styles.busy]}>
                  <View style={styles.seatHead}>
                    <Peg seat={{ id: seat.id, name: child.student_name, status: seat.status, overdue }} />
                    <View style={styles.flex}>
                      <ChildName id={child.id} name={child.student_name}>
                        {child.is_active !== true ? (
                          <Mark tone="neutral">{t.today.archived}</Mark>
                        ) : isPaymentDue(child) ? (
                          <Mark tone="action">{t.children.pendingPayment}</Mark>
                        ) : null}
                      </ChildName>
                      {/* Age, then the lessons left; amber when two or fewer are left, as on Today */}
                      {Boolean(child.student_age || left) && (
                        <Text variant="sub" tone="ink3" numberOfLines={2}>
                          {child.student_age ?? ''}
                          {child.student_age && left ? DOT : ''}
                          {left ? (
                            <Text variant="sub" weight={low ? '500' : '400'} tone={low ? 'amberInk' : 'ink3'}>
                              {remainingText(i18n, left)}
                            </Text>
                          ) : null}
                        </Text>
                      )}
                    </View>
                    <IconButton
                      icon="close"
                      label={fmt(t.calendar.lesson.remove, { name: child.student_name })}
                      variant="plain"
                      size={30}
                      color={c.ink3}
                      disabled={busy}
                      onPress={() => askTakeOut(seat)}
                      style={styles.takeOut}
                    />
                  </View>
                  <AttendancePicker
                    status={seat.status}
                    onChange={(status) => void mark(seat, status)}
                    disabled={saving.has(seat.id) || busy}
                    label={fmt(t.children.detail.lessonStatus, { name: child.student_name })}
                  />
                </View>
              )
            })}
            <ActionRow icon="personAdd" label={t.calendar.lesson.addChildren} lead={seats.length > 0 ? PEG : undefined} onPress={() => tasks.lessonChildren(lesson.id)} />
          </Card>
          {seats.length === 0 && <GroupFooter>{t.calendar.lesson.noChildren}</GroupFooter>}
        </Section>

        <View style={styles.tail}>
          <Card>
            <ActionRow icon="copy" label={t.mobile.copyLesson} onPress={() => tasks.lesson({ id: lesson.id, copy: true })} />
          </Card>
          {/* Last and on its own, as the phone's own "Delete Event" */}
          <Card>
            <ActionRow icon="delete" label={t.calendar.lesson.delete} destructive onPress={askDelete} />
          </Card>
        </View>
      </Screen>
    </>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  waiting: { gap: 0 },
  waitingHead: { marginTop: 26, marginBottom: 12, marginLeft: 4 },
  hero: { borderRadius: 26, padding: 18, paddingBottom: 18 },
  heroDay: { opacity: 0.85, marginBottom: 2 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  heroType: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0, marginTop: 6 },
  typeName: { flexShrink: 1 },
  typeMeta: { fontSize: 15, lineHeight: 20, opacity: 0.85, marginTop: 2 },
  progress: { marginTop: 16, gap: 6 },
  progressWords: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  progressText: { fontSize: 13, lineHeight: 17, opacity: 0.9 },
  notes: { gap: 6, marginTop: 14 },
  section: { marginTop: 24 },
  // The attendance track keeps the same 16 points on both sides; the round close button leans out instead
  seat: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  seatHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  takeOut: { marginRight: -6 },
  busy: { opacity: 0.5 },
  tail: { marginTop: 22, gap: 12 }
})
