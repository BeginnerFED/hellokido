import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArchiveIcon,
  ArrowsClockwiseIcon,
  ArrowUUpLeftIcon,
  DotsThreeIcon,
  HandCoinsIcon,
  PencilSimpleIcon,
  PhoneIcon,
  ReceiptIcon,
  WhatsappLogoIcon
} from '@phosphor-icons/react'
import { releaseSeats, remainingTone, setRegistrationActive, upcomingSeats, type Registration, type Usage } from '@hellokido/core/api'
import { phoneDigits, whatsAppLink } from '@hellokido/core/rules/phone.js'
import { useActiveUsage, useChildUsage, useLabels, useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useToast } from '../../providers/Toasts'
import { useActions } from '../../shell/Actions'
import { Avatar, EmptyState, LoadError, Mark, Skeleton } from '../../ui/Bits'
import { Button, ButtonLink, IconButton } from '../../ui/Button'
import { Checkbox } from '../../ui/Choice'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { Menu, MenuItem, MenuSeparator } from '../../ui/Menu'
import { Card, Page } from '../../ui/Page'
import { displayPhone } from '../../ui/PhoneActions'
import { Beads } from '../../ui/signature'
import { cx } from '../../ui/cx'
import { beadsLabel, lessonsLeftText, packageStartText } from './ChildBits'
import { ChildLessons } from './ChildLessons'
import { MessageHistory, SendMessageSheet } from './ChildMessages'
import { ChildPayments } from './ChildPayments'
import { isFree, isPaymentDue, needsRenewal } from './rules'

const BACK = '/children'

/**
 * A child's own page. The head says who they are and holds what can be done; under it the package,
 * the lessons and the payments, and beside them the parent, the note and the messages. In one
 * column (a phone) the parent comes right after the package.
 */
export function ChildPage({ registration }: { registration: Registration }) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const labels = useLabels()
  const { startTask } = useActions()
  const active = registration.is_active === true
  const activeUsage = useActiveUsage()
  // Archived children are not in the batch of active ones
  const ownUsage = useChildUsage(active ? undefined : registration)
  const usageQuery = active ? activeUsage : ownUsage
  const usage = active ? activeUsage.data?.[registration.id] : ownUsage.data
  const [dialog, setDialog] = useState<'archive' | 'activate' | 'message' | null>(null)
  const more = t.children.detail.actions.more
  const notes = registration.notes?.trim()

  const status = !active ? (
    <Mark tone="neutral">{t.children.views.archived}</Mark>
  ) : isPaymentDue(registration) ? (
    <Mark tone="action">{t.children.pendingPayment}</Mark>
  ) : null
  const about = [registration.student_age?.trim(), labels.packageName(registration.package_type)].filter(Boolean).join(' · ')

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

  // Long labels (Ukrainian) put the buttons on rows of their own; the menu stays with "edit"
  const toolbar = active ? (
    <>
      <Button
        variant="primary"
        className="max-sm:flex-1"
        icon={<HandCoinsIcon aria-hidden className="size-[1.125rem]" />}
        onPress={() => startTask('payment', { registrationId: registration.id })}
      >
        {t.children.detail.actions.takePayment}
      </Button>
      {message}
      <div className="flex gap-2 max-sm:flex-1 lg:gap-2.5">
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
    </>
  ) : (
    <>
      <Button variant="quiet" className="max-sm:flex-1" icon={<ArrowUUpLeftIcon aria-hidden className="size-[1.125rem]" />} onPress={() => setDialog('activate')}>
        {t.children.detail.actions.activate}
      </Button>
      {message}
    </>
  )

  return (
    <Page
      title={registration.student_name}
      summary={
        (about || status) && (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {about && <span>{about}</span>}
            {status}
          </span>
        )
      }
      toolbar={toolbar}
      back={{ href: BACK, label: t.children.detail.back }}
      lead={<Avatar name={registration.student_name} size="xl" tone="sky" />}
      action={false}
      width="wide"
    >
      {!active && <p className="mb-4 text-[0.9375rem] text-ink-2 text-pretty">{t.children.detail.archivedNote}</p>}
      <div className="@container">
        {/* Two columns once there is room; in one, the column wrappers step aside so the parent can follow the package */}
        <div className="flex flex-col gap-4 @3xl:grid @3xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] @3xl:items-start @3xl:gap-[1.125rem]">
          <div className="contents @3xl:flex @3xl:flex-col @3xl:gap-[1.125rem]">
            <PackageCard
              registration={registration}
              usage={usage}
              failed={usageQuery.isError && !usage}
              onRetry={() => void usageQuery.refetch()}
              className="order-1"
            />
            <div className="order-3 flex min-w-0 flex-col">
              <ChildLessons key={`lessons-${registration.id}`} registration={registration} level={2} />
            </div>
            <div className="order-4 flex min-w-0 flex-col">
              <ChildPayments key={`payments-${registration.id}`} registration={registration} level={2} />
            </div>
          </div>
          <div className="contents @3xl:flex @3xl:flex-col @3xl:gap-[1.125rem]">
            <ParentCard registration={registration} className="order-2" />
            {notes && (
              <Card title={t.children.detail.notesTitle} className="order-5">
                <p className="px-4 pb-[1.125rem] text-[0.9375rem] whitespace-pre-line text-ink-2 text-pretty sm:px-[1.375rem]">{registration.notes}</p>
              </Card>
            )}
            <div className="order-6 flex min-w-0 flex-col">
              <MessageHistory registration={registration} level={2} />
            </div>
          </div>
        </div>
      </div>

      <ArchiveDialog registration={registration} isOpen={dialog === 'archive'} onOpenChange={(open) => setDialog(open ? 'archive' : null)} />
      <ActivateDialog registration={registration} isOpen={dialog === 'activate'} onOpenChange={(open) => setDialog(open ? 'activate' : null)} />
      <SendMessageSheet registration={registration} usage={usage} isOpen={dialog === 'message'} onOpenChange={(open) => setDialog(open ? 'message' : null)} />
    </Page>
  )
}

/** The child's page before the child is known: its shape while the list loads, or why it cannot open. */
export function ChildPageFallback({ state, onRetry }: { state: 'loading' | 'missing' | 'error'; onRetry?: () => void }) {
  const { t } = useI18n()
  const back = { href: BACK, label: t.children.detail.back }
  if (state === 'loading') {
    return (
      <Page
        title={
          <>
            <span className="sr-only">{t.common.loading}</span>
            <Skeleton as="span" className="block h-9 w-56 max-w-full lg:h-10" />
          </>
        }
        crumb={t.common.loading}
        back={back}
        lead={<Skeleton className="size-[4.75rem] rounded-full" />}
        action={false}
        width="wide"
      >
        <div aria-busy className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Skeleton className="h-72 rounded-panel" />
          <Skeleton className="h-44 rounded-panel" />
        </div>
      </Page>
    )
  }
  return (
    <Page title={t.children.title} back={back} action={false} width="wide">
      {state === 'error' ? (
        <div className="on-felt rounded-panel bg-felt p-5">
          <LoadError message={t.children.loadFailed} retryLabel={t.common.retry} onRetry={() => onRetry?.()} />
        </div>
      ) : (
        <div className="rounded-panel bg-felt">
          <EmptyState className="py-12" title={t.children.detail.notFound} />
        </div>
      )}
    </Page>
  )
}

/** Who to call: the parent's name and number, and a call or a WhatsApp chat in one press. */
function ParentCard({ registration, className }: { registration: Registration; className?: string }) {
  const { t } = useI18n()
  const digits = phoneDigits(registration.parent_phone)
  const chat = whatsAppLink(registration.parent_phone)
  return (
    <Card title={t.children.detail.parent} className={className} bodyClassName="px-4 pb-5 sm:px-[1.375rem]">
      {registration.parent_name?.trim() && <p className="text-[1.0625rem] leading-[1.375rem] font-medium">{registration.parent_name}</p>}
      <p className="mt-0.5 text-[0.9375rem] text-ink-2 tabular">{displayPhone(registration.parent_phone)}</p>
      {digits && (
        <div className="mt-3.5 flex flex-wrap gap-2">
          <ButtonLink href={`tel:${digits}`} variant="quiet" className="max-sm:grow" icon={<PhoneIcon aria-hidden className="size-[1.125rem]" />}>
            {t.children.detail.callParent}
          </ButtonLink>
          {chat && (
            <ButtonLink
              href={chat}
              target="_blank"
              rel="noopener noreferrer"
              variant="quiet"
              className="max-sm:grow"
              icon={<WhatsappLogoIcon aria-hidden className="size-[1.125rem] text-whatsapp" />}
            >
              {t.children.detail.whatsapp}
            </ButtonLink>
          )}
        </div>
      )}
    </Card>
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
  className
}: {
  registration: Registration
  usage: Usage | undefined
  failed: boolean
  onRetry: () => void
  className?: string
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
        usage.noShow > 0 && { key: 'no', dot: 'bg-negative', text: plural(t.children.detail.absent, usage.noShow) },
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
      title={labels.packageName(registration.package_type)}
      aside={<span className="tabular">{period}</span>}
      className={className}
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
