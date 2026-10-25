import { useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
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
import { typeTone, useColors } from '../../theme/colors'
import { EmptyState, firstNameOf, initialsOf, LoadError, Skeleton } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { DateField, SelectField, TextField, TimeField } from '../../ui/Fields'
import { Icon } from '../../ui/Icon'
import { Card, FormGroup, GroupTitle, Row } from '../../ui/Screen'
import { SheetActions, SheetScreen, useSheet } from '../../ui/Sheet'
import { SeatDots, TypeTile } from '../../ui/signature'
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
            <Skeleton height={120} radius={26} />
            <Skeleton height={62} radius={26} />
            <Skeleton height={82} radius={20} />
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
  // This form draws its own SheetScreen, so the bar's action closes the sheet it is in through this
  const sheet = useSheet()
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

  // A stored time off the quarter hours keeps every minute choosable, so it is never changed unseen
  const quarters = opened.minute === null || LESSON_MINUTE_STEPS.includes(opened.minute)
  // An empty time starts at the next full hour, kept within the hours lessons are held
  const [firstTime] = useState(() => {
    const next = Math.min(Math.max(new Date().getHours() + 1, LESSON_HOURS[0]), LESSON_HOURS[LESSON_HOURS.length - 1])
    return set(startOfDay(new Date()), { hours: next })
  })

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

  // What the children still ask for or warn about, under their card; the seat strip says how full it is
  const childrenNotes = [
    mode === 'copy' && { tone: 'ink3' as const, text: `${t.calendar.lesson.copyNote}${opened.archived > 0 ? ` ${t.calendar.lesson.copyArchived}` : ''}` },
    overLimit
      ? { tone: 'negativeInk' as const, text: fmt(t.calendar.lesson.tooMany, { limit: maxCapacity, count: rows.length }) }
      : // Says why "Add" in the bar waits, instead of a button that is simply grey
        mode === 'new' && rows.length === 0 && { tone: 'amberInk' as const, text: t.calendar.lesson.childrenRequired }
  ].filter((note) => note !== false)
  const free = SEATS_SHOWN - rows.length
  const seatLine = rows.length > SEATS_SHOWN ? fmt(t.calendar.lesson.seats, { count: rows.length }) : free > 0 ? plural(t.calendar.lesson.seatsLeft, free) : t.calendar.lesson.seatsFull
  const chipTone = type ? typeTone(c, type) : null
  const dark = typeTone(c, 'ingilizce').dark

  return (
    <SheetScreen
      key="form"
      title={title}
      subtitle={lesson ? `${lessonTitle(lesson)}${DOT}${whenShort(new Date(lesson.event_date))}` : undefined}
      dirty={dirty}
      busy={busy}
      action={{
        label: mode === 'copy' ? t.calendar.lesson.copyAction : mode === 'edit' ? t.calendar.lesson.save : t.common.add,
        // A lesson opened to change waits for a change; a new lesson or a copy only for what it needs
        disabled: !valid || (mode === 'edit' && !dirty),
        onPress: () => void save(sheet.finish)
      }}
    >
      <FormGroup>
        <DateField
          label={mode === 'copy' ? t.calendar.lesson.copyTo : t.calendar.lesson.date}
          value={day}
          onChange={changeTime(setDay)}
          minimumDate={mode === 'copy' ? startOfDay(new Date()) : undefined}
        />
        <TimeField
          label={t.common.time}
          value={hour !== null && minute !== null ? set(startOfDay(new Date()), { hours: hour, minutes: minute }) : null}
          onChange={(at) => {
            setHour(at.getHours())
            setMinute(at.getMinutes())
            setError(null)
          }}
          minuteInterval={quarters ? 15 : 1}
          start={firstTime}
        />
      </FormGroup>

      <FormGroup>
        <SelectField
          label={t.calendar.lesson.ageGroup}
          placeholder={t.common.choose}
          options={(AGE_GROUPS as string[]).map((group) => ({ id: group, label: labels.ageGroup(group) }))}
          value={ageGroup}
          onChange={setAgeGroup}
        />
      </FormGroup>

      {/* The three kinds as felt tiles: the chosen one takes its type's felt, ring and tick */}
      <View>
        <GroupTitle>{t.calendar.lesson.type}</GroupTitle>
        <View accessibilityRole="radiogroup" accessibilityLabel={t.calendar.lesson.type} style={styles.types}>
          {TYPES.map((id) => (
            <TypeTile
              key={id}
              type={id}
              label={labels.lessonType(id)}
              selected={type === id}
              onPress={() => {
                if (type === id) return
                void Haptics.selectionAsync()
                setType(id)
              }}
            />
          ))}
        </View>
        {type === 'ozel' && (
          <FormGroup footer={descriptionMissing ? <Text variant="sub" tone="amberInk">{t.calendar.lesson.descriptionRequired}</Text> : undefined} style={styles.under}>
            <TextField
              label={t.calendar.lesson.description}
              placeholder={t.calendar.lesson.descriptionPlaceholder}
              value={description}
              onChangeText={(text) => setDescription(upperFirst(text) ?? '')}
              maxLength={120}
              autoComplete="off"
              returnKeyType="done"
            />
          </FormGroup>
        )}
      </View>

      {mode !== 'edit' && (
        <View>
          <GroupTitle>{t.calendar.lesson.children}</GroupTitle>
          <Card>
            {/* One block, so the card draws no line between the count and its chips */}
            <View>
              <Row
                title={rows.length > 0 ? plural(t.calendar.lesson.selected, rows.length) : t.calendar.lesson.chooseChildren}
                chevron
                accessibilityLabel={rows.length > 0 ? `${t.calendar.lesson.children}, ${plural(t.calendar.lesson.selected, rows.length)}` : t.calendar.lesson.chooseChildren}
                onPress={() => setPicking(true)}
              />
              {/* The chosen children as small raised chips; the last chip adds more */}
              <View style={styles.chips}>
                {shown.map((row) => (
                  // In the dark a lifted chip would glow; it sits on the track instead
                  <View key={row.id} style={[styles.chip, dark ? { backgroundColor: c.track } : { backgroundColor: c.raised, boxShadow: c.liftShadow }]}>
                    <View style={[styles.monogram, { backgroundColor: chipTone ? chipTone.felt : c.felt }]}>
                      <Text weight="600" maxFontSizeMultiplier={1} style={[styles.monogramText, { color: chipTone ? chipTone.ink : c.ink2 }]}>
                        {initialsOf(row.name)}
                      </Text>
                    </View>
                    <Text weight="500" numberOfLines={1} maxFontSizeMultiplier={1.2} style={styles.chipText}>
                      {firstNameOf(row.name)}
                    </Text>
                  </View>
                ))}
                <Pressable
                  onPress={() => setPicking(true)}
                  accessibilityRole="button"
                  accessibilityLabel={t.calendar.lesson.chooseChildren}
                  hitSlop={{ top: 5, bottom: 5 }}
                  style={({ pressed }) => [styles.chip, styles.addChip, { borderColor: c.line }, pressed && { backgroundColor: c.pressed }]}
                >
                  <Icon name="add" size={15} color={c.accentInk} />
                  <Text weight="500" maxFontSizeMultiplier={1.2} style={[styles.chipText, { color: c.accentInk }]}>
                    {t.common.add}
                  </Text>
                </Pressable>
              </View>
            </View>
          </Card>
          {rows.length > 0 && (
            <View style={styles.seatStrip}>
              <SeatDots taken={rows.length} capacity={SEATS_SHOWN} type={type ?? 'ingilizce'} label={seatLine} />
            </View>
          )}
          {childrenNotes.length > 0 && (
            <View style={styles.notes}>
              {childrenNotes.map((note) => (
                <Text key={note.text} variant="sub" weight={note.tone === 'ink3' ? '400' : '500'} tone={note.tone}>
                  {note.text}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}

      <SheetActions error={error} />
    </SheetScreen>
  )
}

const styles = StyleSheet.create({
  waiting: { gap: 20 },
  types: { flexDirection: 'row', gap: 8 },
  under: { marginTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingTop: 2, paddingBottom: 14 },
  chip: { height: 34, borderRadius: 17, flexDirection: 'row', alignItems: 'center', gap: 7, paddingLeft: 4, paddingRight: 13, maxWidth: '100%' },
  addChip: { borderWidth: 1.5, paddingLeft: 10, backgroundColor: 'transparent' },
  monogram: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  monogramText: { fontSize: 10.5, lineHeight: 13 },
  chipText: { fontSize: 14, lineHeight: 19, flexShrink: 1 },
  seatStrip: { paddingHorizontal: 4, marginTop: 12 },
  notes: { gap: 4, paddingHorizontal: 4, marginTop: 10 }
})
