import { useMemo, useState, type ReactNode } from 'react'
import { addDays, differenceInCalendarDays } from 'date-fns'
import { Link } from 'react-aria-components'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckIcon, WhatsappLogoIcon } from '@phosphor-icons/react'
import {
  setAttendance,
  unmarkedSeats,
  type AttendanceStatus,
  type Lesson,
  type Registration,
  type UnmarkedSeat
} from '@hellokido/core/api'
import { localDateKey } from '@hellokido/core/rules/dates.js'
import { whatsAppLink } from '@hellokido/core/rules/phone.js'
import { useMessageWriter, useRecentReminders, useReminderLog, useSeatReminders } from '../../data/messages'
import { keys, useActiveUsage, useLabels, usePendingIncome, useRegistrations } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useToast } from '../../providers/Toasts'
import { useActions } from '../../shell/Actions'
import { Avatar, LoadError, Mark, Skeleton } from '../../ui/Bits'
import { Button, ButtonLink } from '../../ui/Button'
import { CardTabs } from '../../ui/Figures'
import { Band, Card, CardLink } from '../../ui/Page'
import { WhatsAppLink } from '../../ui/PhoneActions'
import { LessonShape } from '../../ui/signature'
import { cx } from '../../ui/cx'
import { endText, formatPeriod, shortDate } from '../children/ChildBits'
import { daysLeft, isEnding, isPaymentDue } from '../children/rules'
import { AttendancePicker } from '../lessons/AttendancePicker'
import { useLessonTitle } from '../lessons/LessonBits'

/** A child's name that opens their page. */
export function ChildLink({ id, name, className }: { id: string; name: string; className?: string }) {
  return (
    <Link
      href={`/children/${id}`}
      className={cx(
        'relative min-w-0 rounded-[0.25rem] text-[0.90625rem] font-medium text-ink no-underline outline-none',
        // A one-line name is a thin target; a fingertip gets the strip above and below it too
        'pointer-coarse:after:absolute pointer-coarse:after:-inset-x-1 pointer-coarse:after:-inset-y-2.5',
        'data-hovered:underline data-hovered:decoration-line-strong data-hovered:underline-offset-[3px] data-focus-visible:ring-2 data-focus-visible:ring-focus',
        className
      )}
    >
      {/* Cut off inside, so the larger touch area is not cut off with it */}
      <span className="block truncate">{name}</span>
    </Link>
  )
}

/** A row of a card: hairline under it, the card's side padding. */
export function CardRow({ children, className }: { children: ReactNode; className?: string }) {
  return <li className={cx('flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 sm:px-5', className)}>{children}</li>
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2 px-4 py-4 sm:px-5">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-11" />
      ))}
    </div>
  )
}

/** The "all done" state inside a card. */
export function CardDone({ title, body }: { title: ReactNode; body?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2.5 px-5 py-12 text-center">
      <span aria-hidden className="grid size-10 place-items-center rounded-tile border border-positive-line text-positive-ink">
        <CheckIcon weight="bold" className="size-[1.125rem]" />
      </span>
      <p className="text-[0.90625rem] font-semibold">{title}</p>
      {body && <p className="max-w-sm text-[0.84375rem] text-ink-3 text-pretty">{body}</p>}
    </div>
  )
}

/** A quiet line inside a card when a list is empty. */
export function CardEmpty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-8 text-center text-sm text-ink-3 sm:px-5">{children}</p>
}

// ---------------------------------------------------------------------------------------------

// The page's figures and its cards count from the same queries

/** Attendance nobody marked in the last 30 days. */
export function useUnmarked(dayKey: string) {
  const key = [...keys.unmarked, dayKey]
  return { key, query: useQuery({ queryKey: key, queryFn: () => unmarkedSeats() }) }
}

/** Unpaid packages and expected fees of active children; free participation never waits for money. */
export function usePaymentsDue() {
  const registrations = useRegistrations()
  const pending = usePendingIncome()
  const byId = useMemo(() => new Map((registrations.data ?? []).map((row) => [row.id, row])), [registrations.data])
  const packages = useMemo(
    () =>
      (registrations.data ?? [])
        .filter(isPaymentDue)
        .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()),
    [registrations.data]
  )
  const fees = useMemo(
    () => (pending.data ?? []).filter((line) => line.source === 'child' && line.registrationId && byId.get(line.registrationId)?.is_active === true),
    [pending.data, byId]
  )
  const families = useMemo(() => new Set([...packages.map((row) => row.id), ...fees.map((line) => line.registrationId)]).size, [packages, fees])
  return { registrations, byId, packages, fees, families, total: packages.length + fees.length }
}

/** Packages that ended or end within a week, with the days left (negative once ended). */
export function useEndingPackages(now: Date) {
  const registrations = useRegistrations()
  const rows = useMemo(
    () => (registrations.data ?? []).filter((row) => isEnding(row, now)).map((child) => ({ child, days: daysLeft(child, now) ?? 0 })),
    [registrations.data, now]
  )
  return { registrations, rows }
}

// ---------------------------------------------------------------------------------------------

/**
 * Attendance nobody marked in the last 30 days, grouped by lesson. Each answer removes its row,
 * so the list empties itself as the work gets done.
 */
export function UnmarkedList({ dayKey }: { dayKey: string }) {
  const i18n = useI18n()
  const { t, fmt, date } = i18n
  const labels = useLabels()
  const toast = useToast()
  const client = useQueryClient()
  const title = useLessonTitle()
  const { key, query } = useUnmarked(dayKey)
  const [saving, setSaving] = useState<Set<string>>(() => new Set())

  const groups = useMemo(() => {
    const list: { lesson: UnmarkedSeat['events']; rows: UnmarkedSeat[] }[] = []
    for (const row of query.data ?? []) {
      const last = list[list.length - 1]
      if (last && last.lesson.id === row.events.id) last.rows.push(row)
      else list.push({ lesson: row.events, rows: [row] })
    }
    return list
  }, [query.data])

  const mark = async (row: UnmarkedSeat, status: AttendanceStatus) => {
    if (saving.has(row.id)) return
    setSaving((set) => new Set(set).add(row.id))
    try {
      await setAttendance(row.id, status)
      client.setQueryData<UnmarkedSeat[]>(key, (list) => list?.filter((item) => item.id !== row.id))
      void client.invalidateQueries({ queryKey: ['usage'] })
      void client.invalidateQueries({ queryKey: keys.childLessons(row.registration_id) })
      void client.invalidateQueries({ queryKey: ['lessons'], refetchType: 'none' })
    } catch {
      toast({ tone: 'error', title: t.children.detail.statusFailed })
    } finally {
      setSaving((set) => {
        const next = new Set(set)
        next.delete(row.id)
        return next
      })
    }
  }

  if (query.isError) return <div className="p-4 sm:p-5"><LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={() => void query.refetch()} /></div>
  if (query.isPending) return <ListSkeleton rows={4} />
  if (groups.length === 0) return <CardDone title={t.today.lessonsCard.allDone} body={t.today.lessonsCard.allDoneBody} />

  return (
    <div>
      <Band className="hidden gap-x-5 lg:flex">
        <span className="min-w-0 flex-[1.6_1_15rem]">{t.today.lessonsCard.child}</span>
        <span className="min-w-0 flex-[2.1_1_20rem]">{t.today.lessonsCard.parent}</span>
        <span className="w-[17rem] shrink-0">{t.today.lessonsCard.attendance}</span>
      </Band>
      {groups.map((group) => (
        <div key={group.lesson.id}>
          <Band className="text-[0.84375rem] text-ink">
            <LessonShape type={group.lesson.event_type} />
            <span className="min-w-0 flex-1 truncate font-semibold">
              {date(group.lesson.event_date, { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} · {title(group.lesson)} ·{' '}
              {labels.ageGroup(group.lesson.age_group)}
            </span>
            <span className="text-[0.8125rem] text-ink-3 tabular">{group.rows.length}</span>
          </Band>
          <ul>
            {group.rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-x-5 gap-y-2.5 border-b border-line px-4 py-[0.6875rem] sm:px-5">
                <div className="flex min-w-0 flex-[1.6_1_15rem] items-center gap-3">
                  <Avatar name={row.child.student_name} />
                  <p className="flex min-w-0 items-center gap-2">
                    <ChildLink id={row.child.id} name={row.child.student_name} />
                    {row.child.is_active !== true && <Mark tone="neutral">{t.today.archived}</Mark>}
                  </p>
                </div>
                <span className="min-w-0 flex-[2.1_1_20rem] truncate text-sm text-ink-2 max-lg:hidden">{row.child.parent_name}</span>
                <AttendancePicker
                  status={row.status}
                  onChange={(status) => void mark(row, status)}
                  isDisabled={saving.has(row.id)}
                  label={fmt(t.children.detail.lessonStatus, { name: row.child.student_name })}
                  className="w-full shrink-0 sm:w-[17rem]"
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------

/**
 * Tomorrow's lessons with a WhatsApp reminder for every family. Sent ones are recorded in the
 * shared log, so both admins see the same ticks on every device; "Send the next one" opens the
 * next family's chat each time it is pressed.
 */
export function TomorrowCard({
  lessons,
  isPending,
  isError,
  onRetry,
  now,
  className
}: {
  lessons: Lesson[]
  isPending: boolean
  isError: boolean
  onRetry: () => void
  now: Date
  className?: string
}) {
  const i18n = useI18n()
  const { t, fmt, date, plural } = i18n
  const labels = useLabels()
  const title = useLessonTitle()
  const write = useMessageWriter()
  const usage = useActiveUsage().data
  const seatIds = useMemo(() => lessons.flatMap((lesson) => lesson.seats.map((seat) => seat.id)), [lessons])
  const { bySeat } = useSeatReminders(seatIds)
  const { log, unlog } = useReminderLog()
  // A tap shows at once; the shared log catches up a moment later
  const [local, setLocal] = useState<Record<string, boolean>>({})
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

  const send = (item: (typeof reminders)[number]) => {
    setLocal((current) => ({ ...current, [item.seat.id]: true }))
    log(
      { kind: 'lesson', registrationId: item.seat.registration_id, participantId: item.seat.id, templateId: item.templateId },
      { onSettled: () => settle(item.seat.id) }
    )
  }
  const takeBack = (seatId: string) => {
    const entry = bySeat.get(seatId)
    setLocal((current) => ({ ...current, [seatId]: false }))
    if (entry) unlog(entry.id, { onSettled: () => settle(seatId) })
    else settle(seatId)
  }

  const children = new Set(lessons.flatMap((lesson) => lesson.seats.map((seat) => seat.registration_id))).size
  const tomorrow = addDays(now, 1)
  const day = date(tomorrow, { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <Card
      id="tomorrow"
      className={className}
      title={t.today.tomorrow.title}
      description={lessons.length > 0 ? `${day} · ${plural(t.today.lessonCount, lessons.length)}, ${plural(t.today.childCount, children)}` : day}
      aside={
        reminders.length > 0 && (
          <Mark tone={allSent ? 'positive' : 'neutral'} className={allSent ? undefined : 'text-ink-2'}>
            {fmt(t.today.tomorrow.progress, { sent, total: reminders.length })}
          </Mark>
        )
      }
      bodyClassName="overflow-y-auto"
      footer={
        <>
          {next && next.chat ? (
            <span className="flex min-w-0 items-center gap-3">
              <ButtonLink
                href={next.chat}
                target="_blank"
                rel="noopener noreferrer"
                size="sm"
                variant="primary"
                aria-label={fmt(t.messages.inOrder.label, { name: next.seat.child.student_name })}
                onPress={() => send(next)}
                icon={<WhatsappLogoIcon aria-hidden className="size-4" />}
                className="shrink-0 max-lg:h-10"
              >
                {t.messages.inOrder.button}
              </ButtonLink>
              <span className="truncate">{fmt(t.messages.inOrder.next, { name: next.seat.child.student_name })}</span>
            </span>
          ) : (
            <span>{allSent ? t.messages.inOrder.done : t.today.tomorrow.foot}</span>
          )}
          <CardLink href="/calendar">{t.shell.nav.calendar}</CardLink>
        </>
      }
    >
      {isError ? (
        <div className="p-4 sm:p-5">
          <LoadError message={t.today.lessonsFailed} retryLabel={t.common.retry} onRetry={onRetry} />
        </div>
      ) : isPending ? (
        <ListSkeleton rows={4} />
      ) : lessons.length === 0 ? (
        <CardEmpty>{t.today.tomorrow.empty}</CardEmpty>
      ) : (
        lessons.map((lesson) => (
          <div key={lesson.id}>
            <Band sticky className="font-semibold text-ink-2">
              <span className="text-ink tabular">{date(lesson.event_date, { hour: '2-digit', minute: '2-digit' })}</span>
              <LessonShape type={lesson.event_type} />
              <span className="min-w-0 flex-1 truncate">
                {title(lesson)} · {labels.ageGroup(lesson.age_group)}
              </span>
              <span className="tabular">{lesson.seats.length}</span>
            </Band>
            {lesson.seats.length === 0 ? (
              <p className="border-b border-line px-4 py-3 text-sm text-ink-3 sm:px-5">{t.today.emptyLesson}</p>
            ) : (
              <ul>
                {lesson.seats.map((seat) => {
                  const child = seat.child
                  const item = bySeatId.get(seat.id)
                  const done = isSent(seat.id)
                  return (
                    <CardRow key={seat.id} className="last:border-b">
                      <Avatar name={child.student_name} />
                      <div className="min-w-0 flex-1">
                        <ChildLink id={child.id} name={child.student_name} className="block" />
                        <p className="mt-px truncate text-[0.8125rem] text-ink-3">{fmt(t.today.lessonsCard.parentOf, { name: child.parent_name })}</p>
                      </div>
                      {seat.status !== 'scheduled' ? (
                        <Mark tone="neutral">{labels.attendance(seat.status)}</Mark>
                      ) : !item ? null : done ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`${t.today.tomorrow.sent}. ${t.messages.undo}`}
                          onPress={() => takeBack(seat.id)}
                          className="shrink-0 text-ink-3 max-lg:h-10"
                          icon={<CheckIcon aria-hidden weight="bold" className="size-4 text-whatsapp" />}
                        >
                          {t.today.tomorrow.sent}
                        </Button>
                      ) : (
                        <ButtonLink
                          href={item.chat!}
                          target="_blank"
                          rel="noopener noreferrer"
                          size="sm"
                          aria-label={fmt(t.today.tomorrow.remindLabel, { name: child.student_name })}
                          onPress={() => send(item)}
                          className="shrink-0 max-lg:h-10"
                          icon={<WhatsappLogoIcon aria-hidden className="size-4 text-whatsapp" />}
                        >
                          {t.today.tomorrow.remind}
                        </ButtonLink>
                      )}
                    </CardRow>
                  )
                })}
              </ul>
            )}
          </div>
        ))
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------------------------

// Ended packages shown before the rest fold away; a couple more than this are shown in full
const ENDED_FIRST = 5

export type WorkTab = 'pay' | 'renew'

/** Payments due and packages to renew, one card with two views. */
export function WorkCard({ now, tab, onTab, className }: { now: Date; tab: WorkTab; onTab: (tab: WorkTab) => void; className?: string }) {
  const i18n = useI18n()
  const { t, fmt, money, plural } = i18n
  const labels = useLabels()
  const { startTask } = useActions()
  const payments = usePaymentsDue()
  const ending = useEndingPackages(now)
  const [unfolded, setUnfolded] = useState(false)
  const write = useMessageWriter()
  const { log } = useReminderLog()
  const dayKey = localDateKey(now) as string
  const paid = useRecentReminders('payment', dayKey).byChild
  const ends = useRecentReminders('package_end', dayKey).byChild

  // "Reminded yesterday" next to a family, so nobody is chased twice in a day
  const remindedText = (sentAt: string | undefined) => {
    if (!sentAt) return null
    const days = differenceInCalendarDays(now, new Date(sentAt))
    return days <= 0 ? t.messages.reminded.today : days === 1 ? t.messages.reminded.yesterday : plural(t.messages.reminded.days, days)
  }

  // The soonest end first; ended ones from the latest, as the oldest are often children who left
  const soon = ending.rows.filter((row) => row.days >= 0).sort((a, b) => a.days - b.days)
  const ended = ending.rows.filter((row) => row.days < 0).sort((a, b) => b.days - a.days)
  const endedShown = unfolded || ended.length <= ENDED_FIRST + 2 ? ended : ended.slice(0, ENDED_FIRST)

  const row = (
    child: Registration,
    key: string,
    meta: ReactNode,
    chip: ReactNode,
    remind: { kind: 'payment' | 'package_end'; text: string; templateId: string | null; label: string; sentAt?: string },
    action: { label: string; onPress: () => void }
  ) => (
    <CardRow key={key} className="flex-wrap sm:flex-nowrap">
      <Avatar name={child.student_name} />
      <div className="min-w-0 flex-1 basis-40">
        <ChildLink id={child.id} name={child.student_name} className="block" />
        <p className="mt-px truncate text-[0.8125rem] text-ink-3">
          {meta}
          {remind.sentAt && (
            <span className="text-positive-ink">
              {' · '}
              {remindedText(remind.sentAt)}
            </span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 max-sm:w-full max-sm:pl-12">
        {chip}
        <span className="flex-1 sm:hidden" />
        <WhatsAppLink
          phone={child.parent_phone}
          text={remind.text}
          label={remind.label}
          className="max-lg:size-10"
          onPress={() => log({ kind: remind.kind, registrationId: child.id, templateId: remind.templateId })}
        />
        <Button size="sm" variant="secondary" className="shrink-0 max-lg:h-10" onPress={action.onPress}>
          {action.label}
        </Button>
      </div>
    </CardRow>
  )

  const loading = tab === 'pay' ? payments.registrations : ending.registrations
  const list =
    tab === 'pay' ? (
      payments.total === 0 ? (
        <CardEmpty>{t.today.payments.empty}</CardEmpty>
      ) : (
        <ul>
          {payments.packages.map((child) =>
            row(
              child,
              child.id,
              `${labels.packageName(child.package_type)} · ${formatPeriod(i18n, child.package_start_date, child.package_end_date)}`,
              <Mark tone="action">{t.today.work.package}</Mark>,
              {
                kind: 'payment',
                ...write('payment', {
                  parentName: child.parent_name,
                  childName: child.student_name,
                  packageCode: child.package_type,
                  endDate: child.package_end_date,
                  amount: Number(child.payment_amount) > 0 ? money(Number(child.payment_amount)) : null,
                  now
                }),
                label: fmt(t.today.payments.remindLabel, { name: child.student_name }),
                sentAt: paid.get(child.id)?.sent_at
              },
              { label: t.today.payments.collect, onPress: () => startTask('payment', { registrationId: child.id, choice: 'collect' }) }
            )
          )}
          {payments.fees.map((line) => {
            const child = payments.byId.get(line.registrationId!)!
            return row(
              child,
              line.key,
              `${line.description || t.children.detail.fee} · ${fmt(t.today.payments.expected, { amount: money(line.amount) })}`,
              <Mark tone="action">
                {line.dueDate ? fmt(t.today.work.dueOn, { date: shortDate(i18n, `${line.dueDate}T00:00:00`) }) : t.children.detail.fee}
              </Mark>,
              {
                kind: 'payment',
                ...write('payment', {
                  parentName: child.parent_name,
                  childName: child.student_name,
                  packageCode: child.package_type,
                  endDate: child.package_end_date,
                  amount: money(line.amount),
                  now
                }),
                label: fmt(t.today.payments.remindLabel, { name: child.student_name }),
                sentAt: paid.get(child.id)?.sent_at
              },
              { label: t.today.payments.collect, onPress: () => startTask('payment', { registrationId: child.id, choice: 'collect', entryId: line.id }) }
            )
          })}
        </ul>
      )
    ) : ending.rows.length === 0 ? (
      <CardEmpty>{t.today.ending.empty}</CardEmpty>
    ) : (
      <>
        {[
          { id: 'soon', label: t.today.ending.soon, rows: soon, all: soon.length },
          { id: 'ended', label: t.today.ending.ended, rows: endedShown, all: ended.length }
        ]
          .filter((group) => group.all > 0)
          .map((group) => (
            <div key={group.id}>
              <Band sticky className="justify-between font-semibold text-ink-2">
                <span>{group.label}</span>
                <span className="tabular">{group.all}</span>
              </Band>
              <ul>
                {group.rows.map(({ child, days }) =>
                  row(
                    child,
                    child.id,
                    `${labels.packageName(child.package_type)} · ${formatPeriod(i18n, child.package_start_date, child.package_end_date)}`,
                    <Mark tone={days < 0 ? 'negative' : 'action'}>{endText(i18n, days)}</Mark>,
                    {
                      kind: 'package_end',
                      ...write('package_end', {
                        parentName: child.parent_name,
                        childName: child.student_name,
                        packageCode: child.package_type,
                        endDate: child.package_end_date,
                        now
                      }),
                      label: fmt(t.today.ending.remindLabel, { name: child.student_name }),
                      sentAt: ends.get(child.id)?.sent_at
                    },
                    { label: t.today.ending.renew, onPress: () => startTask('payment', { registrationId: child.id, choice: 'renew' }) }
                  )
                )}
              </ul>
              {group.id === 'ended' && endedShown.length < ended.length && (
                <div className="px-2 py-2 sm:px-3">
                  <Button variant="ghost" size="sm" onPress={() => setUnfolded(true)}>
                    {plural(t.today.ending.showMore, ended.length - endedShown.length)}
                  </Button>
                </div>
              )}
            </div>
          ))}
      </>
    )

  return (
    <Card
      id="work"
      className={className}
      title={t.today.work.title}
      description={tab === 'pay' ? t.today.work.payBody : t.today.work.renewBody}
      aside={
        <CardTabs<WorkTab>
          label={t.today.work.which}
          value={tab}
          onChange={onTab}
          options={[
            { id: 'pay', label: t.today.work.pay, count: payments.total },
            { id: 'renew', label: t.today.work.renew, count: ending.rows.length }
          ]}
        />
      }
      bodyClassName="overflow-y-auto"
      footer={
        <>
          <span>{tab === 'pay' ? (payments.families > 0 ? plural(t.today.work.payFoot, payments.families) : t.today.payments.empty) : t.today.work.renewFoot}</span>
          <CardLink href={tab === 'pay' ? '/finance' : '/children'}>{tab === 'pay' ? t.today.work.toFinance : t.today.work.toChildren}</CardLink>
        </>
      }
    >
      {loading.isError ? (
        <div className="p-4 sm:p-5">
          <LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={() => void loading.refetch()} />
        </div>
      ) : !loading.data ? (
        <ListSkeleton />
      ) : (
        list
      )}
    </Card>
  )
}
