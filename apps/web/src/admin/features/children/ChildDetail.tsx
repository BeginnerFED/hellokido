import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArchiveIcon,
  ArrowsClockwiseIcon,
  ArrowUUpLeftIcon,
  DotsThreeIcon,
  HandCoinsIcon,
  PencilSimpleIcon,
  ReceiptIcon,
  WhatsappLogoIcon,
  XIcon
} from '@phosphor-icons/react'
import { releaseSeats, remainingTone, setRegistrationActive, upcomingSeats, type Registration, type Usage } from '@hellokido/core/api'
import { useActiveUsage, useChildUsage, useLabels, useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useToast } from '../../providers/Toasts'
import { useActions } from '../../shell/Actions'
import { Avatar, LoadError, Mark, Skeleton } from '../../ui/Bits'
import { Button, IconButton } from '../../ui/Button'
import { Checkbox } from '../../ui/Choice'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { Menu, MenuItem, MenuSeparator } from '../../ui/Menu'
import { Card } from '../../ui/Page'
import { displayPhone, PhoneActions } from '../../ui/PhoneActions'
import { Beads } from '../../ui/signature'
import { cx } from '../../ui/cx'
import { beadsLabel, lessonsLeftText, packageStartText } from './ChildBits'
import { ChildLessons } from './ChildLessons'
import { MessageHistory, SendMessageSheet } from './ChildMessages'
import { ChildPayments } from './ChildPayments'
import { isFree, isPaymentDue, needsRenewal } from './rules'

/**
 * One child on the board, with no card around it: who they are and who to call, what can be done,
 * then the package and the period's lessons side by side, the payments, the note and the messages.
 */
export function ChildDetail({ registration, showName, onClose }: { registration: Registration; showName: boolean; onClose?: () => void }) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const { startTask } = useActions()
  const active = registration.is_active === true
  const activeUsage = useActiveUsage()
  // Archived children are not in the batch of active ones
  const ownUsage = useChildUsage(active ? undefined : registration)
  const usageQuery = active ? activeUsage : ownUsage
  const usage = active ? activeUsage.data?.[registration.id] : ownUsage.data
  const [dialog, setDialog] = useState<'archive' | 'activate' | 'message' | null>(null)
  const more = t.children.detail.actions.more
  // Beside the list the name is a level-2 heading; on a phone the name is the page's own title
  const level = showName ? 3 : 2

  const status = !active ? (
    <Mark tone="neutral">{t.children.views.archived}</Mark>
  ) : isPaymentDue(registration) ? (
    <Mark tone="action">{t.children.pendingPayment}</Mark>
  ) : null

  const parent = (
    <div className="on-felt flex min-w-0 items-center gap-2.5 rounded-[1.5rem] bg-felt py-2 pr-2 pl-4 max-sm:w-full">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.96875rem] leading-5 font-medium text-ink">{registration.parent_name}</p>
        <p className="truncate text-[0.84375rem] leading-[1.125rem] text-ink-3">
          {t.children.detail.parent}, {displayPhone(registration.parent_phone)}
        </p>
      </div>
      <PhoneActions phone={registration.parent_phone} className="gap-1.5" />
    </div>
  )

  const message = (
    <Button
      variant="quiet"
      className="max-sm:flex-1"
      aria-label={fmt(t.messages.send.label, { name: registration.student_name })}
      icon={<WhatsappLogoIcon aria-hidden className="size-[1.125rem] text-whatsapp" />}
      onPress={() => setDialog('message')}
    >
      {t.messages.send.button}
    </Button>
  )

  return (
    <div className="@container flex flex-col">
      {showName ? (
        <div className="flex items-start gap-3 pt-1 pb-5">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-[1.125rem] gap-y-4">
            <Avatar name={registration.student_name} size="xl" tone="sky" />
            <div className="min-w-0 flex-[1_1_12rem]">
              <h2 className="truncate text-[2rem] leading-[2.375rem] font-semibold tracking-[-0.025em]">{registration.student_name}</h2>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.96875rem] text-ink-2">
                {registration.student_age && <span>{registration.student_age}</span>}
                {status}
              </p>
            </div>
            {parent}
          </div>
          {/* Closes the child and leaves the list alone; level with the middle of the avatar */}
          {onClose && (
            <IconButton label={t.common.close} variant="quiet" onPress={onClose} className="mt-[1.125rem] size-10! shrink-0">
              <XIcon aria-hidden className="size-[1.125rem]" />
            </IconButton>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3 pb-4">
          {status}
          {parent}
        </div>
      )}

      {active ? (
        // Long labels (Ukrainian) put the buttons on rows of their own; the menu stays with "edit"
        <div className="flex flex-wrap gap-2.5 pb-[1.125rem]">
          <Button
            variant="primary"
            className="max-sm:flex-1"
            icon={<HandCoinsIcon aria-hidden className="size-[1.125rem]" />}
            onPress={() => startTask('payment', { registrationId: registration.id })}
          >
            {t.children.detail.actions.takePayment}
          </Button>
          {message}
          <div className="flex gap-2.5 max-sm:flex-1">
            <Button
              variant="quiet"
              className="max-sm:flex-1"
              icon={<PencilSimpleIcon aria-hidden className="size-[1.125rem]" />}
              onPress={() => startTask('registration', { registrationId: registration.id })}
            >
              {t.children.detail.actions.edit}
            </Button>
            <Menu
              label={more}
              trigger={
                <IconButton label={more} variant="quiet">
                  <DotsThreeIcon aria-hidden weight="bold" className="size-5" />
                </IconButton>
              }
            >
              <MenuItem
                icon={<ReceiptIcon aria-hidden className="size-[1.125rem]" />}
                onAction={() => startTask('payment', { registrationId: registration.id, choice: 'fee' })}
              >
                {t.children.detail.actions.addFee}
              </MenuItem>
              <MenuSeparator />
              <MenuItem icon={<ArchiveIcon aria-hidden className="size-[1.125rem]" />} onAction={() => setDialog('archive')}>
                {t.children.detail.actions.archive}
              </MenuItem>
            </Menu>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 pb-[1.125rem]">
          <p className="text-[0.9375rem] text-ink-2 text-pretty">{t.children.detail.archivedNote}</p>
          <div className="flex flex-wrap gap-2.5">
            <Button variant="quiet" icon={<ArrowUUpLeftIcon aria-hidden className="size-[1.125rem]" />} onPress={() => setDialog('activate')}>
              {t.children.detail.actions.activate}
            </Button>
            {message}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {/* Side by side the two cards share one height, so no hole opens under the shorter one */}
        <div className="grid gap-4 @2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
          <PackageCard
            registration={registration}
            usage={usage}
            failed={usageQuery.isError && !usage}
            onRetry={() => void usageQuery.refetch()}
            level={level}
          />
          <ChildLessons key={`lessons-${registration.id}`} registration={registration} level={level} />
        </div>

        <ChildPayments key={`payments-${registration.id}`} registration={registration} level={level} />

        <div className={cx('grid items-start gap-4', registration.notes?.trim() && '@2xl:grid-cols-2')}>
          {registration.notes?.trim() && (
            <Card level={level} title={t.children.detail.notesTitle}>
              <p className="px-4 pb-[1.125rem] text-[0.9375rem] whitespace-pre-line text-ink-2 text-pretty sm:px-[1.375rem]">{registration.notes}</p>
            </Card>
          )}
          <MessageHistory registration={registration} level={level} />
        </div>
      </div>

      <ArchiveDialog registration={registration} isOpen={dialog === 'archive'} onOpenChange={(open) => setDialog(open ? 'archive' : null)} />
      <ActivateDialog registration={registration} isOpen={dialog === 'activate'} onOpenChange={(open) => setDialog(open ? 'activate' : null)} />
      <SendMessageSheet registration={registration} usage={usage} isOpen={dialog === 'message'} onOpenChange={(open) => setDialog(open ? 'message' : null)} />
    </div>
  )
}

/** The shape of a child while it loads: the identity row, then two cards. */
export function ChildDetailSkeleton({ showName }: { showName: boolean }) {
  return (
    <div aria-busy className="flex flex-col gap-4">
      {showName && (
        <div className="flex items-center gap-[1.125rem] pt-1 pb-1">
          <Skeleton className="size-[4.75rem] shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-9 w-1/2" />
            <Skeleton className="h-5 w-1/3" />
          </div>
        </div>
      )}
      <Skeleton className="h-10 w-2/3 rounded-full" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-panel" />
        <Skeleton className="h-64 rounded-panel" />
      </div>
    </div>
  )
}

/** An amber line: something the admin has to do. Wraps, unlike a status mark. */
function ActLine({ children }: { children: ReactNode }) {
  return (
    <p className="flex gap-1.5 text-[0.8125rem] leading-[1.125rem] font-medium text-amber-ink text-pretty">
      <span aria-hidden className="mt-[0.3125rem] size-[7px] shrink-0 rounded-full bg-amber" />
      <span className="min-w-0">{children}</span>
    </p>
  )
}

/**
 * The package as one card: its name and period, the lessons left as a big figure and a bead per
 * lesson, and at the foot what to do next (collect the payment, or renew).
 */
function PackageCard({
  registration,
  usage,
  failed,
  onRetry,
  level
}: {
  registration: Registration
  usage: Usage | undefined
  failed: boolean
  onRetry: () => void
  level: 2 | 3
}) {
  const i18n = useI18n()
  const { t, fmt, plural } = i18n
  const labels = useLabels()
  const { startTask } = useActions()
  const free = isFree(registration)
  const active = registration.is_active === true
  const pending = !free && registration.payment_status === 'beklemede'
  const tone = remainingTone(usage)
  const low = tone === 'out' || tone === 'low'
  // The lessons left say when a package runs out; its period's last day does not
  const renewable = !pending && needsRenewal(registration, usage)
  const left = Math.max(usage?.remaining ?? 0, 0)

  const legend = usage
    ? [
        usage.attended > 0 && { key: 'yes', dot: 'bg-green', text: plural(t.children.detail.attended, usage.attended) },
        usage.noShow > 0 && { key: 'no', dot: 'bg-mute', text: plural(t.children.detail.absent, usage.noShow) },
        usage.scheduled - usage.unmarkedPast > 0 && {
          key: 'planned',
          dot: 'shadow-[inset_0_0_0_1.5px_var(--mute)]',
          text: plural(t.children.detail.booked, usage.scheduled - usage.unmarkedPast)
        }
      ].filter((item): item is { key: string; dot: string; text: string } => Boolean(item))
    : []
  const extras = usage
    ? [
        usage.carried > 0 && plural(t.children.detail.carried, usage.carried),
        usage.earlierPaymentLessons > 0 && fmt(t.children.detail.earlier, { total: usage.packageTotal ?? 0 }),
        usage.extra > 0 && plural(t.children.detail.extra, usage.extra)
      ].filter(Boolean)
    : []

  const period = free ? t.children.detail.unlimited : packageStartText(i18n, registration.package_start_date, registration.package_type)

  return (
    <Card
      level={level}
      title={labels.packageName(registration.package_type)}
      aside={<span className="tabular">{period}</span>}
      bodyClassName="flex flex-col px-4 pb-5 sm:px-[1.375rem]"
    >
      {failed ? (
        <LoadError message={t.children.phone.usageFailed} retryLabel={t.common.retry} onRetry={onRetry} />
      ) : !usage ? (
        <div aria-busy className="flex flex-col gap-3 pt-1">
          <Skeleton className="h-[3.375rem] w-1/2" />
          <Skeleton className="h-[1.625rem]" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : free ? (
        <p className="text-[0.9375rem] text-ink-2 text-pretty">{fmt(t.children.detail.freeUsage, { count: usage.attended })}</p>
      ) : (
        <>
          <p className="flex items-baseline gap-2.5">
            <span className={cx('text-[3.25rem] leading-[3.375rem] font-semibold tracking-[-0.035em]', low && 'text-amber-ink')}>{left}</span>
            <span className={cx('text-[1.0625rem]', low ? 'font-medium text-amber-ink' : 'text-ink-2')}>{plural(t.children.phone.leftUnit, left)}</span>
          </p>
          <Beads usage={usage} label={beadsLabel(i18n, usage)} fill className="mt-3.5" />
          {legend.length > 0 && (
            <p className="mt-2.5 flex flex-wrap gap-x-[1.125rem] gap-y-1 text-[0.8125rem] text-ink-2">
              {legend.map((item) => (
                <span key={item.key} className="inline-flex items-center gap-1.5">
                  <span aria-hidden className={cx('size-[7px] rounded-full', item.dot)} />
                  {item.text}
                </span>
              ))}
            </p>
          )}
          {extras.map((line) => (
            <p key={line as string} className="mt-1 text-[0.8125rem] text-ink-3">
              {line}
            </p>
          ))}
        </>
      )}

      {usage && usage.unmarkedPast > 0 && (
        <div className="mt-4">
          <ActLine>{plural(t.children.detail.unmarked, usage.unmarkedPast)}</ActLine>
        </div>
      )}

      {/* The next step sits at the foot, level with the lessons card's own foot beside it */}
      {(pending || renewable) && <div aria-hidden className="mt-auto" />}

      {pending && (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-3.5">
          <div className="min-w-0 flex-[1_1_12rem]">
            <ActLine>{t.children.detail.pendingLine}</ActLine>
          </div>
          {active && (
            <Button size="sm" variant="secondary" onPress={() => startTask('payment', { registrationId: registration.id, choice: 'collect' })}>
              {t.children.detail.collect}
            </Button>
          )}
        </div>
      )}

      {renewable && (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-3.5">
          <p className="min-w-0 flex-[1_1_12rem] text-[0.84375rem] text-ink-2">
            {lessonsLeftText(i18n, left)}
          </p>
          <Button
            variant="secondary"
            size="sm"
            icon={<ArrowsClockwiseIcon aria-hidden className="size-4" />}
            onPress={() => startTask('payment', { registrationId: registration.id, choice: 'renew' })}
          >
            {t.children.detail.actions.renew}
          </Button>
        </div>
      )}
    </Card>
  )
}

type DialogProps = { registration: Registration; isOpen: boolean; onOpenChange: (open: boolean) => void }

/**
 * Archiving hides the child from every list but keeps payments and lessons. Seats it still holds in
 * lessons that have not happened can be freed at the same time (on by default).
 */
function ArchiveDialog({ registration, isOpen, onOpenChange }: DialogProps) {
  const { t, fmt, plural } = useI18n()
  const toast = useToast()
  const refresh = useRefresh()
  const [release, setRelease] = useState(true)
  const [busy, setBusy] = useState(false)
  const seats = useQuery({
    queryKey: ['upcoming-seats', registration.id],
    queryFn: () => upcomingSeats(registration.id),
    enabled: isOpen,
    staleTime: 0,
    gcTime: 0,
    retry: 0
  })
  // If the seats cannot be read the option is left out and archiving works as before
  const ids = seats.data ?? []
  const name = registration.student_name

  const confirm = async () => {
    setBusy(true)
    try {
      await setRegistrationActive(registration.id, false)
    } catch {
      setBusy(false)
      toast({ tone: 'error', title: t.children.archive.failed })
      return
    }
    let seatsFreed = true
    if (release && ids.length > 0) {
      try {
        await releaseSeats(ids)
      } catch {
        seatsFreed = false
      }
    }
    setBusy(false)
    onOpenChange(false)
    refresh.children(registration.id)
    toast(
      seatsFreed
        ? { tone: 'success', title: fmt(t.children.archive.done, { name }) }
        : { tone: 'warning', title: fmt(t.children.archive.seatsFailed, { name }) }
    )
  }

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={fmt(t.children.archive.title, { name })}
      body={
        <div className="flex flex-col gap-4">
          <p>{t.children.archive.body}</p>
          {ids.length > 0 && (
            <Checkbox isSelected={release} onChange={setRelease}>
              {plural(t.children.archive.releaseSeats, ids.length)}
              <span className="mt-0.5 block text-[0.8125rem] text-ink-3">{t.children.archive.releaseHint}</span>
            </Checkbox>
          )}
        </div>
      }
      confirmLabel={t.children.archive.confirm}
      isPending={busy}
      isConfirmDisabled={seats.isFetching}
      onConfirm={() => void confirm()}
    />
  )
}

function ActivateDialog({ registration, isOpen, onOpenChange }: DialogProps) {
  const { t, fmt } = useI18n()
  const toast = useToast()
  const refresh = useRefresh()
  const [busy, setBusy] = useState(false)
  const name = registration.student_name

  const confirm = async () => {
    setBusy(true)
    try {
      await setRegistrationActive(registration.id, true)
      onOpenChange(false)
      refresh.children(registration.id)
      toast({ tone: 'success', title: fmt(t.children.archive.activated, { name }) })
    } catch {
      toast({ tone: 'error', title: t.children.archive.activateFailed })
    } finally {
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={fmt(t.children.archive.activateTitle, { name })}
      body={t.children.archive.activateBody}
      confirmLabel={t.children.archive.activateConfirm}
      isPending={busy}
      onConfirm={() => void confirm()}
    />
  )
}
