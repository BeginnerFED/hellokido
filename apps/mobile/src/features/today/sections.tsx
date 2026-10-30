import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Linking, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { LessonError, setAttendance, type AttendanceStatus, type Lesson, type Registration, type Seat, type UnmarkedSeat } from '@hellokido/core/api'
import { whatsAppLink } from '@hellokido/core/rules/phone.js'
import { byName, lessonsLeftText, needsRenewal, packageStartText, remainingText, shortDate } from '@hellokido/core/view'
import { useMessageWriter, useRecentReminders, useReminderLog, useRemindedText, useSeatReminders } from '../../data/messages'
import { keys, useActiveUsage, useLabels } from '../../data/queries'
import { tasks, useOpenChild } from '../../lib/navigation'
import { useI18n } from '../../providers/I18n'
import { AttendancePicker } from '../../ui/AttendancePicker'
import { Avatar, Mark } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { WhatsAppButton } from '../../ui/PhoneActions'
import { Card, Section, SectionHead } from '../../ui/Screen'
import { LessonShape } from '../../ui/signature'
import { DOT, dots, Text, together } from '../../ui/Text'
import { useToast } from '../../ui/Toast'
import { useLessonTitle } from '../../ui/UsageLine'
import { useEndingPackages, usePaymentsDue, useUnmarked } from './data'

/**
 * A child's name that opens their page; the touch area is the whole line of words. Marks after the
 * name move under it when both do not fit, so a long name is never cut short for them. Rows with
 * buttons at the end let the name take two lines.
 */
export function ChildName({ id, name, lines = 1, children }: { id: string; name: string; lines?: number; children?: ReactNode }) {
  const openChild = useOpenChild()
  return (
    <Pressable onPress={() => openChild(id)} accessibilityRole="link" hitSlop={{ top: 8, bottom: 8 }} style={({ pressed }) => [styles.nameLine, pressed && { opacity: 0.55 }]}>
      <Text weight="500" numberOfLines={lines} style={styles.shrink}>
        {name}
      </Text>
      {children}
    </Pressable>
  )
}

/**
 * A family with something to do: the avatar, the name and its buttons on one line, and what it is
 * about under them across the whole row, so a package name is never squeezed beside the buttons.
 */
function FamilyRow({ child, meta, last, children }: { child: Registration; meta: ReactNode; last: string | null; children: ReactNode }) {
  return (
    <View style={styles.familyRow}>
      <View style={styles.familyHead}>
        <Avatar name={child.student_name} size={36} />
        <View style={styles.flex}>
          <ChildName id={child.id} name={child.student_name} lines={2} />
        </View>
        {children}
      </View>
      <View style={styles.familyBody}>
        <Text variant="sub" tone="ink3" numberOfLines={2}>
          {meta}
        </Text>
        {last && (
          <Text variant="sub" tone="greenInk" numberOfLines={1}>
            {last}
          </Text>
        )}
      </View>
    </View>
  )
}

/** The head of a list that opened from "Seni bekleyenler": its title and a way to fold it again. */
function OpenHead({ title, onClose }: { title: string; onClose: () => void }) {
  const { t } = useI18n()
  return (
    <SectionHead
      title={title}
      aside={
        <Button variant="plain" size="sm" onPress={onClose}>
          {t.today.unmarked.hide}
        </Button>
      }
    />
  )
}

/** A small line over a lesson's group of rows: its shape, day and time, name and age group. */
function LessonLine({ lesson, children }: { lesson: Pick<Lesson, 'event_type' | 'event_date' | 'age_group' | 'custom_description'>; children?: ReactNode }) {
  const { date } = useI18n()
  const labels = useLabels()
  const title = useLessonTitle()
  return (
    <View style={styles.lessonLine}>
      <LessonShape type={lesson.event_type} />
      <Text variant="sub" weight="600" tone="ink2" numberOfLines={1} style={styles.shrink}>
        {children ?? date(lesson.event_date, { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
        {DOT}
        {title(lesson)}
        {DOT}
        {labels.ageGroup(lesson.age_group)}
      </Text>
    </View>
  )
}

// ---------------------------------------------------------------------------------------------

/**
 * Attendance nobody marked: earlier lessons of today that have ended, then the last 30 days. Shown
 * once opened from "Seni bekleyenler"; each answer removes its row, so the list empties itself.
 */
export function UnmarkedSection({
  dayKey,
  today,
  savingToday,
  onMarkToday,
  open,
  onClose,
  onLayout
}: {
  dayKey: string
  /** Lessons of today that have ended, with children still unmarked. */
  today: Lesson[]
  savingToday: Set<string>
  onMarkToday: (seat: Seat, status: AttendanceStatus) => void
  open: boolean
  onClose: () => void
  onLayout?: (event: LayoutChangeEvent) => void
}) {
  const { t, plural, fmt, date } = useI18n()
  const toast = useToast()
  const client = useQueryClient()
  const { key, query } = useUnmarked(dayKey)
  const [saving, setSaving] = useState<Set<string>>(() => new Set())
  // Answers on their way, read at once: a second tap before the next render never sends twice
  const inFlight = useRef(new Set<string>())

  const groups = useMemo(() => {
    const list: { lesson: UnmarkedSeat['events']; rows: UnmarkedSeat[] }[] = []
    for (const row of query.data ?? []) {
      const last = list[list.length - 1]
      if (last && last.lesson.id === row.events.id) last.rows.push(row)
      else list.push({ lesson: row.events, rows: [row] })
    }
    return list
  }, [query.data])
  const todayRows = today.flatMap((lesson) => lesson.seats.filter((seat) => seat.status === 'scheduled'))
  const count = (query.data?.length ?? 0) + todayRows.length

  if (!open || count === 0) return null

  const mark = async (row: UnmarkedSeat, status: AttendanceStatus) => {
    if (inFlight.current.has(row.id)) return
    inFlight.current.add(row.id)
    setSaving((set) => new Set(set).add(row.id))
    try {
      await setAttendance(row.id, status)
      client.setQueryData<UnmarkedSeat[]>(key, (list) => list?.filter((item) => item.id !== row.id))
      void client.invalidateQueries({ queryKey: ['usage'] })
      void client.invalidateQueries({ queryKey: keys.childLessons(row.registration_id) })
      void client.invalidateQueries({ queryKey: ['lessons'], refetchType: 'none' })
    } catch (error) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      toast({ tone: 'error', title: error instanceof LessonError && error.code === 'not_found' ? t.today.lessonGone : t.children.detail.statusFailed })
      if (error instanceof LessonError) void query.refetch()
    } finally {
      inFlight.current.delete(row.id)
      setSaving((set) => {
        const next = new Set(set)
        next.delete(row.id)
        return next
      })
    }
  }

  const seatRow = (id: string, child: { id: string; student_name: string; is_active?: boolean | null; parent_name?: string | null }, status: string, busy: boolean, onChange: (status: AttendanceStatus) => void) => (
    <View key={id} style={styles.seat}>
      <View style={styles.seatHead}>
        <Avatar name={child.student_name} size={36} />
        <View style={styles.flex}>
          <ChildName id={child.id} name={child.student_name}>
            {child.is_active === false && <Mark tone="neutral">{t.today.archived}</Mark>}
          </ChildName>
          {child.parent_name ? (
            <Text variant="sub" tone="ink3" numberOfLines={1}>
              {fmt(t.today.lessonsCard.parentOf, { name: child.parent_name })}
            </Text>
          ) : null}
        </View>
      </View>
      <AttendancePicker status={status} onChange={onChange} disabled={busy} label={fmt(t.children.detail.lessonStatus, { name: child.student_name })} />
    </View>
  )

  return (
    <Section onLayout={onLayout}>
      <OpenHead title={plural(t.today.strip.unmarked, count)} onClose={onClose} />
      <Text variant="sub" tone="ink2" style={styles.note}>
        {t.today.unmarked.body}
      </Text>
      <View style={styles.groups}>
        {today
          .filter((lesson) => lesson.seats.some((seat) => seat.status === 'scheduled'))
          .map((lesson) => (
            <View key={lesson.id}>
              <LessonLine lesson={lesson}>{date(lesson.event_date, { hour: '2-digit', minute: '2-digit' })}</LessonLine>
              <Card>
                {lesson.seats
                  .filter((seat) => seat.status === 'scheduled')
                  .map((seat) => seatRow(seat.id, seat.child, seat.status, savingToday.has(seat.id), (status) => onMarkToday(seat, status)))}
              </Card>
            </View>
          ))}
        {groups.map((group) => (
          <View key={group.lesson.id}>
            <LessonLine lesson={group.lesson} />
            <Card>{group.rows.map((row) => seatRow(row.id, row.child, row.status, saving.has(row.id), (status) => void mark(row, status)))}</Card>
          </View>
        ))}
      </View>
    </Section>
  )
}

// ---------------------------------------------------------------------------------------------

/** Families who still owe a package payment or an expected fee; shown once opened from "Seni bekleyenler". */
export function PaymentsSection({ dayKey, open, onClose, onLayout }: { dayKey: string; open: boolean; onClose: () => void; onLayout?: (event: LayoutChangeEvent) => void }) {
  const i18n = useI18n()
  const { t, fmt, money } = i18n
  const labels = useLabels()
  const write = useMessageWriter()
  const { log } = useReminderLog()
  const { byChild } = useRecentReminders('payment', dayKey)
  const reminded = useRemindedText()
  const { byId, packages, fees, total } = usePaymentsDue()
  if (!open || total === 0) return null

  const row = (child: Registration, key: string, meta: string, collect: () => void, amount?: number) => {
    const message = write('payment', {
      parentName: child.parent_name,
      childName: child.student_name,
      packageCode: child.package_type,
      endDate: child.package_end_date,
      amount: amount ? money(amount) : null
    })
    const last = reminded(byChild.get(child.id), dayKey)
    return (
      <FamilyRow key={key} child={child} meta={meta} last={last}>
        <WhatsAppButton
          phone={child.parent_phone}
          text={message.text}
          label={fmt(t.today.payments.remindLabel, { name: child.student_name })}
          onSent={() => log({ kind: 'payment', registrationId: child.id, templateId: message.templateId })}
        />
        <Button size="sm" onPress={collect}>
          {t.today.payments.collect}
        </Button>
      </FamilyRow>
    )
  }

  return (
    <Section onLayout={onLayout}>
      <OpenHead title={t.today.payments.title} onClose={onClose} />
      <Card>
        {packages.map((child) =>
          row(child, child.id, dots(labels.packageName(child.package_type), together(packageStartText(i18n, child.package_start_date, child.package_type))), () =>
            tasks.payment({ registrationId: child.id, choice: 'collect' })
          )
        )}
        {fees.map((line) => {
          const child = byId.get(line.registrationId!)!
          const due = line.dueDate ? `${DOT}${fmt(t.children.detail.dueOn, { date: shortDate(i18n, `${line.dueDate}T00:00:00`) })}` : ''
          return row(
            child,
            line.key,
            `${line.description || t.children.detail.fee}${DOT}${fmt(t.today.payments.expected, { amount: money(line.amount) })}${due}`,
            () => tasks.payment({ registrationId: child.id, choice: 'collect', entryId: line.id }),
            line.amount
          )
        })}
      </Card>
    </Section>
  )
}

// ---------------------------------------------------------------------------------------------

// Ended packages shown before the rest fold away; a couple more than this are shown in full
const ENDED_FIRST = 5

/** Packages that ended or end within a week; shown once opened from "Seni bekleyenler". */
export function EndingSection({ now, dayKey, open, onClose, onLayout }: { now: Date; dayKey: string; open: boolean; onClose: () => void; onLayout?: (event: LayoutChangeEvent) => void }) {
  const i18n = useI18n()
  const { t, fmt, plural } = i18n
  const labels = useLabels()
  const write = useMessageWriter()
  const { log } = useReminderLog()
  const { byChild } = useRecentReminders('package_end', dayKey)
  const reminded = useRemindedText()
  const { rows } = useEndingPackages()
  const [unfolded, setUnfolded] = useState(false)
  if (!open || rows.length === 0) return null
  // The fewest lessons left first, then by name
  const soon = rows.filter((row) => row.remaining > 0).sort((a, b) => a.remaining - b.remaining || byName(a.child, b.child))
  const ended = rows.filter((row) => row.remaining === 0).sort((a, b) => byName(a.child, b.child))
  const endedShown = unfolded || ended.length <= ENDED_FIRST + 2 ? ended : ended.slice(0, ENDED_FIRST)

  const list = (group: typeof rows) => (
    <Card>
      {group.map(({ child, remaining }) => {
        const message = write('package_end', {
          parentName: child.parent_name,
          childName: child.student_name,
          packageCode: child.package_type,
          endDate: child.package_end_date,
          remaining,
          now
        })
        const last = reminded(byChild.get(child.id), dayKey)
        return (
          <FamilyRow
            key={child.id}
            child={child}
            last={last}
            meta={
              <>
                <Text variant="sub" weight="500" tone="amberInk">
                  {lessonsLeftText(i18n, remaining)}
                </Text>
                {DOT}
                {together(labels.packageName(child.package_type))}
              </>
            }
          >
            <WhatsAppButton
              phone={child.parent_phone}
              text={message.text}
              label={fmt(t.today.ending.remindLabel, { name: child.student_name })}
              onSent={() => log({ kind: 'package_end', registrationId: child.id, templateId: message.templateId })}
            />
            <Button size="sm" onPress={() => tasks.payment({ registrationId: child.id, choice: 'renew' })}>
              {t.today.ending.renew}
            </Button>
          </FamilyRow>
        )
      })}
    </Card>
  )
  // Group names only when both groups are there; one group alone says it in every row
  const heading = (label: string, count: number) =>
    soon.length > 0 &&
    ended.length > 0 && (
      <View style={styles.groupHead}>
        <Text variant="sub" weight="600" tone="ink2" style={styles.flex}>
          {label}
        </Text>
        <Text variant="sub" tone="ink3" tabular>
          {count}
        </Text>
      </View>
    )

  return (
    <Section onLayout={onLayout}>
      <OpenHead title={t.today.ending.title} onClose={onClose} />
      <View style={styles.groups}>
        {soon.length > 0 && (
          <View>
            {heading(t.today.ending.soon, soon.length)}
            {list(soon)}
          </View>
        )}
        {ended.length > 0 && (
          <View>
            {heading(t.today.ending.ended, ended.length)}
            {list(endedShown)}
            {endedShown.length < ended.length && (
              <Button variant="plain" size="sm" onPress={() => setUnfolded(true)} style={styles.more}>
                {plural(t.today.ending.showMore, ended.length - endedShown.length)}
              </Button>
            )}
          </View>
        )}
      </View>
    </Section>
  )
}

// ---------------------------------------------------------------------------------------------

/**
 * Tomorrow's WhatsApp reminders, one per family still scheduled. What was sent is shared with the
 * web panel and the other phones, and `send(next)` walks the families in order.
 */
export function useTomorrowReminders(lessons: Lesson[], now: Date) {
  const write = useMessageWriter()
  const usage = useActiveUsage().data
  const seatIds = useMemo(() => lessons.flatMap((lesson) => lesson.seats.map((seat) => seat.id)), [lessons])
  const { bySeat } = useSeatReminders(seatIds)
  const { log, unlog } = useReminderLog()
  // A tap shows at once; the shared log catches up a moment later
  const [local, setLocal] = useState<Record<string, boolean>>({})
  // A quick second tap on "send" reaches the same family before the screen moves on
  const sending = useRef(new Set<string>())
  const settle = (seatId: string) =>
    setLocal((current) => {
      const next = { ...current }
      delete next[seatId]
      return next
    })
  const isSent = (seatId: string) => local[seatId] ?? bySeat.has(seatId)

  const items = lessons.flatMap((lesson) =>
    lesson.seats
      .filter((seat) => seat.status === 'scheduled')
      .map((seat) => {
        const message = write('lesson', {
          parentName: seat.child.parent_name,
          childName: seat.child.student_name,
          lesson: { date: lesson.event_date, type: lesson.event_type },
          remaining: usage?.[seat.child.id]?.remaining ?? null,
          endDate: seat.child.package_end_date,
          packageCode: seat.child.package_type,
          now
        })
        return { seat, chat: whatsAppLink(seat.child.parent_phone, message.text), templateId: message.templateId }
      })
      .filter((item) => item.chat)
  )
  const sent = items.filter((item) => isSent(item.seat.id)).length

  const send = (item: (typeof items)[number]) => {
    const seatId = item.seat.id
    if (sending.current.has(seatId)) return
    sending.current.add(seatId)
    setLocal((current) => ({ ...current, [seatId]: true }))
    log(
      { kind: 'lesson', registrationId: item.seat.registration_id, participantId: seatId, templateId: item.templateId },
      {
        onSettled: () => {
          sending.current.delete(seatId)
          settle(seatId)
        }
      }
    )
    void Linking.openURL(item.chat!).catch(() => undefined)
  }
  const takeBack = (seatId: string) => {
    const entry = bySeat.get(seatId)
    setLocal((current) => ({ ...current, [seatId]: false }))
    if (entry) unlog(entry.id, { onSettled: () => settle(seatId) })
    else settle(seatId)
  }

  return {
    items,
    bySeatId: new Map(items.map((item) => [item.seat.id, item])),
    sent,
    next: items.find((item) => !isSent(item.seat.id)),
    isSent,
    send,
    takeBack
  }
}

export type TomorrowReminders = ReturnType<typeof useTomorrowReminders>

/** Tomorrow's lessons with a reminder for every family; shown once opened from "Seni bekleyenler". */
export function TomorrowSection({ lessons, reminders, open, onClose, onLayout }: { lessons: Lesson[]; reminders: TomorrowReminders; open: boolean; onClose: () => void; onLayout?: (event: LayoutChangeEvent) => void }) {
  const i18n = useI18n()
  const { t, fmt, date } = i18n
  const labels = useLabels()
  const usage = useActiveUsage().data
  if (!open || lessons.length === 0) return null
  const { bySeatId, isSent, send, takeBack } = reminders

  return (
    <Section onLayout={onLayout}>
      <OpenHead title={t.today.board.tomorrowReminders} onClose={onClose} />
      <View style={styles.groups}>
        {lessons.map((lesson) => (
          <View key={lesson.id}>
            <LessonLine lesson={lesson}>{date(lesson.event_date, { hour: '2-digit', minute: '2-digit' })}</LessonLine>
            {lesson.seats.length === 0 ? (
              <Text variant="sub" tone="ink2" style={styles.note}>
                {t.today.emptyLesson}
              </Text>
            ) : (
              <Card>
                {lesson.seats.map((seat) => {
                  const child = seat.child
                  const item = bySeatId.get(seat.id)
                  const done = isSent(seat.id)
                  const own = usage?.[child.id]
                  const ending = own !== undefined && needsRenewal(child, own)
                  return (
                    <View key={seat.id} style={styles.personRow}>
                      <Avatar name={child.student_name} size={36} />
                      <View style={styles.flex}>
                        <ChildName id={child.id} name={child.student_name} />
                        {/* The lessons left first, so a long parent's name is what gets cut */}
                        <Text variant="sub" tone="ink3" numberOfLines={1}>
                          {own && (
                            <Text variant="sub" tone={ending ? 'amberInk' : 'ink3'} weight={ending ? '500' : undefined}>
                              {remainingText(i18n, own)}
                            </Text>
                          )}
                          {own && child.parent_name?.trim() ? DOT : ''}
                          {child.parent_name}
                        </Text>
                      </View>
                      {seat.status !== 'scheduled' ? (
                        <Mark tone="neutral">{labels.attendance(seat.status)}</Mark>
                      ) : !item ? null : done ? (
                        // A sent reminder taps back to "not sent", for a chat opened by mistake
                        <Button size="sm" variant="plain" icon="check" accessibilityLabel={`${t.today.tomorrow.sent}. ${t.messages.undo}`} onPress={() => takeBack(seat.id)}>
                          {t.today.tomorrow.sent}
                        </Button>
                      ) : (
                        <Button size="sm" icon="chat" accessibilityLabel={fmt(t.today.tomorrow.remindLabel, { name: child.student_name })} onPress={() => send(item)}>
                          {t.today.tomorrow.remind}
                        </Button>
                      )}
                    </View>
                  )
                })}
              </Card>
            )}
          </View>
        ))}
      </View>
    </Section>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  nameLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 4, minWidth: 0, alignSelf: 'flex-start', maxWidth: '100%' },
  note: { paddingHorizontal: 4, marginTop: -2, marginBottom: 12 },
  groups: { gap: 16 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 4, marginBottom: 8, minWidth: 0 },
  lessonLine: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, marginBottom: 8, minWidth: 0 },
  seat: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  seatHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 12, paddingVertical: 11 },
  familyRow: { paddingLeft: 16, paddingRight: 12, paddingVertical: 12 },
  familyHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // Under the name (past the 36pt avatar and its gap); a little into the head line, whose buttons stand taller than the name
  familyBody: { marginLeft: 48, marginTop: -4 },
  more: { alignSelf: 'flex-start', marginTop: 6, marginLeft: 4 }
})
