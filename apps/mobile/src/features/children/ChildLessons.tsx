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
import { LoadError, Skeleton } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { Icon } from '../../ui/Icon'
import { Card, Section } from '../../ui/Screen'
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

// Each status wears its peg's colour; an absence is grey, never red; forgotten attendance asks for action
function statusLook(c: Colors, status: string, overdue: boolean) {
  if (overdue) return { background: c.actionWash, ink: c.actionInk, ring: c.actionLine }
  if (status === 'attended') return { background: c.positiveWash, ink: c.positiveInk, ring: c.positiveLine }
  if (status === 'no_show') return { background: c.well, ink: c.ink2, ring: c.line }
  if (status === 'makeup') return { background: c.pinkWash, ink: c.pinkInk, ring: c.pinkLine }
  return { background: c.surface, ink: c.ink2, ring: c.lineStrong }
}

/**
 * Every lesson of the child across all periods: what comes next first, then the past, newest
 * first, with a heading where the lessons of earlier packages begin. Attendance can be corrected on any of them.
 */
export function ChildLessons({ registration }: { registration: Registration }) {
  const c = useColors()
  const i18n = useI18n()
  const { t, fmt, plural } = i18n
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
    const overdue = isAttendanceOverdue(lesson.status, event.event_date)
    const title = event.event_type === 'ozel' && event.custom_description ? event.custom_description : labels.lessonType(event.event_type)
    const when = lessonWhen(i18n, event.event_date)
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
        <View style={styles.shape}>
          <LessonShape type={event.event_type} size={12} />
        </View>
        <View style={styles.flex}>
          <Text variant="sub" weight="500" numberOfLines={1}>
            {title}
            <Text variant="sub" tone="ink3">
              {DOT}
              {labels.ageGroup(event.age_group)}
            </Text>
          </Text>
          <Text variant="foot" tone="ink2" tabular>
            {when}
            {lesson.is_makeup && (
              <Text variant="foot" tone="pinkInk">
                {DOT}
                {t.children.detail.makeup}
              </Text>
            )}
          </Text>
          {notes.map((note) => (
            <Text key={note} variant="foot" tone="ink3">
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
          style={({ pressed }) => [
            styles.status,
            { backgroundColor: look.background, borderColor: look.ring ?? look.background, opacity: busy ? 0.55 : pressed ? 0.7 : 1 }
          ]}
        >
          <Text variant="foot" weight="600" numberOfLines={1} style={{ color: look.ink, flexShrink: 1 }}>
            {statusName}
          </Text>
          <Icon name="chevronDown" size={10} color={look.ink} weight="bold" />
        </Pressable>
      </View>
    )
  }

  const more = (rest: number, onPress: () => void) =>
    rest > 0 && (
      <Button variant="plain" size="sm" onPress={onPress} style={styles.more}>
        {plural(t.children.detail.showMore, Math.min(STEP, rest))}
      </Button>
    )

  const subheading = (text: string, after = false) => (
    <Text variant="foot" weight="600" tone="ink3" accessibilityRole="header" style={[styles.subheading, after && styles.after]}>
      {text}
    </Text>
  )

  return (
    <Section title={t.children.detail.lessonsTitle} aside={total > 0 ? plural(t.children.form.lessons, total) : undefined}>
      {menu.element}
      {lessons.isPending ? (
        // Shaped like the rows that follow: the type dot, two lines and the status pill
        <View style={[styles.waiting, { backgroundColor: c.surface, borderColor: c.line }]}>
          {[0, 1, 2].map((item) => (
            <View key={item} style={styles.waitingRow}>
              <Skeleton height={12} width={12} radius={6} />
              <View style={styles.flex}>
                <Skeleton height={14} width="55%" />
                <Skeleton height={11} width="40%" style={styles.waitingLine} />
              </View>
              <Skeleton height={30} width={88} radius={15} />
            </View>
          ))}
        </View>
      ) : lessons.isError ? (
        <LoadError message={t.children.detail.lessonsFailed} retryLabel={t.common.retry} onRetry={() => void lessons.refetch()} />
      ) : total === 0 ? (
        <Text variant="sub" tone="ink2" style={styles.quiet}>
          {t.children.detail.lessonsEmpty}
        </Text>
      ) : (
        <View style={styles.groups}>
          {upcoming.length > 0 && (
            <View>
              {subheading(t.children.detail.upcoming)}
              <Card inset={42}>{upcoming.slice(0, shownUpcoming).map(row)}</Card>
              {more(upcoming.length - shownUpcoming, () => setShownUpcoming((count) => count + STEP))}
            </View>
          )}
          {past.length > 0 && (
            <View>
              {upcoming.length > 0 && subheading(t.children.detail.past)}
              {currentRows.length > 0 && <Card inset={42}>{currentRows.map(row)}</Card>}
              {earlierRows.length > 0 && (
                <>
                  {/* Headed like the other groups, so the three read as one set */}
                  {subheading(t.children.detail.earlierPackages, currentRows.length > 0)}
                  <Card inset={42}>{earlierRows.map(row)}</Card>
                </>
              )}
              {more(past.length - shownPast, () => setShownPast((count) => count + STEP))}
            </View>
          )}
        </View>
      )}
    </Section>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 1 },
  waiting: { borderRadius: 18, borderWidth: 1, paddingVertical: 2 },
  waitingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 12, minHeight: 60 },
  waitingLine: { marginTop: 7 },
  quiet: { paddingHorizontal: 4 },
  groups: { gap: 18 },
  subheading: { paddingHorizontal: 4, marginBottom: 8 },
  lesson: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 12, paddingVertical: 11, minHeight: 56 },
  shape: { width: 14, alignItems: 'center', alignSelf: 'flex-start', paddingTop: 4 },
  // A share of the row, not a fixed width: "Yoklama girilmedi" or "Відпрацювання" at a larger text size still fits
  status: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 30, maxWidth: '48%', borderRadius: 15, borderWidth: 1, paddingLeft: 11, paddingRight: 9, flexShrink: 0 },
  // A group under another one in the same list keeps the gap between groups
  after: { marginTop: 18 },
  more: { alignSelf: 'flex-start', marginTop: 6, marginLeft: 4 }
})
