import { useMemo, useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import { router, Stack } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { addMinutes, startOfDay } from 'date-fns'
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
import { isPaymentDue, LESSON_MINUTES } from '@hellokido/core/view'
import { keys, useLabels, useRefresh, useUsageOf } from '../../data/queries'
import { useClock } from '../../lib/clock'
import { headerMenu, tasks } from '../../lib/navigation'
import { useI18n } from '../../providers/I18n'
import { useColors } from '../../theme/colors'
import { useActionMenu } from '../../ui/ActionMenu'
import { AttendancePicker } from '../../ui/AttendancePicker'
import { EmptyState, LoadError, Mark, Notice, Skeleton } from '../../ui/Bits'
import { Button, IconButton } from '../../ui/Button'
import { Card, Screen, Section } from '../../ui/Screen'
import { AgeTablet, LessonShape, Peg } from '../../ui/signature'
import { Text } from '../../ui/Text'
import { useToast } from '../../ui/Toast'
import { UsageLine, useLessonTitle } from '../../ui/UsageLine'
import { ChildName } from '../today/sections'

type Seat = LessonDetail['seats'][number]

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
          <EmptyState
            icon="calendar"
            title={t.calendar.lesson.notFound}
            action={
              <Button size="sm" onPress={() => router.back()}>
                {t.common.back}
              </Button>
            }
          />
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
          <Skeleton height={28} width="55%" />
          <Skeleton height={16} width="70%" />
          <Skeleton height={220} radius={16} />
        </View>
      </Screen>
    )
  }
  return <LessonPage detail={detail.data} onRefresh={() => detail.refetch()} onGone={() => setGone(true)} />
}

function LessonPage({ detail, onRefresh, onGone }: { detail: LessonDetail; onRefresh: () => Promise<unknown>; onGone: () => void }) {
  const c = useColors()
  const { t, fmt, plural, date } = useI18n()
  const labels = useLabels()
  const title = useLessonTitle()
  const toast = useToast()
  const refresh = useRefresh()
  const client = useQueryClient()
  const menu = useActionMenu()
  const { now } = useClock()
  const [saving, setSaving] = useState<Set<string>>(() => new Set())
  const [removing, setRemoving] = useState<string | null>(null)

  const lesson = detail.lesson
  const key = keys.lesson(lesson.id)
  const start = new Date(lesson.event_date)
  const end = addMinutes(start, LESSON_MINUTES)
  const dayPassed = start < startOfDay(now)
  const running = now >= start && now < end
  const seats = useMemo(() => [...detail.seats].sort((a, b) => a.child.student_name.localeCompare(b.child.student_name, 'tr')), [detail.seats])
  const usage = useUsageOf(useMemo(() => seats.map((seat) => seat.child), [seats]))
  const holders = seats.filter((seat) => holdsSeat(seat.status)).length
  const unmarked = dayPassed ? seats.filter((seat) => seat.status === 'scheduled').length : 0
  const recorded = seats.filter((seat) => isRecordedAttendance(seat.status)).length

  const patch = (seatId: string, status: AttendanceStatus) =>
    client.setQueryData<LessonDetail>(key, (current) => current && { ...current, seats: current.seats.map((seat) => (seat.id === seatId ? { ...seat, status } : seat)) })

  // Optimistic, as on Today: the answer shows at once and goes back if it could not be saved
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
      if (error instanceof LessonError && error.code === 'not_found') {
        toast({ tone: 'info', title: t.today.lessonGone })
        void onRefresh()
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

  const actions = [
    { label: t.mobile.editLesson, icon: 'edit' as const, onPress: () => tasks.lesson({ id: lesson.id }) },
    { label: t.mobile.copyLesson, icon: 'copy' as const, onPress: () => tasks.lesson({ id: lesson.id, copy: true }) },
    { label: t.calendar.lesson.delete, icon: 'delete' as const, destructive: true, onPress: askDelete }
  ]
  const time = `${date(start, { hour: '2-digit', minute: '2-digit' })}–${date(end, { hour: '2-digit', minute: '2-digit' })}`

  return (
    <>
      <Stack.Screen
        options={{
          title: title(lesson),
          headerLargeTitleEnabled: true,
          ...headerMenu(c, t.mobile.lessonActions, actions, (items) => menu.open(t.mobile.lessonActions, items), 'more')
        }}
      />
      {menu.element}
      <Screen onRefresh={onRefresh} gap={24}>
        <View style={styles.head}>
          <View style={styles.line}>
            <LessonShape type={lesson.event_type} size={13} />
            <Text variant="callout" tone="ink2" tabular style={styles.flex}>
              {date(start, { weekday: 'long', day: 'numeric', month: 'long' })} · {time}
            </Text>
          </View>
          <View style={styles.marks}>
            <AgeTablet group={lesson.age_group} label={labels.ageGroup(lesson.age_group)} variant="sub" />
            {running && <Mark tone="accent">{t.calendar.now}</Mark>}
          </View>
        </View>

        <Section title={t.calendar.lesson.children} aside={seats.length > 0 ? `${holders}/${SEATS_SHOWN}` : undefined}>
          <View style={styles.stack}>
            {unmarked > 0 && <Notice tone="action">{plural(t.calendar.unmarked, unmarked)}</Notice>}
            {holders > SEATS_SHOWN && <Notice tone="action">{fmt(t.calendar.lesson.seats, { count: holders })}</Notice>}
            {seats.length === 0 ? (
              <Text variant="sub" tone="ink2" style={styles.quiet}>
                {t.calendar.lesson.noChildren}
              </Text>
            ) : (
              <Card inset={60}>
                {seats.map((seat) => {
                  const child = seat.child
                  const overdue = dayPassed && seat.status === 'scheduled'
                  const busy = removing === seat.registration_id
                  return (
                    <View key={seat.id} style={[styles.seat, busy && styles.busy]}>
                      <View style={styles.seatHead}>
                        <Peg seat={{ id: seat.id, name: child.student_name, status: seat.status, overdue }} />
                        <View style={styles.flex}>
                          <ChildName id={child.id} name={child.student_name}>
                            {child.is_active !== true && <Mark tone="neutral">{t.today.archived}</Mark>}
                            {isPaymentDue(child) && <Mark tone="action">{t.children.pendingPayment}</Mark>}
                          </ChildName>
                          <View style={styles.usage}>
                            {child.student_age ? (
                              <Text variant="foot" tone="ink3" numberOfLines={1}>
                                {child.student_age}
                              </Text>
                            ) : null}
                            <UsageLine usage={usage?.[child.id]} />
                          </View>
                        </View>
                        <IconButton
                          icon="close"
                          label={fmt(t.calendar.lesson.remove, { name: child.student_name })}
                          variant="plain"
                          size={32}
                          color={c.ink3}
                          disabled={busy}
                          onPress={() => askTakeOut(seat)}
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
              </Card>
            )}
            <Button icon="personAdd" onPress={() => tasks.lessonChildren(lesson.id)} style={styles.add}>
              {t.calendar.lesson.addChildren}
            </Button>
          </View>
        </Section>
      </Screen>
    </>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  waiting: { gap: 12, paddingTop: 8 },
  head: { gap: 8, paddingHorizontal: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  marks: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  stack: { gap: 12 },
  quiet: { paddingHorizontal: 4 },
  seat: { paddingLeft: 16, paddingRight: 8, paddingVertical: 12, gap: 10 },
  seatHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  usage: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10, rowGap: 3, marginTop: 3 },
  busy: { opacity: 0.5 },
  add: { alignSelf: 'flex-start' }
})
