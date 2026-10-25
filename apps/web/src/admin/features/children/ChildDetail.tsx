import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArchiveIcon, ArrowsClockwiseIcon, ArrowUUpLeftIcon, DotsThreeIcon, HandCoinsIcon, ReceiptIcon, WhatsappLogoIcon } from '@phosphor-icons/react'
import { releaseSeats, remainingTone, setRegistrationActive, upcomingSeats, type Registration, type Usage } from '@hellokido/core/api'
import { useActiveUsage, useChildUsage, useLabels, useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useToast } from '../../providers/Toasts'
import { useActions } from '../../shell/Actions'
import { Avatar, Mark, Skeleton } from '../../ui/Bits'
import { Button, IconButton } from '../../ui/Button'
import { Checkbox } from '../../ui/Choice'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { Menu, MenuItem, MenuSeparator } from '../../ui/Menu'
import { Notice } from '../../ui/Notice'
import { Section } from '../../ui/Page'
import { displayPhone, PhoneActions } from '../../ui/PhoneActions'
import { BeadString } from '../../ui/signature'
import { cx } from '../../ui/cx'
import { beadsLabel, endText, formatPeriod, remainingText } from './ChildBits'
import { ChildLessons } from './ChildLessons'
import { MessageHistory, SendMessageSheet } from './ChildMessages'
import { ChildPayments } from './ChildPayments'
import { daysLeft, ENDING_WINDOW_DAYS, isEnding, isFree, isPaymentDue } from './rules'

/** Each part below the head: a rule above it and the card's own gutter. */
const pane = 'border-t border-line px-4 py-5 sm:px-6'

/**
 * One child: who to call, where the package stands, every payment, every lesson and what was sent
 * to the family. It fills a card, its parts divided by rules like every card of the panel.
 */
export function ChildDetail({ registration, showName }: { registration: Registration; showName: boolean }) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const { startTask } = useActions()
  const active = registration.is_active === true
  const activeUsage = useActiveUsage().data?.[registration.id]
  // Archived children are not in the batch of active ones
  const ownUsage = useChildUsage(active ? undefined : registration).data
  const usage = active ? activeUsage : ownUsage
  const [dialog, setDialog] = useState<'archive' | 'activate' | 'message' | null>(null)
  const more = t.children.detail.actions.more
  // Beside the list the name is a level-2 heading; on a phone the name is the page's own title
  const level = showName ? 3 : 2

  const days = active ? daysLeft(registration) : null
  const status = !active ? (
    <Mark tone="neutral">{t.children.views.archived}</Mark>
  ) : isPaymentDue(registration) ? (
    <Mark tone="action">{t.children.pendingPayment}</Mark>
  ) : days !== null && days <= ENDING_WINDOW_DAYS ? (
    <Mark tone={days < 0 ? 'action' : 'neutral'}>{endText(i18n, days)}</Mark>
  ) : null
  const message = (
    <Button
      variant="secondary"
      className="max-sm:flex-1"
      aria-label={fmt(t.messages.send.label, { name: registration.student_name })}
      icon={<WhatsappLogoIcon aria-hidden className="size-[1.125rem] text-whatsapp" />}
      onPress={() => setDialog('message')}
    >
      {t.messages.send.button}
    </Button>
  )

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-4 px-4 py-5 sm:px-6">
        {showName ? (
          <div className="flex items-center gap-3.5">
            <Avatar name={registration.student_name} size="lg" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[1.25rem] leading-tight font-semibold tracking-[-0.01em]">{registration.student_name}</h2>
              {registration.student_age && <p className="mt-0.5 text-sm text-ink-3">{registration.student_age}</p>}
            </div>
            {status}
          </div>
        ) : (
          status && <div className="flex">{status}</div>
        )}
        <div className="flex items-center gap-3 rounded-tile border border-line bg-surface-2 py-2.5 pr-2.5 pl-3.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.9375rem] font-medium text-ink">{registration.parent_name}</p>
            <p className="text-[0.8125rem] text-ink-3 tabular">
              {t.children.detail.parent} · {displayPhone(registration.parent_phone)}
            </p>
          </div>
          <PhoneActions phone={registration.parent_phone} />
        </div>
        {active ? (
          // Long labels (Ukrainian) put the buttons on rows of their own; the menu stays with "edit"
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              className="max-sm:flex-1"
              icon={<HandCoinsIcon aria-hidden className="size-[1.125rem]" />}
              onPress={() => startTask('payment', { registrationId: registration.id })}
            >
              {t.children.detail.actions.takePayment}
            </Button>
            {message}
            <div className="flex gap-2 max-sm:flex-1">
              <Button variant="secondary" className="max-sm:flex-1" onPress={() => startTask('registration', { registrationId: registration.id })}>
                {t.children.detail.actions.edit}
              </Button>
              <Menu
                label={more}
                trigger={
                  <IconButton label={more} variant="secondary">
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
          <div className="flex flex-col gap-3">
            <Notice>{t.children.detail.archivedNote}</Notice>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" icon={<ArrowUUpLeftIcon aria-hidden className="size-[1.125rem]" />} onPress={() => setDialog('activate')}>
                {t.children.detail.actions.activate}
              </Button>
              {message}
            </div>
          </div>
        )}
      </div>

      <PackageSection registration={registration} usage={usage} level={level} className={pane} />

      {registration.notes?.trim() && (
        <Section level={level} title={t.children.detail.notesTitle} className={pane}>
          <p className="text-sm whitespace-pre-line text-ink-2 text-pretty">{registration.notes}</p>
        </Section>
      )}

      <ChildPayments key={`payments-${registration.id}`} registration={registration} level={level} className={pane} />
      <ChildLessons key={`lessons-${registration.id}`} registration={registration} level={level} className={pane} />
      <MessageHistory registration={registration} level={level} className={pane} />

      <ArchiveDialog registration={registration} isOpen={dialog === 'archive'} onOpenChange={(open) => setDialog(open ? 'archive' : null)} />
      <ActivateDialog registration={registration} isOpen={dialog === 'activate'} onOpenChange={(open) => setDialog(open ? 'activate' : null)} />
      <SendMessageSheet registration={registration} usage={usage} isOpen={dialog === 'message'} onOpenChange={(open) => setDialog(open ? 'message' : null)} />
    </div>
  )
}

function PackageSection({ registration, usage, level, className }: { registration: Registration; usage: Usage | undefined; level: 2 | 3; className?: string }) {
  const i18n = useI18n()
  const { t, fmt, plural } = i18n
  const labels = useLabels()
  const { startTask } = useActions()
  const free = isFree(registration)
  const active = registration.is_active === true
  const days = daysLeft(registration)
  const pending = !free && registration.payment_status === 'beklemede'
  const tone = remainingTone(usage)
  const renewable = active && !free && !pending && (isEnding(registration) || tone === 'out')

  const counts = usage
    ? [
        usage.attended > 0 && plural(t.children.detail.attended, usage.attended),
        usage.noShow > 0 && plural(t.children.detail.absent, usage.noShow),
        usage.scheduled - usage.unmarkedPast > 0 && plural(t.children.detail.booked, usage.scheduled - usage.unmarkedPast)
      ].filter(Boolean)
    : []
  const extras = usage
    ? [
        usage.carried > 0 && plural(t.children.detail.carried, usage.carried),
        usage.earlierPaymentLessons > 0 && fmt(t.children.detail.earlier, { total: usage.packageTotal ?? 0 }),
        usage.extra > 0 && plural(t.children.detail.extra, usage.extra)
      ].filter(Boolean)
    : []

  return (
    <Section level={level} title={t.children.detail.packageTitle} className={className}>
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-[0.9375rem] font-medium text-ink">{labels.packageName(registration.package_type)}</p>
          <p className="mt-0.5 text-[0.8125rem] text-ink-2 tabular">
            {free ? t.children.detail.unlimited : formatPeriod(i18n, registration.package_start_date, registration.package_end_date)}
            {active && days !== null && (
              <span className={cx(days <= ENDING_WINDOW_DAYS ? 'text-action-ink' : 'text-ink-3')}>
                {' · '}
                {endText(i18n, days)}
              </span>
            )}
          </p>
        </div>

        {!usage ? (
          <Skeleton className="h-[4.5rem]" />
        ) : free ? (
          <p className="text-sm text-ink-2 text-pretty">{fmt(t.children.detail.freeUsage, { count: usage.attended })}</p>
        ) : (
          <div className="flex flex-col gap-2">
            <p
              className={cx(
                'text-[1.375rem] leading-tight font-semibold tabular',
                tone === 'out' || tone === 'low' ? 'text-action-ink' : 'text-ink'
              )}
            >
              {remainingText(i18n, usage)}
            </p>
            <BeadString usage={usage} size="lg" label={beadsLabel(i18n, usage)} />
            {counts.length > 0 && <p className="text-[0.8125rem] text-ink-2">{counts.join(' · ')}</p>}
            {extras.map((line) => (
              <p key={line as string} className="text-[0.8125rem] text-ink-3">
                {line}
              </p>
            ))}
          </div>
        )}

        {usage && usage.unmarkedPast > 0 && <Notice tone="action">{plural(t.children.detail.unmarked, usage.unmarkedPast)}</Notice>}

        {pending && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-tile border border-action-line bg-action-wash px-3 py-2.5">
            <p className="min-w-0 flex-1 text-[0.8125rem] text-action-ink text-pretty">{t.children.detail.pendingLine}</p>
            {active && (
              <Button size="sm" variant="secondary" onPress={() => startTask('payment', { registrationId: registration.id, choice: 'collect' })}>
                {t.children.detail.collect}
              </Button>
            )}
          </div>
        )}

        {renewable && (
          <Button
            variant="secondary"
            size="sm"
            className="self-start"
            icon={<ArrowsClockwiseIcon aria-hidden className="size-4" />}
            onPress={() => startTask('payment', { registrationId: registration.id, choice: 'renew' })}
          >
            {t.children.detail.actions.renew}
          </Button>
        )}
      </div>
    </Section>
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
