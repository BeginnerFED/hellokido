import { useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { set, startOfDay } from 'date-fns'
import {
  copyLesson,
  createLesson,
  loadLesson,
  saveLesson,
  LESSON_ROW_LIMIT,
  LessonError,
  SEATS_SHOWN,
  type LessonDetail,
  type LessonType,
  type Registration
} from '@hellokido/core/api'
import { AGE_GROUPS } from '@hellokido/core/rules/ageGroups.js'
import { upperFirst } from '@hellokido/core/rules/text.js'
import { LESSON_HOURS, LESSON_MINUTE_STEPS, nextCopyDate } from '@hellokido/core/view'
import { keys, useLabels, useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useColors } from '../../theme/colors'
import { EmptyState, LoadError, Notice, Skeleton } from '../../ui/Bits'
import { Button, IconButton } from '../../ui/Button'
import { Chip, DateField, FieldLabel, Segmented, TextField } from '../../ui/Fields'
import { Icon } from '../../ui/Icon'
import { Card, Row } from '../../ui/Screen'
import { SheetActions, SheetScreen, WithSheet } from '../../ui/Sheet'
import { LessonShape, Peg } from '../../ui/signature'
import { DOT, Text } from '../../ui/Text'
import { useToast } from '../../ui/Toast'
import { useLessonTitle } from '../../ui/UsageLine'
import { ChildChooser, describeChild } from './ChildChooser'

export type LessonFormParams = {
  /** The lesson to change, or to copy. */
  id?: string
  /** The day a new lesson is for ('yyyy-MM-dd'). */
  day?: string
  /** Copy the lesson to another day instead of changing it. */
  copy?: boolean
}

type Mode = 'new' | 'edit' | 'copy'
type ChildRow = { id: string; name: string; detail: string }

const TYPES: LessonType[] = ['ingilizce', 'duyusal', 'ozel']
const two = (value: number) => String(value).padStart(2, '0')
const sameMinute = (a: Date, b: Date) => Math.floor(a.getTime() / 60_000) === Math.floor(b.getTime() / 60_000)

/**
 * A new lesson, the day and kind of one, or a copy of it on another day. Children and attendance
 * of an existing lesson are changed on its page, so editing here never touches them.
 */
export function LessonFormSheet({ params }: { params: LessonFormParams }) {
  const { t } = useI18n()
  const mode: Mode = !params.id ? 'new' : params.copy ? 'copy' : 'edit'
  // Read fresh on every opening; the form then works on that reading
  const detail = useQuery({
    queryKey: [...keys.lesson(params.id ?? ''), 'form'],
    queryFn: () => loadLesson(params.id!),
    enabled: Boolean(params.id),
    gcTime: 0,
    staleTime: Infinity
  })
  const title = mode === 'new' ? t.calendar.lesson.createTitle : mode === 'copy' ? t.calendar.lesson.copyTitle : t.mobile.editLesson

  if (params.id && !detail.data) {
    return (
      <SheetScreen title={title}>
        {detail.isError ? (
          detail.error instanceof LessonError ? (
            <EmptyState icon="calendar" title={t.calendar.lesson.notFound} />
          ) : (
            <LoadError message={t.calendar.lesson.loadFailed} retryLabel={t.common.retry} onRetry={() => void detail.refetch()} />
          )
        ) : (
          <View style={styles.waiting}>
            <Skeleton height={50} radius={13} />
            <Skeleton height={86} radius={13} />
            <Skeleton height={40} radius={11} />
            <Skeleton height={86} radius={13} />
          </View>
        )}
      </SheetScreen>
    )
  }
  return <LessonForm mode={mode} title={title} detail={detail.data} day={params.day ? new Date(`${params.day}T00:00:00`) : undefined} />
}

function LessonForm({ mode, title, detail, day: dayParam }: { mode: Mode; title: string; detail?: LessonDetail; day?: Date }) {
  const c = useColors()
  const { t, fmt, plural, date } = useI18n()
  const labels = useLabels()
  const lessonTitle = useLessonTitle()
  const toast = useToast()
  const refresh = useRefresh()
  const lesson = detail?.lesson

  // Everything the form compares against is taken once, when the sheet opened
  const [opened] = useState(() => {
    const at = lesson ? new Date(lesson.event_date) : null
    const seats = detail?.seats ?? []
    // A copy takes the active children along; archived ones stay behind
    const going = mode === 'copy' ? seats.filter((seat) => seat.child.is_active === true) : []
    return {
      day: at ? (mode === 'copy' ? nextCopyDate(at, new Date()) : startOfDay(at)) : (dayParam ?? startOfDay(new Date())),
      hour: at ? at.getHours() : null,
      minute: at ? at.getMinutes() : null,
      ageGroup: lesson?.age_group ?? null,
      type: (lesson?.event_type as LessonType | undefined) ?? null,
      description: lesson?.custom_description ?? '',
      rows: going.map<ChildRow>((seat) => ({ id: seat.registration_id, name: seat.child.student_name, detail: describeChild(seat.child) })),
      archived: mode === 'copy' ? seats.length - going.length : 0,
      seats
    }
  })

  const [day, setDay] = useState<Date | null>(opened.day)
  const [hour, setHour] = useState<number | null>(opened.hour)
  const [minute, setMinute] = useState<number | null>(opened.minute)
  const [ageGroup, setAgeGroup] = useState<string | null>(opened.ageGroup)
  const [type, setType] = useState<LessonType | null>(opened.type)
  const [description, setDescription] = useState(opened.description)
  const [rows, setRows] = useState<ChildRow[]>(opened.rows)
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)
  const sending = useRef(false)
  const [error, setError] = useState<string | null>(null)

  const startAt = day && hour !== null && minute !== null ? set(day, { hours: hour, minutes: minute, seconds: 0, milliseconds: 0 }) : null
  const maxCapacity = lesson?.max_capacity ?? LESSON_ROW_LIMIT
  const selected = useMemo(() => new Set(rows.map((row) => row.id)), [rows])
  const shown = useMemo(() => [...rows].sort((a, b) => a.name.localeCompare(b.name, 'tr')), [rows])
  const overLimit = rows.length > maxCapacity
  const descriptionMissing = mode === 'new' && type === 'ozel' && !description.trim()
  const valid = Boolean(startAt && ageGroup && type) && !descriptionMissing && !overLimit && (mode !== 'new' || rows.length > 0)
  const dirty =
    day?.getTime() !== opened.day.getTime() ||
    hour !== opened.hour ||
    minute !== opened.minute ||
    ageGroup !== opened.ageGroup ||
    type !== opened.type ||
    description.trim() !== opened.description.trim() ||
    rows.length !== opened.rows.length ||
    rows.some((row) => !opened.rows.some((before) => before.id === row.id))

  const when = (at: Date) => `${date(at, { weekday: 'long', day: 'numeric', month: 'long' })}${DOT}${date(at, { hour: '2-digit', minute: '2-digit' })}`
  // The sheet's subtitle is one narrow line between two buttons: short names keep the time in view
  const whenShort = (at: Date) => `${date(at, { weekday: 'short', day: 'numeric', month: 'short' })}${DOT}${date(at, { hour: '2-digit', minute: '2-digit' })}`

  // A stored time outside the usual steps stays choosable, so it is never changed unseen
  const hours = [...new Set([...LESSON_HOURS, ...(opened.hour !== null ? [opened.hour] : [])])].sort((a, b) => a - b)
  const minutes = [...new Set([...LESSON_MINUTE_STEPS, ...(opened.minute !== null ? [opened.minute] : [])])].sort((a, b) => a - b)

  const changeTime = <T,>(apply: (value: T) => void) => (value: T) => {
    apply(value)
    setError(null)
  }

  const drop = (id: string) => {
    setError(null)
    setRows((list) => list.filter((row) => row.id !== id))
  }

  const toggle = (child: Registration, on: boolean) => {
    if (!on) return drop(child.id)
    setError(null)
    setRows((list) => (list.some((row) => row.id === child.id) ? list : [...list, { id: child.id, name: child.student_name, detail: describeChild(child) }]))
  }

  const save = async (finish: () => void) => {
    if (!valid || busy || sending.current || !startAt || !ageGroup || !type) return
    const fields = { start: startAt, ageGroup, type, description }
    // Set at once, before the next render: a quick second tap never adds the lesson twice
    sending.current = true
    setBusy(true)
    setError(null)
    try {
      if (mode === 'copy') {
        await copyLesson(fields, rows.map((row) => row.id), maxCapacity)
        toast({ title: t.calendar.lesson.copied, body: when(startAt) })
      } else if (mode === 'edit' && lesson) {
        await saveLesson({
          lessonId: lesson.id,
          snapshot: new Map(opened.seats.map((seat) => [seat.registration_id, { participantId: seat.id, status: seat.status, name: seat.child.student_name }])),
          fields,
          children: opened.seats.map((seat) => ({ registrationId: seat.registration_id, status: seat.status })),
          timeChanged: !sameMinute(startAt, new Date(lesson.event_date)),
          maxCapacity,
          removalConfirmed: false
        })
        toast({ title: t.calendar.lesson.updated })
      } else {
        await createLesson(fields, rows.map((row) => row.id))
        toast({ title: t.calendar.lesson.created, body: when(startAt) })
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      refresh.lessons()
      finish()
    } catch (caught) {
      if (caught instanceof LessonError && caught.code === 'minute_taken') return setError(t.calendar.minuteTaken)
      if (caught instanceof LessonError && caught.code === 'too_many') {
        const { limit = maxCapacity, count } = caught.detail
        return setError(count ? fmt(t.calendar.lesson.tooMany, { limit, count }) : fmt(t.calendar.lesson.tooManyNow, { limit }))
      }
      if (caught instanceof LessonError && caught.code === 'not_found') {
        toast({ tone: 'warning', title: t.calendar.lesson.notFound })
        refresh.lessons()
        return finish()
      }
      setError(mode === 'edit' ? t.calendar.lesson.saveFailed : t.calendar.lesson.createFailed)
    } finally {
      sending.current = false
      setBusy(false)
    }
  }

  if (picking) {
    return (
      <SheetScreen
        key="children"
        title={t.calendar.lesson.chooseChildren}
        subtitle={plural(t.calendar.lesson.selected, rows.length)}
        dirty={dirty}
        busy={busy}
        onBack={() => setPicking(false)}
        footer={
          <Button variant="primary" size="lg" onPress={() => setPicking(false)}>
            {t.calendar.lesson.pickerDone}
          </Button>
        }
      >
        <ChildChooser selected={selected} onToggle={toggle} />
      </SheetScreen>
    )
  }

  return (
    <SheetScreen key="form" title={title} subtitle={lesson ? `${lessonTitle(lesson)}${DOT}${whenShort(new Date(lesson.event_date))}` : undefined} dirty={dirty} busy={busy}>
      <DateField
        label={mode === 'copy' ? t.calendar.lesson.copyTo : t.calendar.lesson.date}
        value={day}
        onChange={changeTime(setDay)}
        minimumDate={mode === 'copy' ? startOfDay(new Date()) : undefined}
      />
      <View>
        <FieldLabel hint={startAt ? date(startAt, { hour: '2-digit', minute: '2-digit' }) : undefined}>{t.calendar.lesson.hour}</FieldLabel>
        <View accessibilityRole="radiogroup" accessibilityLabel={t.calendar.lesson.hour} style={styles.chips}>
          {hours.map((value) => (
            <Chip
              key={value}
              label={two(value)}
              selected={hour === value}
              accessibilityLabel={`${t.calendar.lesson.hour} ${two(value)}`}
              onPress={() => {
                void Haptics.selectionAsync()
                changeTime(setHour)(value)
              }}
            />
          ))}
        </View>
      </View>
      <Segmented<string>
        label={t.calendar.lesson.minute}
        options={minutes.map((value) => ({ id: String(value), label: two(value) }))}
        value={minute === null ? null : String(minute)}
        onChange={(value) => changeTime(setMinute)(Number(value))}
      />
      <View>
        <FieldLabel>{t.calendar.lesson.ageGroup}</FieldLabel>
        <View accessibilityRole="radiogroup" accessibilityLabel={t.calendar.lesson.ageGroup} style={styles.chips}>
          {(AGE_GROUPS as string[]).map((group) => (
            <Chip
              key={group}
              label={labels.ageGroup(group)}
              selected={ageGroup === group}
              onPress={() => {
                void Haptics.selectionAsync()
                setAgeGroup(group)
              }}
            />
          ))}
        </View>
      </View>
      <Segmented<LessonType>
        label={t.calendar.lesson.type}
        options={TYPES.map((id) => ({ id, label: labels.lessonType(id), leading: <LessonShape type={id} size={11} /> }))}
        value={type}
        onChange={setType}
      />
      {type === 'ozel' && (
        <View>
          <TextField
            label={t.calendar.lesson.description}
            placeholder={t.calendar.lesson.descriptionPlaceholder}
            value={description}
            onChangeText={(text) => setDescription(upperFirst(text) ?? '')}
            maxLength={120}
            autoComplete="off"
            // "Done" puts the keyboard away, so the buttons under the form come back into view
            returnKeyType="done"
          />
          {descriptionMissing && (
            <Text variant="foot" tone="ink3" style={styles.after}>
              {t.calendar.lesson.descriptionRequired}
            </Text>
          )}
        </View>
      )}

      {mode !== 'edit' && (
        <View>
          <FieldLabel hint={rows.length > 0 ? `${rows.length}/${SEATS_SHOWN}` : undefined}>{t.calendar.lesson.children}</FieldLabel>
          {mode === 'copy' && (
            <Notice style={styles.before}>
              {t.calendar.lesson.copyNote}
              {opened.archived > 0 ? ` ${t.calendar.lesson.copyArchived}` : ''}
            </Notice>
          )}
          <Card inset={60}>
            {shown.map((row) => (
              <Row
                key={row.id}
                leading={<Peg seat={{ id: row.id, name: row.name, status: 'scheduled' }} />}
                title={row.name}
                subtitle={row.detail || undefined}
                trailing={
                  <IconButton
                    icon="close"
                    label={fmt(t.calendar.lesson.remove, { name: row.name })}
                    variant="plain"
                    size={32}
                    color={c.ink3}
                    onPress={() => drop(row.id)}
                  />
                }
                style={styles.childRow}
              />
            ))}
            <Row
              leading={
                <View style={[styles.addMark, { backgroundColor: c.accentWash2 }]}>
                  <Icon name="personAdd" size={16} color={c.accentInk} weight="semibold" />
                </View>
              }
              title={
                <Text variant="body" weight="600" tone="accentInk">
                  {rows.length > 0 ? t.calendar.lesson.addChildren : t.calendar.lesson.chooseChildren}
                </Text>
              }
              chevron
              onPress={() => setPicking(true)}
            />
          </Card>
          {overLimit ? (
            <Notice tone="negative" style={styles.after}>
              {fmt(t.calendar.lesson.tooMany, { limit: maxCapacity, count: rows.length })}
            </Notice>
          ) : rows.length > SEATS_SHOWN ? (
            <Notice tone="action" style={styles.after}>
              {fmt(t.calendar.lesson.seats, { count: rows.length })}
            </Notice>
          ) : mode === 'new' && rows.length === 0 ? (
            // Says why "Add the lesson" waits, instead of a button that is simply grey
            <Text variant="foot" tone="ink3" style={styles.after}>
              {t.calendar.lesson.childrenRequired}
            </Text>
          ) : null}
        </View>
      )}

      <SheetActions error={error}>
        <WithSheet>
          {(sheet) => (
            <Button variant="primary" size="lg" disabled={!valid} busy={busy} onPress={() => void save(sheet.finish)}>
              {mode === 'copy' ? t.calendar.lesson.copyAction : mode === 'edit' ? t.calendar.lesson.save : t.calendar.lesson.create}
            </Button>
          )}
        </WithSheet>
      </SheetActions>
    </SheetScreen>
  )
}

const styles = StyleSheet.create({
  waiting: { gap: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  before: { marginBottom: 10 },
  after: { marginTop: 8, paddingHorizontal: 2 },
  childRow: { paddingRight: 8 },
  // As wide as a child's tile, so "Add children" starts where the names do
  addMark: { width: 32, height: 32, borderRadius: 16, marginHorizontal: 3, alignItems: 'center', justifyContent: 'center' }
})
