import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Linking, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { LessonError, setAttendance, type AttendanceStatus, type Lesson, type Registration, type UnmarkedSeat } from '@hellokido/core/api'
import { whatsAppLink } from '@hellokido/core/rules/phone.js'
import { endText, formatPeriod, shortDate } from '@hellokido/core/view'
import { useMessageWriter, useRecentReminders, useReminderLog, useRemindedText, useSeatReminders } from '../../data/messages'
import { keys, useActiveUsage, useLabels } from '../../data/queries'
import { tasks, useOpenChild } from '../../lib/navigation'
import { useI18n } from '../../providers/I18n'
import { useColors } from '../../theme/colors'
import { AttendancePicker } from '../../ui/AttendancePicker'
import { ListSkeleton, LoadError, Mark } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { Icon } from '../../ui/Icon'
import { WhatsAppButton } from '../../ui/PhoneActions'
import { Card, Section } from '../../ui/Screen'
import { LessonShape, Peg } from '../../ui/signature'
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
      <Text variant="callout" weight="600" numberOfLines={lines} style={styles.shrink}>
        {name}
      </Text>
      {children}
    </Pressable>
  )
}

/**
 * A family with something to do: the tile, the name and its buttons on one line, and what it is
 * about under them across the whole row, so a package name is never squeezed beside the buttons.
 */
function ActionRow({ child, meta, last, children }: { child: Registration; meta: ReactNode; last: string | null; children: ReactNode }) {
  return (
    <View style={styles.actionRow}>
      <View style={styles.actionHead}>
        <Peg seat={{ id: child.id, name: child.student_name, status: 'scheduled' }} />
        <View style={styles.flex}>
          <ChildName id={child.id} name={child.student_name} lines={2} />
        </View>
        {children}
      </View>
      <View style={styles.actionBody}>
        <Text variant="foot" tone="ink3" numberOfLines={2}>
          {meta}
        </Text>
        {last && (
          <Text variant="foot" tone="positiveInk" numberOfLines={1}>
            {last}
          </Text>
        )}
      </View>
    </View>
  )
}

function Quiet({ children }: { children: string }) {
  return (
    <Text variant="sub" tone="ink2" style={styles.quiet}>
      {children}
    </Text>
  )
}

// ---------------------------------------------------------------------------------------------

/**
 * Attendance nobody marked in the last 30 days. It stays folded (it can be long) and each answer
 * removes its row, so the list empties itself as the work gets done.
 */
export function UnmarkedSection({ dayKey, open, onOpenChange, onLayout }: { dayKey: string; open: boolean; onOpenChange: (open: boolean) => void; onLayout?: (event: LayoutChangeEvent) => void }) {
  const c = useColors()
  const { t, plural, fmt, date } = useI18n()
  const labels = useLabels()
  const toast = useToast()
  const client = useQueryClient()
  const title = useLessonTitle()
  const { key, query } = useUnmarked(dayKey)
  const [saving, setSaving] = useState<Set<string>>(() => new Set())
  // Answers on their way, read at once: a second tap before the next render never sends twice
  const inFlight = useRef(new Set<string>())

  const rows = query.data ?? []
  const groups = useMemo(() => {
    const list: { lesson: UnmarkedSeat['events']; rows: UnmarkedSeat[] }[] = []
    for (const row of query.data ?? []) {
      const last = list[list.length - 1]
      if (last && last.lesson.id === row.events.id) last.rows.push(row)
      else list.push({ lesson: row.events, rows: [row] })
    }
    return list
  }, [query.data])

  // A helper list: on an error or with nothing to do it simply stays out of the way
  if (query.isError || rows.length === 0) return null

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

  return (
    <Section
      onLayout={onLayout}
      title={
        <View style={styles.warnTitle}>
          <View style={styles.warnIcon}>
            <Icon name="warning" size={19} color={c.action} />
          </View>
          <Text variant="headline" style={styles.shrink}>
            {plural(t.today.unmarked.title, rows.length)}
          </Text>
        </View>
      }
      aside={
        <Button variant="plain" size="sm" onPress={() => onOpenChange(!open)}>
          {open ? t.today.unmarked.hide : t.today.unmarked.show}
        </Button>
      }
    >
      <Text variant="foot" tone="ink2" style={styles.warnBody}>
        {t.today.unmarked.body}
      </Text>
      {open && (
        <View style={styles.groups}>
          {groups.map((group) => (
            <View key={group.lesson.id}>
              <View style={styles.groupHead}>
                <LessonShape type={group.lesson.event_type} size={11} />
                <Text variant="foot" weight="600" tone="ink2" numberOfLines={1} style={styles.shrink}>
                  {date(group.lesson.event_date, { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}{DOT}{title(group.lesson)}{DOT}{labels.ageGroup(group.lesson.age_group)}
                </Text>
              </View>
              <Card inset={60}>
                {group.rows.map((row) => (
                  <View key={row.id} style={styles.seat}>
                    <View style={styles.seatHead}>
                      <Peg seat={{ id: row.id, name: row.child.student_name, status: row.status, overdue: true }} />
                      <View style={styles.flex}>
                        <ChildName id={row.child.id} name={row.child.student_name}>
                          {row.child.is_active !== true && <Mark tone="neutral">{t.today.archived}</Mark>}
                        </ChildName>
                        <Text variant="foot" tone="ink3" numberOfLines={1}>
                          {t.children.detail.parent}{DOT}{row.child.parent_name}
                        </Text>
                      </View>
                    </View>
                    <AttendancePicker
                      status={row.status}
                      onChange={(status) => void mark(row, status)}
                      disabled={saving.has(row.id)}
                      label={fmt(t.children.detail.lessonStatus, { name: row.child.student_name })}
                    />
                  </View>
                ))}
              </Card>
            </View>
          ))}
        </View>
      )}
    </Section>
  )
}

// ---------------------------------------------------------------------------------------------

/** Families who still owe a package payment or an expected fee. */
export function PaymentsSection({ dayKey, onLayout }: { dayKey: string; onLayout?: (event: LayoutChangeEvent) => void }) {
  const i18n = useI18n()
  const { t, fmt, money } = i18n
  const labels = useLabels()
  const write = useMessageWriter()
  const { log } = useReminderLog()
  const { byChild } = useRecentReminders('payment', dayKey)
  const reminded = useRemindedText()
  const { registrations, byId, packages, fees, total } = usePaymentsDue()

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
      <ActionRow key={key} child={child} meta={meta} last={last}>
        <WhatsAppButton
          phone={child.parent_phone}
          text={message.text}
          label={fmt(t.today.payments.remindLabel, { name: child.student_name })}
          onSent={() => log({ kind: 'payment', registrationId: child.id, templateId: message.templateId })}
        />
        <Button size="sm" onPress={collect}>
          {t.today.payments.collect}
        </Button>
      </ActionRow>
    )
  }

  return (
    <Section onLayout={onLayout} title={t.today.payments.title} aside={total > 0 ? total : undefined}>
      {registrations.isError ? (
        <LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={() => void registrations.refetch()} />
      ) : !registrations.data ? (
        <ListSkeleton />
      ) : total === 0 ? (
        <Quiet>{t.today.payments.empty}</Quiet>
      ) : (
        <Card inset={60}>
          {packages.map((child) =>
            row(child, child.id, dots(labels.packageName(child.package_type), together(formatPeriod(i18n, child.package_start_date, child.package_end_date))), () =>
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
      )}
    </Section>
  )
}

// ---------------------------------------------------------------------------------------------

// Ended packages shown before the rest fold away; a couple more than this are shown in full
const ENDED_FIRST = 5

/** Packages that ended or end within a week; they stay here until renewed or archived. */
export function EndingSection({ now, dayKey, onLayout }: { now: Date; dayKey: string; onLayout?: (event: LayoutChangeEvent) => void }) {
  const i18n = useI18n()
  const { t, fmt, plural } = i18n
  const labels = useLabels()
  const write = useMessageWriter()
  const usage = useActiveUsage().data
  const { log } = useReminderLog()
  const { byChild } = useRecentReminders('package_end', dayKey)
  const reminded = useRemindedText()
  const { registrations, rows } = useEndingPackages(now)
  const [unfolded, setUnfolded] = useState(false)
  // The soonest end first; ended ones from the latest, as the oldest are often children who left
  const soon = rows.filter((row) => row.days >= 0).sort((a, b) => a.days - b.days)
  const ended = rows.filter((row) => row.days < 0).sort((a, b) => b.days - a.days)
  const endedShown = unfolded || ended.length <= ENDED_FIRST + 2 ? ended : ended.slice(0, ENDED_FIRST)

  const list = (group: typeof rows) => (
    <Card inset={60}>
      {group.map(({ child, days }) => {
        const message = write('package_end', {
          parentName: child.parent_name,
          childName: child.student_name,
          packageCode: child.package_type,
          endDate: child.package_end_date,
          remaining: usage?.[child.id]?.remaining ?? null,
          now
        })
        const last = reminded(byChild.get(child.id), dayKey)
        return (
          <ActionRow
            key={child.id}
            child={child}
            last={last}
            meta={
              <>
                <Text variant="foot" weight="600" tone="actionInk">
                  {endText(i18n, days)}
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
          </ActionRow>
        )
      })}
    </Card>
  )
  // Group names only when both groups are there; one group alone says it in every row
  const heading = (label: string, count: number) =>
    soon.length > 0 &&
    ended.length > 0 && (
      <View style={styles.groupHead}>
        <Text variant="foot" weight="600" tone="ink2" style={styles.flex}>
          {label}
        </Text>
        <Text variant="foot" tone="ink3" tabular>
          {count}
        </Text>
      </View>
    )

  return (
    <Section onLayout={onLayout} title={t.today.ending.title} aside={rows.length > 0 ? rows.length : undefined}>
      {registrations.isError ? (
        <LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={() => void registrations.refetch()} />
      ) : !registrations.data ? (
        <ListSkeleton />
      ) : rows.length === 0 ? (
        <Quiet>{t.today.ending.empty}</Quiet>
      ) : (
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
      )}
    </Section>
  )
}

// ---------------------------------------------------------------------------------------------

/**
 * Tomorrow's lessons with a WhatsApp reminder for every family. What was sent is shared with the
 * web panel and the other phones, and "send to the next" walks the families in order.
 */
export function TomorrowSection({ lessons, isPending, isError, onRetry, now }: { lessons: Lesson[]; isPending: boolean; isError: boolean; onRetry: () => void; now: Date }) {
  const c = useColors()
  const { t, fmt, date } = useI18n()
  const labels = useLabels()
  const title = useLessonTitle()
  const write = useMessageWriter()
  const usage = useActiveUsage().data
  const seatIds = useMemo(() => lessons.flatMap((lesson) => lesson.seats.map((seat) => seat.id)), [lessons])
  const { bySeat } = useSeatReminders(seatIds)
  const { log, unlog } = useReminderLog()
  // A tap shows at once; the shared log catches up a moment later
  const [local, setLocal] = useState<Record<string, boolean>>({})
  // A quick second tap on "send to the next" reaches the same family before the screen moves on
  const sending = useRef(new Set<string>())
  const settle = (seatId: string) =>
    setLocal((current) => {
      const next = { ...current }
      delete next[seatId]
      return next
    })
  const isSent = (seatId: string) => local[seatId] ?? bySeat.has(seatId)

  const reminders = lessons.flatMap((lesson) =>
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
  const bySeatId = new Map(reminders.map((item) => [item.seat.id, item]))
  const sent = reminders.filter((item) => isSent(item.seat.id)).length
  const allSent = reminders.length > 0 && sent === reminders.length
  const next = reminders.find((item) => !isSent(item.seat.id))

  // The evening note about families still waiting comes from the server (Settings › Messages)

  const send = (item: (typeof reminders)[number]) => {
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

  return (
    <Section
      title={t.today.tomorrow.title}
      aside={
        reminders.length > 0 ? (
          <Mark tone={allSent ? 'positive' : 'neutral'}>{fmt(t.today.tomorrow.progress, { sent, total: reminders.length })}</Mark>
        ) : undefined
      }
    >
      {isError ? (
        <LoadError message={t.today.lessonsFailed} retryLabel={t.common.retry} onRetry={onRetry} />
      ) : isPending ? (
        <ListSkeleton rows={4} />
      ) : lessons.length === 0 ? (
        <Quiet>{t.today.tomorrow.empty}</Quiet>
      ) : (
        <View style={styles.groups}>
          {reminders.length > 0 && (
            <View style={[styles.inOrder, { backgroundColor: c.surface, borderColor: c.line }]}>
              {next ? (
                <>
                  <Button
                    variant="primary"
                    size="md"
                    icon="chat"
                    accessibilityLabel={fmt(t.messages.inOrder.label, { name: next.seat.child.student_name })}
                    onPress={() => send(next)}
                  >
                    {t.messages.inOrder.button}
                  </Button>
                  <Text variant="foot" tone="ink2" numberOfLines={2} style={styles.shrink}>
                    {fmt(t.messages.inOrder.next, { name: next.seat.child.student_name })}
                  </Text>
                </>
              ) : (
                <View style={styles.doneLine}>
                  <Icon name="check" size={16} color={c.positive} weight="semibold" />
                  <Text variant="sub" weight="500" tone="positiveInk" style={styles.shrink}>
                    {t.messages.inOrder.done}
                  </Text>
                </View>
              )}
            </View>
          )}
          {lessons.map((lesson) => (
            <View key={lesson.id}>
              <View style={styles.groupHead}>
                <Text variant="sub" weight="700" tabular>
                  {date(lesson.event_date, { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <LessonShape type={lesson.event_type} size={11} />
                <Text variant="sub" weight="500" numberOfLines={1} style={styles.shrink}>
                  {title(lesson)}
                </Text>
                <Text variant="sub" tone="ink3" numberOfLines={1}>
                  · {labels.ageGroup(lesson.age_group)}
                </Text>
              </View>
              {lesson.seats.length === 0 ? (
                <Quiet>{t.today.emptyLesson}</Quiet>
              ) : (
                <Card inset={52}>
                  {lesson.seats.map((seat) => {
                    const child = seat.child
                    const item = bySeatId.get(seat.id)
                    const done = isSent(seat.id)
                    return (
                      <View key={seat.id} style={[styles.personRow, styles.compact]}>
                        <Peg seat={{ id: seat.id, name: child.student_name, status: seat.status }} size="sm" />
                        <View style={styles.flex}>
                          <ChildName id={child.id} name={child.student_name} />
                          <Text variant="foot" tone="ink3" numberOfLines={1}>
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
      )}
    </Section>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  nameLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 6, rowGap: 4, minWidth: 0, alignSelf: 'flex-start', maxWidth: '100%' },
  quiet: { paddingHorizontal: 4 },
  warnTitle: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  warnIcon: { paddingTop: 1 },
  warnBody: { marginTop: -4, paddingLeft: 31, paddingRight: 4 },
  groups: { gap: 16, marginTop: 4 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 4, marginBottom: 8, minWidth: 0 },
  seat: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  seatHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 16, paddingRight: 12, paddingVertical: 11 },
  actionRow: { paddingLeft: 16, paddingRight: 12, paddingVertical: 11 },
  actionHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // Under the name (past the 38pt tile and its gap); a little into the head line, whose buttons stand taller than the name
  actionBody: { marginLeft: 48, marginTop: -2 },
  compact: { paddingVertical: 9 },
  inOrder: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 18, padding: 10, paddingRight: 14, minHeight: 64 },
  doneLine: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6, minHeight: 42 },
  more: { alignSelf: 'flex-start', marginTop: 6, marginLeft: 4 }
})
