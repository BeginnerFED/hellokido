import { useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { loadLesson, saveLesson, LESSON_ROW_LIMIT, LessonError, SEATS_SHOWN, type LessonDetail, type LessonType } from '@hellokido/core/api'
import { holdsSeat } from '@hellokido/core/rules/attendance.js'
import { keys, useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { EmptyState, LoadError, Notice, Skeleton } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { SheetActions, SheetScreen, WithSheet } from '../../ui/Sheet'
import { DOT, Text } from '../../ui/Text'
import { useToast } from '../../ui/Toast'
import { useLessonTitle } from '../../ui/UsageLine'
import { ChildChooser } from './ChildChooser'

/** Children to add to a lesson that already exists; those in it already are not offered again. */
export function LessonChildrenSheet({ id }: { id: string }) {
  const { t, date } = useI18n()
  const lessonTitle = useLessonTitle()
  // Read fresh on every opening, so the children shown as already in the lesson are the stored ones
  const detail = useQuery({ queryKey: [...keys.lesson(id), 'children'], queryFn: () => loadLesson(id), gcTime: 0, staleTime: Infinity })
  const lesson = detail.data?.lesson
  const subtitle = lesson
    ? `${lessonTitle(lesson)}${DOT}${date(lesson.event_date, { weekday: 'short', day: 'numeric', month: 'short' })} ${date(lesson.event_date, { hour: '2-digit', minute: '2-digit' })}`
    : undefined

  if (!detail.data) {
    return (
      <SheetScreen title={t.calendar.lesson.addChildren}>
        {detail.isError ? (
          detail.error instanceof LessonError ? (
            <EmptyState icon="calendar" title={t.calendar.lesson.notFound} />
          ) : (
            <LoadError message={t.calendar.lesson.loadFailed} retryLabel={t.common.retry} onRetry={() => void detail.refetch()} />
          )
        ) : (
          <View style={styles.stack}>
            <Skeleton height={40} radius={11} />
            <Skeleton height={220} radius={16} />
          </View>
        )}
      </SheetScreen>
    )
  }
  return <Chooser detail={detail.data} subtitle={subtitle} />
}

function Chooser({ detail, subtitle }: { detail: LessonDetail; subtitle?: string }) {
  const { t, fmt, plural } = useI18n()
  const toast = useToast()
  const refresh = useRefresh()
  // In the order they were ticked
  const [chosen, setChosen] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const sending = useRef(false)
  const [error, setError] = useState<string | null>(null)

  const { lesson, seats } = detail
  const inLesson = useMemo(() => new Set(seats.map((seat) => seat.registration_id)), [seats])
  const selected = useMemo(() => new Set(chosen), [chosen])
  const maxCapacity = lesson.max_capacity ?? LESSON_ROW_LIMIT
  const holders = seats.filter((seat) => holdsSeat(seat.status)).length + chosen.length
  const overLimit = seats.length + chosen.length > maxCapacity

  const add = async (finish: () => void) => {
    if (chosen.length === 0 || overLimit || busy || sending.current) return
    // Set at once, before the next render: a quick second tap never adds the children twice
    sending.current = true
    setBusy(true)
    setError(null)
    try {
      // Worked out against the reading this sheet opened with: only the ticked children are added
      await saveLesson({
        lessonId: lesson.id,
        snapshot: new Map(seats.map((seat) => [seat.registration_id, { participantId: seat.id, status: seat.status, name: seat.child.student_name }])),
        fields: { start: new Date(lesson.event_date), ageGroup: lesson.age_group, type: lesson.event_type as LessonType, description: lesson.custom_description },
        children: [
          ...seats.map((seat) => ({ registrationId: seat.registration_id, status: seat.status })),
          ...chosen.map((registrationId) => ({ registrationId, status: 'scheduled' as const }))
        ],
        timeChanged: false,
        maxCapacity,
        removalConfirmed: false
      })
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      toast({ title: plural(t.mobile.childrenAdded, chosen.length) })
      refresh.lessons()
      finish()
    } catch (caught) {
      if (caught instanceof LessonError && caught.code === 'too_many') {
        setError(fmt(t.calendar.lesson.tooManyNow, { limit: caught.detail.limit ?? maxCapacity }))
      } else if (caught instanceof LessonError && caught.code === 'not_found') {
        toast({ tone: 'warning', title: t.calendar.lesson.notFound })
        refresh.lessons()
        finish()
      } else {
        setError(t.calendar.lesson.saveFailed)
      }
    } finally {
      sending.current = false
      setBusy(false)
    }
  }

  return (
    <SheetScreen
      title={t.calendar.lesson.addChildren}
      subtitle={subtitle}
      dirty={chosen.length > 0}
      busy={busy}
      footer={
        <SheetActions error={error}>
          <WithSheet>
            {(sheet) => (
              <Button variant="primary" size="lg" disabled={chosen.length === 0 || overLimit} busy={busy} onPress={() => void add(sheet.finish)}>
                {chosen.length > 0 ? plural(t.mobile.addChildrenCount, chosen.length) : t.calendar.lesson.chooseChildren}
              </Button>
            )}
          </WithSheet>
        </SheetActions>
      }
    >
      {inLesson.size > 0 && (
        <Text variant="foot" tone="ink3" style={styles.note}>
          {plural(t.mobile.alreadyIn, inLesson.size)}
        </Text>
      )}
      {overLimit ? (
        <Notice tone="negative">{fmt(t.calendar.lesson.tooManyNow, { limit: maxCapacity })}</Notice>
      ) : holders > SEATS_SHOWN ? (
        <Notice tone="action">{fmt(t.calendar.lesson.seats, { count: holders })}</Notice>
      ) : null}
      <ChildChooser
        selected={selected}
        hidden={inLesson}
        onToggle={(child, on) => {
          setError(null)
          setChosen((list) => (on ? (list.includes(child.id) ? list : [...list, child.id]) : list.filter((item) => item !== child.id)))
        }}
      />
    </SheetScreen>
  )
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  note: { paddingHorizontal: 4, marginBottom: -8 }
})
