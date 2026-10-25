import { useId, useMemo, useState, type ReactNode } from 'react'
import { addDays, differenceInCalendarDays } from 'date-fns'
import { Link } from 'react-aria-components'
import { useQueryClient } from '@tanstack/react-query'
import { BellSimpleIcon, CheckIcon, ClipboardTextIcon, WhatsappLogoIcon } from '@phosphor-icons/react'
import { setAttendance, type AttendanceStatus, type Lesson, type Registration, type Seat, type UnmarkedSeat } from '@hellokido/core/api'
import { whatsAppLink } from '@hellokido/core/rules/phone.js'
import { useMessageWriter, useRecentReminders, useReminderLog, useSeatReminders } from '../../data/messages'
import { keys, useActiveUsage, useLabels } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useToast } from '../../providers/Toasts'
import { useActions } from '../../shell/Actions'
import { Avatar, IconDisc, LoadError, Mark, Skeleton } from '../../ui/Bits'
import { Button, ButtonLink } from '../../ui/Button'
import { CardTabs } from '../../ui/Figures'
import { Band, Card, CardLink } from '../../ui/Page'
import { WhatsAppLink } from '../../ui/PhoneActions'
import { LessonShape } from '../../ui/signature'
import { cx } from '../../ui/cx'
import { endText, formatPeriod, shortDate } from '../children/ChildBits'
import { AttendancePicker } from '../lessons/AttendancePicker'
import { useLessonTitle } from '../lessons/LessonBits'
import type { useWaiting } from './data'

/** A child's name that opens their page; takes the colour of the text around it. */
export function ChildLink({ id, name, className }: { id: string; name: string; className?: string }) {
  return (
    <Link
      href={`/children/${id}`}
      className={cx(
        'relative min-w-0 rounded-[0.25rem] text-[0.96875rem] leading-[1.3125rem] font-medium no-underline outline-none',
        // A one-line name is a thin target; a fingertip gets the strip above and below it too
        'pointer-coarse:after:absolute pointer-coarse:after:-inset-x-1 pointer-coarse:after:-inset-y-2.5',
        'data-hovered:underline data-hovered:decoration-1 data-hovered:underline-offset-[3px] data-focus-visible:ring-2 data-focus-visible:ring-focus',
        className
      )}
    >
      {/* Cut off inside, so the larger touch area is not cut off with it */}
      <span className="block truncate">{name}</span>
    </Link>
  )
}

/** A row of a felt card: 22 side padding, a line between rows. */
export function CardRow({ children, className }: { children: ReactNode; className?: string }) {
  return <li className={cx('flex items-center gap-3 border-t border-line px-4 py-[0.6875rem] first:border-t-0 sm:px-[1.375rem]', className)}>{children}</li>
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2 px-4 py-4 sm:px-[1.375rem]">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-11" />
      ))}
    </div>
  )
}

/** The "all done" state inside a card. */
export function CardDone({ title, body }: { title: ReactNode; body?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2.5 px-5 py-10 text-center">
      <span aria-hidden className="grid size-10 place-items-center rounded-full bg-piece text-green-ink">
        <CheckIcon weight="bold" className="size-[1.125rem]" />
      </span>
      <p className="text-[0.96875rem] font-semibold">{title}</p>
      {body && <p className="max-w-sm text-[0.84375rem] text-ink-3 text-pretty">{body}</p>}
    </div>
  )
}

/** A quiet line inside a card when a list is empty. */
export function CardEmpty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-8 text-center text-[0.9375rem] text-ink-3 sm:px-[1.375rem]">{children}</p>
}

// ---------------------------------------------------------------------------------------------

// Ended packages shown before the rest fold away; a couple more than this are shown in full
const ENDED_FIRST = 5

export type WorkTab = 'all' | 'attendance' | 'pay' | 'renew'

type Waiting = ReturnType<typeof useWaiting>

/** "Ege Arslan ve Lina Koç", or the first three and "+2". */
function useNames() {
  const { tag } = useI18n()
  return (names: string[]) => {
    const list = new Intl.ListFormat(tag, { style: 'long', type: 'conjunction' })
    return names.length <= 3 ? list.format(names) : `${names.slice(0, 3).join(', ')} +${names.length - 3}`
  }
}

/**
 * Everything waiting for the admin in one card: missing attendance (grouped by lesson, entered in
 * place), payments due and packages to renew. Each row carries its own action.
 */
export function WaitingCard({
  waiting,
  tab,
  onTab,
  saving,
  onMarkToday,
  className
}: {
  waiting: Waiting
  tab: WorkTab
  onTab: (tab: WorkTab) => void
  /** Seats of today's lessons being saved, and the page's own optimistic answer for them. */
  saving: Set<string>
  onMarkToday: (seat: Seat, status: AttendanceStatus) => void
  className?: string
}) {
  const { t, plural, money } = useI18n()
  const { counts, total, payments, ending } = waiting
  const show = (which: Exclude<WorkTab, 'all'>) => tab === 'all' || tab === which

  const payTotal = payments.packages.reduce((sum, child) => sum + (Number(child.payment_amount) || 0), 0) + payments.fees.reduce((sum, line) => sum + line.amount, 0)
  const soon = ending.rows.filter((row) => row.days >= 0).sort((a, b) => a.days - b.days)
  const ended = ending.rows.filter((row) => row.days < 0).sort((a, b) => b.days - a.days)

  const loading = !waiting.ready
  const loadError = waiting.unmarked.query.isError || payments.registrations.isError
  const empty =
    tab === 'all' ? total === 0 : tab === 'attendance' ? counts.attendance === 0 : tab === 'pay' ? counts.pay === 0 : counts.renew === 0

  return (
    <Card
      id="work"
      className={cx('outline-none', className)}
      title={t.today.board.waitingTitle}
      aside={waiting.ready ? plural(t.today.board.jobs, total) : undefined}
      bodyClassName="flex flex-col"
      footer={
        tab === 'pay' && counts.pay > 0 ? (
          <>
            <span>{plural(t.today.work.payFoot, payments.families)}</span>
            <CardLink href="/finance">{t.today.work.toFinance}</CardLink>
          </>
        ) : tab === 'renew' && counts.renew > 0 ? (
          <>
            <span>{t.today.work.renewFoot}</span>
            <CardLink href="/children">{t.today.work.toChildren}</CardLink>
          </>
        ) : undefined
      }
    >
      <div className="pb-2 sm:px-[1.375rem]">
        <CardTabs<WorkTab>
          fill
          className="max-sm:px-4"
          label={t.today.work.which}
          value={tab}
          onChange={onTab}
          options={[
            // The card's header already carries the total
            { id: 'all', label: t.today.web.all },
            { id: 'attendance', label: t.today.overview.attendance, count: counts.attendance, countTone: counts.attendance > 0 ? 'action' : 'muted' },
            { id: 'pay', label: t.today.work.pay, count: counts.pay },
            { id: 'renew', label: t.today.work.renew, count: counts.renew }
          ]}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-2 lg:max-h-[40rem]">
        {loadError ? (
          <div className="p-4 sm:px-[1.375rem]">
            <LoadError
              message={t.common.loadFailed}
              retryLabel={t.common.retry}
              onRetry={() => {
                void waiting.unmarked.query.refetch()
                void payments.registrations.refetch()
              }}
            />
          </div>
        ) : loading ? (
          <ListSkeleton rows={4} />
        ) : empty ? (
          tab === 'attendance' ? (
            <CardDone title={t.today.lessonsCard.allDone} body={t.today.lessonsCard.allDoneBody} />
          ) : tab === 'pay' ? (
            <CardEmpty>{t.today.payments.empty}</CardEmpty>
          ) : tab === 'renew' ? (
            <CardEmpty>{t.today.ending.empty}</CardEmpty>
          ) : (
            <CardDone title={t.today.nothingWaiting} />
          )
        ) : (
          <>
            {show('attendance') && counts.attendance > 0 && <AttendanceGroup waiting={waiting} saving={saving} onMarkToday={onMarkToday} />}
            {show('pay') && counts.pay > 0 && (
              <Group label={t.today.overview.payments} aside={payTotal > 0 ? money(payTotal) : undefined}>
                <PaymentRows waiting={waiting} />
              </Group>
            )}
            {show('renew') && soon.length > 0 && (
              <Group label={t.today.web.soonGroup} aside={t.today.web.withinWeek}>
                <RenewRows rows={soon} now={waiting.now} dayKey={waiting.dayKey} />
              </Group>
            )}
            {show('renew') && ended.length > 0 && (
              <Group label={t.today.web.endedGroup} aside={String(ended.length)}>
                <RenewRows rows={ended} now={waiting.now} dayKey={waiting.dayKey} fold />
              </Group>
            )}
          </>
        )}
      </div>
    </Card>
  )
}

function Group({ label, aside, children }: { label: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <Band sticky className="justify-between">
        <span>{label}</span>
        {aside && <span className="font-medium text-ink-3 tabular">{aside}</span>}
      </Band>
      {children}
    </div>
  )
}

/** Missing attendance, one row per lesson; "Gir" opens the children of that lesson in place. */
function AttendanceGroup({ waiting, saving, onMarkToday }: { waiting: Waiting; saving: Set<string>; onMarkToday: (seat: Seat, status: AttendanceStatus) => void }) {
  const { t, fmt, plural, date } = useI18n()
  const title = useLessonTitle()
  const names = useNames()
  const toast = useToast()
  const client = useQueryClient()
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const [busy, setBusy] = useState<Set<string>>(() => new Set())
  const { key } = waiting.unmarked

  // Today's ended lessons first (newest first), then the past days' lessons, newest first
  const lessons = useMemo(() => {
    const past: { id: string; lesson: UnmarkedSeat['events']; rows: { id: string; registrationId: string; child: { id: string; student_name: string; is_active: boolean | null }; past?: UnmarkedSeat; seat?: Seat }[] }[] = []
    for (const item of [...waiting.earlier].reverse()) {
      past.push({
        id: item.lesson.id,
        lesson: item.lesson,
        rows: item.seats.map((seat) => ({ id: seat.id, registrationId: seat.registration_id, child: seat.child, seat }))
      })
    }
    const byLesson = new Map<string, (typeof past)[number]>()
    for (const row of [...(waiting.unmarked.query.data ?? [])].sort((a, b) => b.events.event_date.localeCompare(a.events.event_date))) {
      let group = byLesson.get(row.events.id)
      if (!group) {
        group = { id: row.events.id, lesson: row.events, rows: [] }
        byLesson.set(row.events.id, group)
        past.push(group)
      }
      group.rows.push({ id: row.id, registrationId: row.registration_id, child: row.child, past: row })
    }
    return past
  }, [waiting.earlier, waiting.unmarked.query.data])

  const markPast = async (row: UnmarkedSeat, status: AttendanceStatus) => {
    if (busy.has(row.id)) return
    setBusy((set) => new Set(set).add(row.id))
    try {
      await setAttendance(row.id, status)
      client.setQueryData<UnmarkedSeat[]>(key, (list) => list?.filter((item) => item.id !== row.id))
      void client.invalidateQueries({ queryKey: ['usage'] })
      void client.invalidateQueries({ queryKey: keys.childLessons(row.registration_id) })
      void client.invalidateQueries({ queryKey: ['lessons'], refetchType: 'none' })
    } catch {
      toast({ tone: 'error', title: t.children.detail.statusFailed })
    } finally {
      setBusy((set) => {
        const next = new Set(set)
        next.delete(row.id)
        return next
      })
    }
  }

  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <Group label={t.today.strip.unmarkedShort} aside={plural(t.today.board.inLessons, lessons.length)}>
      <ul>
        {lessons.map((group) => (
          <AttendanceLesson
            key={group.id}
            heading={`${date(group.lesson.event_date, { weekday: 'long', hour: '2-digit', minute: '2-digit' })}, ${title(group.lesson)}`}
            sub={fmt(t.today.web.notMarked, { names: names(group.rows.map((row) => row.child.student_name)) })}
            isOpen={open.has(group.id)}
            onToggle={() => toggle(group.id)}
          >
            {group.rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2">
                <Avatar name={row.child.student_name} size="sm" />
                <span className="flex min-w-0 flex-[1_1_8rem] items-center gap-2">
                  <ChildLink id={row.child.id} name={row.child.student_name} />
                  {row.child.is_active !== true && <Mark tone="neutral">{t.today.archived}</Mark>}
                </span>
                <AttendancePicker
                  status={row.past?.status ?? row.seat?.status ?? 'scheduled'}
                  onChange={(status) => (row.past ? void markPast(row.past, status) : row.seat && onMarkToday(row.seat, status))}
                  isDisabled={busy.has(row.id) || saving.has(row.id)}
                  label={fmt(t.children.detail.lessonStatus, { name: row.child.student_name })}
                  className="w-full sm:w-[14.5rem]"
                />
              </li>
            ))}
          </AttendanceLesson>
        ))}
      </ul>
    </Group>
  )
}

function AttendanceLesson({
  heading,
  sub,
  isOpen,
  onToggle,
  children
}: {
  heading: string
  sub: string
  isOpen: boolean
  onToggle: () => void
  children: ReactNode
}) {
  const { t } = useI18n()
  const listId = useId()
  return (
    <li className="border-t border-line px-4 py-[0.6875rem] first:border-t-0 sm:px-[1.375rem]">
      <div className="flex items-center gap-3">
        <IconDisc alert>
          <ClipboardTextIcon className="size-[1.125rem]" />
        </IconDisc>
        <div className="min-w-0 flex-1">
          {/* A phone-wide row gives the lesson and its names a second line rather than an ellipsis */}
          <p className="text-[0.96875rem] leading-[1.3125rem] font-medium first-letter:uppercase max-sm:line-clamp-2 sm:truncate">{heading}</p>
          <p className="text-[0.84375rem] leading-[1.125rem] text-ink-3 max-sm:line-clamp-2 sm:truncate">{sub}</p>
        </div>
        <Button size="sm" variant="secondary" aria-expanded={isOpen} aria-controls={listId} onPress={onToggle} className="shrink-0 max-lg:h-10">
          {isOpen ? t.common.close : t.today.board.enter}
        </Button>
      </div>
      {isOpen && (
        <ul id={listId} className="mt-1.5 pl-12 max-sm:pl-0">
          {children}
        </ul>
      )}
    </li>
  )
}

function useRemindedText(now: Date) {
  const { t, plural } = useI18n()
  // "Reminded yesterday" next to a family, so nobody is chased twice in a day
  return (sentAt: string | undefined) => {
    if (!sentAt) return null
    const days = differenceInCalendarDays(now, new Date(sentAt))
    return days <= 0 ? t.messages.reminded.today : days === 1 ? t.messages.reminded.yesterday : plural(t.messages.reminded.days, days)
  }
}

/** A child's row: avatar, name, a concrete sub-line, a mark, WhatsApp and one action. */
function WorkRow({
  child,
  meta,
  mark,
  remind,
  action,
  now
}: {
  child: Registration
  meta: ReactNode
  mark?: ReactNode
  remind: { kind: 'payment' | 'package_end'; text: string; templateId: string | null; label: string; sentAt?: string }
  action: { label: string; onPress: () => void }
  now: Date
}) {
  const { log } = useReminderLog()
  const reminded = useRemindedText(now)(remind.sentAt)
  return (
    <CardRow className="flex-wrap sm:flex-nowrap">
      <Avatar name={child.student_name} />
      <div className="min-w-0 flex-1 basis-40">
        <ChildLink id={child.id} name={child.student_name} className="block" />
        <p className="truncate text-[0.84375rem] leading-[1.125rem] text-ink-3">
          {meta}
          {reminded && (
            <span className="text-green-ink">
              {', '}
              {reminded}
            </span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 max-sm:w-full max-sm:pl-12">
        {mark}
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
}

function PaymentRows({ waiting }: { waiting: Waiting }) {
  const i18n = useI18n()
  const { t, fmt, money } = i18n
  const labels = useLabels()
  const { startTask } = useActions()
  const write = useMessageWriter()
  const { payments, now, dayKey } = waiting
  const paid = useRecentReminders('payment', dayKey).byChild
  return (
    <ul>
      {payments.packages.map((child) => {
        const amount = Number(child.payment_amount) > 0 ? money(Number(child.payment_amount)) : null
        return (
          <WorkRow
            key={child.id}
            now={now}
            child={child}
            meta={[labels.packageName(child.package_type), amount ?? formatPeriod(i18n, child.package_start_date, child.package_end_date)].join(', ')}
            remind={{
              kind: 'payment',
              ...write('payment', { parentName: child.parent_name, childName: child.student_name, packageCode: child.package_type, endDate: child.package_end_date, amount, now }),
              label: fmt(t.today.payments.remindLabel, { name: child.student_name }),
              sentAt: paid.get(child.id)?.sent_at
            }}
            action={{ label: t.today.payments.collect, onPress: () => startTask('payment', { registrationId: child.id, choice: 'collect' }) }}
          />
        )
      })}
      {payments.fees.map((line) => {
        const child = payments.byId.get(line.registrationId!)!
        return (
          <WorkRow
            key={line.key}
            now={now}
            child={child}
            meta={`${line.description || t.children.detail.fee}, ${money(line.amount)}`}
            mark={line.dueDate ? <Mark tone="action">{fmt(t.today.work.dueOn, { date: shortDate(i18n, `${line.dueDate}T00:00:00`) })}</Mark> : undefined}
            remind={{
              kind: 'payment',
              ...write('payment', { parentName: child.parent_name, childName: child.student_name, packageCode: child.package_type, endDate: child.package_end_date, amount: money(line.amount), now }),
              label: fmt(t.today.payments.remindLabel, { name: child.student_name }),
              sentAt: paid.get(child.id)?.sent_at
            }}
            action={{ label: t.today.payments.collect, onPress: () => startTask('payment', { registrationId: child.id, choice: 'collect', entryId: line.id }) }}
          />
        )
      })}
    </ul>
  )
}

function RenewRows({ rows, now, dayKey, fold }: { rows: { child: Registration; days: number }[]; now: Date; dayKey: string; fold?: boolean }) {
  const i18n = useI18n()
  const { t, fmt, plural } = i18n
  const labels = useLabels()
  const { startTask } = useActions()
  const write = useMessageWriter()
  const ends = useRecentReminders('package_end', dayKey).byChild
  const [unfolded, setUnfolded] = useState(false)
  const shown = !fold || unfolded || rows.length <= ENDED_FIRST + 2 ? rows : rows.slice(0, ENDED_FIRST)
  return (
    <>
      <ul>
        {shown.map(({ child, days }) => (
          <WorkRow
            key={child.id}
            now={now}
            child={child}
            meta={labels.packageName(child.package_type)}
            mark={<Mark tone="action">{endText(i18n, days)}</Mark>}
            remind={{
              kind: 'package_end',
              ...write('package_end', { parentName: child.parent_name, childName: child.student_name, packageCode: child.package_type, endDate: child.package_end_date, now }),
              label: fmt(t.today.ending.remindLabel, { name: child.student_name }),
              sentAt: ends.get(child.id)?.sent_at
            }}
            action={{ label: t.today.ending.renew, onPress: () => startTask('payment', { registrationId: child.id, choice: 'renew' }) }}
          />
        ))}
      </ul>
      {shown.length < rows.length && (
        <div className="px-2.5 py-1.5 sm:px-3.5">
          <Button variant="ghost" size="sm" onPress={() => setUnfolded(true)}>
            {plural(t.today.ending.showMore, rows.length - shown.length)}
          </Button>
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------------------------

/**
 * Tomorrow's reminders: one line with the progress and "Send the next one" (it opens the next
 * family's chat each time), then each lesson's families with their own reminder. Sent ones are
 * recorded in the shared log, so both admins see the same ticks on every device.
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

  const families = new Set(lessons.flatMap((lesson) => lesson.seats.map((seat) => seat.registration_id))).size
  const day = date(addDays(now, 1), { weekday: 'long', day: 'numeric', month: 'long' })
  const line =
    lessons.length > 0
      ? [
          fmt(t.today.web.tomorrowLine, { day, lessons: plural(t.today.lessonCount, lessons.length), parents: plural(t.today.web.parents, families) }),
          next ? fmt(t.today.web.nextFamily, { name: `${next.seat.child.parent_name ?? ''} (${next.seat.child.student_name})`.trim() }) : allSent ? t.messages.inOrder.done : null
        ]
          .filter(Boolean)
          .join('; ')
      : `${day}: ${t.today.tomorrow.empty}`

  return (
    <section id="tomorrow" aria-labelledby="tomorrow-title" className={cx('on-felt overflow-hidden rounded-tile bg-felt', className)}>
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5 px-4 py-3.5 sm:px-[1.125rem]">
        <IconDisc>
          <BellSimpleIcon className="size-[1.125rem]" />
        </IconDisc>
        <div className="min-w-0 flex-[1_1_14rem]">
          <h2 id="tomorrow-title" className="truncate text-[0.96875rem] leading-[1.3125rem] font-medium">
            {lessons.length > 0 ? t.today.board.tomorrowReminders : t.today.tomorrow.title}
          </h2>
          <p className="text-[0.84375rem] leading-[1.125rem] text-ink-3 first-letter:uppercase">{line}</p>
        </div>
        {reminders.length > 0 && (
          <span className={cx('text-[0.8125rem] font-medium whitespace-nowrap tabular', allSent ? 'text-green-ink' : 'text-ink-3')}>
            {fmt(t.today.tomorrow.progress, { sent, total: reminders.length })}
          </span>
        )}
        {next && next.chat && (
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
        )}
      </div>
      {isError ? (
        <div className="px-4 pb-4 sm:px-[1.125rem]">
          <LoadError message={t.today.lessonsFailed} retryLabel={t.common.retry} onRetry={onRetry} />
        </div>
      ) : isPending ? (
        <ListSkeleton rows={2} />
      ) : (
        lessons.map((lesson) => (
          <div key={lesson.id} className="border-t border-line">
            <Band className="pb-1.5">
              <span className="text-ink tabular">{date(lesson.event_date, { hour: '2-digit', minute: '2-digit' })}</span>
              <LessonShape type={lesson.event_type} />
              <span className="min-w-0 flex-1 truncate">
                {title(lesson)}, {labels.ageGroup(lesson.age_group)}
              </span>
              <span className="font-medium text-ink-3 tabular">{lesson.seats.length}</span>
            </Band>
            {lesson.seats.length === 0 ? (
              <p className="px-4 pb-3 text-[0.84375rem] text-ink-3 sm:px-[1.375rem]">{t.today.emptyLesson}</p>
            ) : (
              <ul>
                {lesson.seats.map((seat) => {
                  const child = seat.child
                  const item = bySeatId.get(seat.id)
                  const done = isSent(seat.id)
                  return (
                    <CardRow key={seat.id}>
                      <Avatar name={child.student_name} />
                      <div className="min-w-0 flex-1">
                        <ChildLink id={child.id} name={child.student_name} className="block" />
                        <p className="truncate text-[0.84375rem] leading-[1.125rem] text-ink-3">{fmt(t.today.lessonsCard.parentOf, { name: child.parent_name })}</p>
                      </div>
                      {seat.status !== 'scheduled' ? (
                        <Mark tone="neutral">{labels.attendance(seat.status)}</Mark>
                      ) : !item ? null : done ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`${t.today.tomorrow.sent}. ${t.messages.undo}`}
                          onPress={() => takeBack(seat.id)}
                          className="shrink-0 max-lg:h-10"
                          icon={<CheckIcon aria-hidden weight="bold" className="size-4 text-green-ink" />}
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
                          icon={<WhatsappLogoIcon aria-hidden className="size-4" />}
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
    </section>
  )
}
