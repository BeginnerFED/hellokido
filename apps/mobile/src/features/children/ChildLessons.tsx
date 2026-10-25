import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { setAttendance, type AttendanceStatus, type ChildLesson, type Registration } from '@hellokido/core/api'
import { isAttendanceOverdue } from '@hellokido/core/rules/attendance.js'
import { isFree } from '@hellokido/core/view'
import { keys, useChildLessons, useLabels } from '../../data/queries'
import { useI18n, type I18n } from '../../providers/I18n'
import { useColors, type Colors } from '../../theme/colors'
import { useActionMenu } from '../../ui/ActionMenu'
import { DateTile, LoadError, Skeleton } from '../../ui/Bits'
import { Icon } from '../../ui/Icon'
import { ActionRow, Card, GroupTitle, QuietCard, Section } from '../../ui/Screen'
import { LessonShape } from '../../ui/signature'
import { DOT, Text } from '../../ui/Text'
import { useToast } from '../../ui/Toast'

/** The statuses a lesson can be given from here; "scheduled" is never chosen by hand. */
const STATUSES: AttendanceStatus[] = ['attended', 'no_show', 'postponed', 'makeup']
const STEP = 10
const FIRST_UPCOMING = 3

function lessonWhen(i18n: Pick<I18n, 'date'>, value: string) {
  const day = new Date(value)
  const thisYear = day.getFullYear() === new Date().getFullYear()
  const date = i18n.date(day, thisYear ? { weekday: 'short', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' })
  return `${date}, ${i18n.date(day, { hour: '2-digit', minute: '2-digit' })}`
}

// A status is a dot and words in its ink on the pill; an absence is grey, never red; forgotten attendance asks for action
function statusLook(c: Colors, status: string, overdue: boolean): { dot: string | null; ink: string } {
  if (overdue) return { dot: c.amber, ink: c.amberInk }
  if (status === 'attended') return { dot: c.green, ink: c.greenInk }
  if (status === 'makeup') return { dot: c.pink, ink: c.pinkInk }
  if (status === 'no_show') return { dot: c.mute, ink: c.ink2 }
  return { dot: null, ink: c.ink2 }
}

/**
 * The child's lessons across all periods, in two parts of the page: what comes next ("Sıradaki
 * dersler"), and the past, newest first, with a heading where the lessons of earlier packages
 * begin. Attendance can be corrected on any of them.
 */
export function ChildLessons({ registration, part }: { registration: Registration; part: 'upcoming' | 'past' }) {
  const c = useColors()
  const i18n = useI18n()
  const { t, fmt, plural, date } = i18n
  const labels = useLabels()
  const toast = useToast()
  const client = useQueryClient()
  const menu = useActionMenu()
  const lessons = useChildLessons(registration.id)
  const [saving, setSaving] = useState<Set<string>>(() => new Set())
  const [shownUpcoming, setShownUpcoming] = useState(FIRST_UPCOMING)
  const [shownPast, setShownPast] = useState(STEP)

  const { upcoming, past } = useMemo(() => {
    const now = Date.now()
    const rows = lessons.data ?? []
    return {
      upcoming: rows.filter((row) => new Date(row.events!.event_date).getTime() >= now).reverse(),
      past: rows.filter((row) => new Date(row.events!.event_date).getTime() < now)
    }
  }, [lessons.data])

  const key = keys.childLessons(registration.id)
  const patch = (id: string, status: string) => client.setQueryData<ChildLesson[]>(key, (rows) => rows?.map((row) => (row.id === id ? { ...row, status } : row)))

  // Optimistic: the answer shows at once and goes back if it could not be saved
  const change = async (lesson: ChildLesson, status: AttendanceStatus) => {
    if (lesson.status === status || saving.has(lesson.id)) return
    const before = lesson.status
    void Haptics.selectionAsync()
    setSaving((set) => new Set(set).add(lesson.id))
    await client.cancelQueries({ queryKey: key })
    patch(lesson.id, status)
    try {
      await setAttendance(lesson.id, status)
    } catch {
      patch(lesson.id, before)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      toast({ tone: 'error', title: t.children.detail.statusFailed })
    } finally {
      setSaving((set) => {
        const next = new Set(set)
        next.delete(lesson.id)
        return next
      })
    }
    // The child's numbers and every lesson view follow; this list already shows the new status
    void client.invalidateQueries({ queryKey: ['usage'] })
    void client.invalidateQueries({ queryKey: ['lessons'] })
  }

  const choose = (lesson: ChildLesson, title: string) =>
    menu.open(
      title,
      STATUSES.filter((status) => status !== lesson.status).map((status) => ({ label: labels.attendance(status), onPress: () => void change(lesson, status) }))
    )

  const total = lessons.data?.length ?? 0
  // The past of the current package, then (under their own heading) lessons of earlier packages
  const startsAt = isFree(registration) ? null : new Date(registration.package_start_date).getTime()
  const shownPastRows = past.slice(0, shownPast)
  const split = startsAt === null ? -1 : shownPastRows.findIndex((row) => new Date(row.events!.event_date).getTime() < startsAt)
  const currentRows = split === -1 ? shownPastRows : shownPastRows.slice(0, split)
  const earlierRows = split === -1 ? [] : shownPastRows.slice(split)

  const row = (lesson: ChildLesson) => {
    const event = lesson.events!
    const day = new Date(event.event_date)
    const overdue = isAttendanceOverdue(lesson.status, event.event_date)
    const title = event.event_type === 'ozel' && event.custom_description ? event.custom_description : labels.lessonType(event.event_type)
    const when = lessonWhen(i18n, event.event_date)
    const thisYear = day.getFullYear() === new Date().getFullYear()
    // The tile carries the day and month; the line the weekday (or the year) and the hour
    const time = `${date(day, thisYear ? { weekday: 'short' } : { year: 'numeric' })} ${date(day, { hour: '2-digit', minute: '2-digit' })}`
    const notes = [
      lesson.cancellation_reason && fmt(t.children.detail.cancelReason, { text: lesson.cancellation_reason }),
      lesson.makeup_notes && fmt(t.children.detail.makeupNote, { text: lesson.makeup_notes }),
      lesson.postponed_notes && fmt(t.children.detail.postponedNote, { text: lesson.postponed_notes })
    ].filter((note): note is string => Boolean(note))
    const look = statusLook(c, lesson.status, overdue)
    const statusName = overdue ? t.children.detail.notMarked : labels.attendance(lesson.status)
    const busy = saving.has(lesson.id)
    return (
      <View key={lesson.id} style={styles.lesson}>
        <DateTile day={day.getDate()} under={date(day, { month: 'short' })} late={overdue} />
        <View style={styles.flex}>
          <View style={styles.titleLine}>
            <LessonShape type={event.event_type} />
            <Text weight="500" numberOfLines={1} style={styles.shrink}>
              {title}
            </Text>
          </View>
          <Text variant="sub" tone="ink3" tabular numberOfLines={2}>
            {time}, {labels.ageGroup(event.age_group)}
            {lesson.is_makeup && (
              <Text variant="sub" tone="pinkInk">
                {DOT}
                {t.children.detail.makeup}
              </Text>
            )}
          </Text>
          {notes.map((note) => (
            <Text key={note} variant="sub" tone="ink3">
              {note}
            </Text>
          ))}
        </View>
        <Pressable
          onPress={() => choose(lesson, fmt(t.children.detail.lessonStatus, { name: when }))}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`${fmt(t.children.detail.lessonStatus, { name: when })}: ${statusName}`}
          accessibilityHint={t.mobile.lessonStatus}
          accessibilityState={{ disabled: busy, busy }}
          hitSlop={8}
          // The phone's pop-up button: a dot, the choice and its up-and-down arrows on the track
          style={({ pressed }) => [styles.status, { backgroundColor: c.track, opacity: busy ? 0.55 : pressed ? 0.7 : 1 }]}
        >
          {look.dot && <View style={[styles.statusDot, { backgroundColor: look.dot }]} />}
          <Text variant="label" numberOfLines={1} style={{ color: look.ink, flexShrink: 1 }}>
            {statusName}
          </Text>
          <Icon name="chevronUpDown" size={10} color={look.ink} weight="bold" />
        </Pressable>
      </View>
    )
  }

  // The last row of the card it continues
  const more = (rest: number, onPress: () => void) => rest > 0 && <ActionRow label={plural(t.children.detail.showMore, Math.min(STEP, rest))} onPress={onPress} />

  if (part === 'upcoming') {
    // This part also stands for the whole list while it loads, fails or is empty
    if (lessons.data && total > 0 && upcoming.length === 0) return null
    return (
      <Section title={t.children.phone.upcomingTitle} aside={upcoming.length > 0 ? plural(t.children.form.lessons, upcoming.length) : undefined}>
        {menu.element}
        {lessons.isPending ? (
          // Shaped like the rows that follow: the date tile, two lines and the status pill
          <View style={[styles.waiting, { backgroundColor: c.felt }]}>
            {[0, 1].map((item) => (
              <View key={item} style={styles.waitingRow}>
                <Skeleton height={44} width={44} radius={14} />
                <View style={styles.flex}>
                  <Skeleton height={14} width="45%" />
                  <Skeleton height={11} width="60%" style={styles.waitingLine} />
                </View>
                <Skeleton height={30} width={88} radius={15} />
              </View>
            ))}
          </View>
        ) : lessons.isError ? (
          <LoadError message={t.children.detail.lessonsFailed} retryLabel={t.common.retry} onRetry={() => void lessons.refetch()} />
        ) : total === 0 ? (
          <QuietCard>{t.children.detail.lessonsEmpty}</QuietCard>
        ) : (
          <Card>
            {upcoming.slice(0, shownUpcoming).map(row)}
            {more(upcoming.length - shownUpcoming, () => setShownUpcoming((count) => count + STEP))}
          </Card>
        )}
      </Section>
    )
  }

  if (!lessons.data || past.length === 0) return null
  return (
    <Section title={t.children.phone.pastTitle} aside={plural(t.children.form.lessons, past.length)}>
      {menu.element}
      {currentRows.length > 0 && (
        <Card>
          {currentRows.map(row)}
          {earlierRows.length === 0 && more(past.length - shownPast, () => setShownPast((count) => count + STEP))}
        </Card>
      )}
      {earlierRows.length > 0 && (
        <View style={currentRows.length > 0 ? styles.after : undefined}>
          <GroupTitle>{t.children.detail.earlierPackages}</GroupTitle>
          <Card>
            {earlierRows.map(row)}
            {more(past.length - shownPast, () => setShownPast((count) => count + STEP))}
          </Card>
        </View>
      )}
    </Section>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 1 },
  waiting: { borderRadius: 26, paddingVertical: 4 },
  waitingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 14, minHeight: 68 },
  waitingLine: { marginTop: 7 },
  lesson: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 14, paddingVertical: 12, minHeight: 68 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 },
  shrink: { flexShrink: 1 },
  // A share of the row, not a fixed width: "Yoklama girilmedi" or "Відпрацювання" at a larger text size still fits
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, maxWidth: '44%', borderRadius: 15, paddingLeft: 11, paddingRight: 10, flexShrink: 0 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  // A group under another one in the same list keeps the gap between groups
  after: { marginTop: 20 }
})
