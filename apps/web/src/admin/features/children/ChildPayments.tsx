import { useState, type ReactNode } from 'react'
import { ArrowCounterClockwiseIcon, DotsThreeIcon, PencilSimpleIcon, TrashIcon } from '@phosphor-icons/react'
import {
  deleteIncomeEntry,
  deleteLastExtension,
  startsNewPeriod,
  type IncomeEntry,
  type Registration,
  type ResolvedExtension
} from '@hellokido/core/api'
import { useChildEntries, useHistory, useLabels, useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useToast } from '../../providers/Toasts'
import { useActions } from '../../shell/Actions'
import { LoadError, Mark, Skeleton } from '../../ui/Bits'
import { Button, IconButton } from '../../ui/Button'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { Menu, MenuItem, MenuSeparator } from '../../ui/Menu'
import { Card, CardLink } from '../../ui/Page'
import { useSheet } from '../../ui/useSheet'
import { cx } from '../../ui/cx'
import { formatPeriod, shortDate } from './ChildBits'
import { FREE, isFree } from './rules'
import { ExtensionEditSheet } from './sheets'

/** The latest payments tell what matters now; years of monthly renewals wait behind a button. */
const FIRST = 4
const STEP = 10

type Line = {
  key: string
  title: string
  meta: string
  amount: number
  state: 'paid' | 'pending' | 'free'
  /** How and when a received payment came in: "Card · 12 Oct" */
  paid: string
  created: number
  menu?: ReactNode
  action?: ReactNode
}

/**
 * Every payment of the child in one list, newest first: the first registration, each later
 * payment (a new period or an instalment) and extra fees. Only the latest package payment can be
 * corrected or undone, which keeps the ledger and the lesson counts in step.
 */
export function ChildPayments({ registration, level }: { registration: Registration; level: 2 | 3 }) {
  const i18n = useI18n()
  const { t, fmt, plural, money } = i18n
  const labels = useLabels()
  const toast = useToast()
  const refresh = useRefresh()
  const { startTask } = useActions()
  const history = useHistory(registration.id)
  const entries = useChildEntries(registration.id)
  const editSheet = useSheet<{ registration: Registration; extension: ResolvedExtension }>()
  const [undoing, setUndoing] = useState<ResolvedExtension | null>(null)
  const [deleting, setDeleting] = useState<IncomeEntry | null>(null)
  const [busy, setBusy] = useState(false)
  const [shown, setShown] = useState(FIRST)

  const paidLine = (method: string | null | undefined, date: string | null | undefined) =>
    [method && method !== 'belirlenmedi' ? (t.finance.methodShort[method] ?? labels.method(method)) : '', date ? shortDate(i18n, date) : '']
      .filter(Boolean)
      .join(', ')

  const lines: Line[] = []
  const data = history.data
  if (data) {
    const fresh = data.registration
    const { extensions, initialPayment } = data
    const last = extensions[extensions.length - 1]
    const initialType = fresh.initial_package_type ?? fresh.package_type
    const initialFree = initialType === FREE
    lines.push({
      key: 'initial',
      title: t.children.detail.initial,
      meta: [labels.packageName(initialType), initialFree ? '' : formatPeriod(i18n, fresh.initial_start_date, fresh.initial_end_date)]
        .filter(Boolean)
        .join(', '),
      amount: Number(initialPayment?.amount ?? fresh.initial_payment_amount ?? 0),
      state: initialFree ? 'free' : extensions.length === 0 && fresh.payment_status === 'beklemede' ? 'pending' : 'paid',
      paid: paidLine(initialPayment?.payment_method ?? fresh.initial_payment_method, initialPayment?.payment_date),
      created: new Date(fresh.created_at ?? 0).getTime()
    })
    extensions.forEach((extension, index) => {
      // Older rows did not keep the start of the period they closed: it is the start the row before opened
      const before = index === 0 ? fresh.initial_start_date : (extensions[index - 1].new_start_date ?? extensions[index - 1].previous_end_date)
      const previousStart = extension.previous_start_date ?? before
      // Rows from before start dates were stored always began a new period
      const renews = !extension.new_start_date || startsNewPeriod(previousStart, new Date(extension.new_start_date))
      // A stale panel must never touch another child's payment; free participation has nothing to correct
      const editable = extension === last && extension.registration_id === fresh.id && !isFree(fresh)
      lines.push({
        key: extension.id,
        title: renews ? t.children.payment.renew : t.children.payment.instalment,
        meta: [
          labels.packageName(extension.new_package_type),
          formatPeriod(i18n, extension.new_start_date ?? extension.previous_end_date, extension.new_end_date)
        ]
          .filter(Boolean)
          .join(', '),
        amount: Number(extension.payment_amount ?? 0),
        state: extension.payment_status === 'beklemede' ? 'pending' : 'paid',
        paid: paidLine(extension.payment_method, extension.payment_date),
        created: new Date(extension.created_at ?? 0).getTime(),
        menu: editable && (
          <LineMenu label={t.children.detail.actions.more}>
            <MenuItem icon={<PencilSimpleIcon aria-hidden className="size-[1.125rem]" />} onAction={() => editSheet.open({ registration: fresh, extension })}>
              {t.children.detail.editLast}
            </MenuItem>
            <MenuSeparator />
            <MenuItem tone="danger" icon={<ArrowCounterClockwiseIcon aria-hidden className="size-[1.125rem]" />} onAction={() => setUndoing(extension)}>
              {t.children.detail.undoLast}
            </MenuItem>
          </LineMenu>
        )
      })
    })
  }
  for (const entry of entries.data ?? []) {
    const pending = entry.payment_status === 'beklemede'
    const due = pending && entry.due_date ? fmt(t.children.detail.dueOn, { date: shortDate(i18n, `${entry.due_date}T00:00:00`) }) : ''
    lines.push({
      key: entry.id,
      title: entry.description || t.children.detail.fee,
      meta: [entry.description ? t.children.detail.fee : '', due].filter(Boolean).join(', '),
      amount: Number(entry.amount) || 0,
      state: pending ? 'pending' : 'paid',
      paid: paidLine(entry.payment_method, entry.payment_date),
      created: new Date(entry.created_at ?? 0).getTime(),
      action: pending && registration.is_active === true && (
        <Button size="sm" variant="secondary" onPress={() => startTask('payment', { registrationId: registration.id, choice: 'collect', entryId: entry.id })}>
          {t.children.detail.collect}
        </Button>
      ),
      menu: (
        <LineMenu label={t.children.detail.actions.more}>
          <MenuItem
            icon={<PencilSimpleIcon aria-hidden className="size-[1.125rem]" />}
            onAction={() => startTask('income', { kind: 'child', registrationId: registration.id, entry })}
          >
            {t.common.edit}
          </MenuItem>
          <MenuSeparator />
          <MenuItem tone="danger" icon={<TrashIcon aria-hidden className="size-[1.125rem]" />} onAction={() => setDeleting(entry)}>
            {t.common.delete}
          </MenuItem>
        </LineMenu>
      )
    })
  }
  lines.sort((a, b) => b.created - a.created)
  const withMenus = lines.slice(0, shown).some((line) => line.menu)

  const undo = async () => {
    if (!undoing) return
    setBusy(true)
    try {
      await deleteLastExtension(undoing.id)
      setUndoing(null)
      toast({ tone: 'success', title: t.children.undo.done })
      refresh.children(registration.id)
    } catch {
      toast({ tone: 'error', title: t.children.undo.failed })
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      const found = await deleteIncomeEntry(deleting.id)
      setDeleting(null)
      toast(found ? { tone: 'success', title: t.finance.entry.deleted } : { tone: 'warning', title: t.finance.entry.notFound })
      refresh.finance(registration.id)
    } catch {
      toast({ tone: 'error', title: t.finance.entry.deleteFailed })
    } finally {
      setBusy(false)
    }
  }

  const ready = Boolean(data && entries.data)

  return (
    <Card
      level={level}
      title={t.children.detail.historyTitle}
      aside={ready && lines.length > 0 ? plural(t.children.web.payments, lines.length) : undefined}
      footer={
        ready && lines.length > shown ? (
          <CardLink onPress={() => setShown((count) => count + STEP)}>
            {plural(t.children.detail.showMorePayments, Math.min(STEP, lines.length - shown))}
          </CardLink>
        ) : undefined
      }
    >
      {history.isError || entries.isError ? (
        <div className="px-4 pb-5 sm:px-[1.375rem]">
          <LoadError
            message={t.children.detail.historyFailed}
            retryLabel={t.common.retry}
            onRetry={() => {
              void history.refetch()
              void entries.refetch()
            }}
          />
        </div>
      ) : !ready ? (
        <div aria-busy className="flex flex-col gap-2 px-4 pb-5 sm:px-[1.375rem]">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : (
        <ul className="pb-1.5">
          {lines.slice(0, shown).map((line) => (
            <li key={line.key} className="flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0 sm:gap-3.5 sm:px-[1.375rem]">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.96875rem] leading-5 font-medium text-ink">{line.title}</p>
                <p className="mt-0.5 text-[0.84375rem] leading-[1.125rem] text-ink-3 text-pretty">{line.meta}</p>
                {line.action && <div className="mt-2">{line.action}</div>}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5 self-start text-right">
                <p className={cx('text-[0.96875rem] leading-5 whitespace-nowrap tabular', line.state === 'paid' ? 'font-semibold text-ink' : 'font-medium text-ink-2')}>
                  {line.state === 'free' ? t.children.free : line.amount > 0 || line.state === 'paid' ? money(line.amount) : ''}
                </p>
                {line.state === 'pending' ? (
                  <Mark tone="action">{labels.paymentStatus('beklemede')}</Mark>
                ) : (
                  line.state === 'paid' && line.paid && <p className="text-[0.84375rem] leading-[1.125rem] whitespace-nowrap text-ink-3 tabular">{line.paid}</p>
                )}
              </div>
              {/* Amounts stay in one column whether or not a row has a menu */}
              {withMenus && <div className="-mr-2 w-8 shrink-0 self-start max-lg:w-10">{line.menu}</div>}
            </li>
          ))}
        </ul>
      )}

      {editSheet.payload && (
        <ExtensionEditSheet
          key={editSheet.key}
          isOpen={editSheet.isOpen}
          onOpenChange={editSheet.setOpen}
          registration={editSheet.payload.registration}
          extension={editSheet.payload.extension}
        />
      )}
      <ConfirmDialog
        isOpen={undoing !== null}
        onOpenChange={(open) => !open && setUndoing(null)}
        title={t.children.undo.title}
        body={undoing && fmt(t.children.undo.body, { amount: money(undoing.payment_amount) })}
        confirmLabel={t.children.undo.confirm}
        tone="danger"
        isPending={busy}
        onConfirm={() => void undo()}
      />
      <ConfirmDialog
        isOpen={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t.finance.entry.deleteTitle}
        body={deleting && fmt(t.finance.entry.deleteBody, { amount: money(deleting.amount) })}
        confirmLabel={t.finance.entry.deleteConfirm}
        tone="danger"
        isPending={busy}
        onConfirm={() => void remove()}
      />
    </Card>
  )
}

function LineMenu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Menu
      label={label}
      trigger={
        <IconButton label={label} size="sm" className="max-lg:size-10">
          <DotsThreeIcon aria-hidden weight="bold" className="size-[1.125rem]" />
        </IconButton>
      }
    >
      {children}
    </Menu>
  )
}
