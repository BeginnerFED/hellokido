import { useMemo, useState } from 'react'
import { CopyIcon, WhatsappLogoIcon } from '@phosphor-icons/react'
import { DEFAULT_MESSAGES, MESSAGE_KINDS, renderMessage, type MessageKind, type Registration, type Usage } from '@hellokido/core/api'
import { whatsAppLink } from '@hellokido/core/rules/phone.js'
import { useCatalog, useChildLessons } from '../../data/queries'
import { useChildReminders, usePackageNameTr, useReminderLog, useTemplates } from '../../data/messages'
import { useI18n } from '../../providers/I18n'
import { useToast } from '../../providers/Toasts'
import { LoadError, Skeleton } from '../../ui/Bits'
import { Button, ButtonLink } from '../../ui/Button'
import { RadioList, type Option } from '../../ui/Choice'
import { TextArea } from '../../ui/Field'
import { Notice } from '../../ui/Notice'
import { Card, CardLink } from '../../ui/Page'
import { Sheet, SheetActions, SheetFooter } from '../../ui/Sheet'
import { copyText } from '../notes/bits'
import { isEnding, isFree, isPaymentDue } from './rules'

type Choice = { id: string; kind: MessageKind; title: string; body: string; templateId: string | null }

/** The admin's messages, with the built-in text standing in for a kind that has none of its own. */
function useChoices() {
  const { t } = useI18n()
  const templates = useTemplates().data
  return useMemo<Choice[]>(() => {
    const list: Choice[] = []
    for (const kind of MESSAGE_KINDS) {
      const own = (templates ?? []).filter((template) => template.kind === kind)
      // The one in use comes first in its kind
      own.sort((a, b) => Number(b.is_default) - Number(a.is_default) || a.sort_order - b.sort_order)
      for (const template of own) list.push({ id: template.id, kind, title: template.title, body: template.body, templateId: template.id })
      if (own.length === 0 && kind !== 'custom') list.push({ id: `default:${kind}`, kind, title: t.messages.kinds[kind], body: DEFAULT_MESSAGES[kind], templateId: null })
    }
    return list
  }, [templates, t])
}

/**
 * Any of the admin's messages, written for this family and editable before it goes. It opens in
 * WhatsApp and is added to the family's messages, so the other admin sees it was sent.
 */
export function SendMessageSheet({
  registration,
  usage,
  isOpen,
  onOpenChange
}: {
  registration: Registration
  usage: Usage | undefined
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useI18n()
  return (
    <Sheet isOpen={isOpen} onOpenChange={onOpenChange} title={t.messages.send.button} description={registration.parent_name}>
      {isOpen && <SendMessageForm registration={registration} usage={usage} onDone={() => onOpenChange(false)} />}
    </Sheet>
  )
}

function SendMessageForm({ registration, usage, onDone }: { registration: Registration; usage: Usage | undefined; onDone: () => void }) {
  const i18n = useI18n()
  const { t, fmt, date, money } = i18n
  const toast = useToast()
  const choices = useChoices()
  const templates = useTemplates()
  const catalog = useCatalog().data
  const packageName = usePackageNameTr()
  const lessons = useChildLessons(registration.id)
  const { log } = useReminderLog()

  // The next lesson the child is booked into, for lesson reminders
  const next = useMemo(() => {
    const now = Date.now()
    return (lessons.data ?? [])
      .filter((row) => row.status === 'scheduled' && row.events && new Date(row.events.event_date).getTime() >= now)
      .sort((a, b) => new Date(a.events!.event_date).getTime() - new Date(b.events!.event_date).getTime())[0]
  }, [lessons.data])

  // What the family most likely needs to hear: a payment, a package that ends, else the next lesson
  const suggested = useMemo(() => {
    const free = isFree(registration)
    const want: MessageKind = !free && isPaymentDue(registration) ? 'payment' : !free && (isEnding(registration) || usage?.remaining === 0) ? 'package_end' : 'lesson'
    const usable = (choice: Choice) => choice.kind !== 'lesson' || Boolean(next)
    return choices.find((choice) => choice.kind === want && usable(choice)) ?? choices.find(usable)
  }, [choices, registration, usage, next])

  const [pickedId, setPickedId] = useState<string | null>(null)
  const picked = choices.find((choice) => choice.id === pickedId) ?? suggested
  const [edits, setEdits] = useState<Record<string, string>>({})

  const write = (choice: Choice) =>
    renderMessage(choice.body, {
      parentName: registration.parent_name,
      childName: registration.student_name,
      lesson: choice.kind === 'lesson' && next?.events ? { date: next.events.event_date, type: next.events.event_type } : null,
      packageName: packageName(registration.package_type),
      remaining: usage?.remaining ?? null,
      endDate: registration.package_end_date,
      amount: registration.payment_amount ? money(Number(registration.payment_amount)) : null,
      workshop: catalog?.settings.workshop
    })

  if (templates.isPending || lessons.isPending) {
    return (
      <div aria-busy className="flex flex-col gap-3">
        <Skeleton className="h-40" />
        <Skeleton className="h-48" />
      </div>
    )
  }
  if (!picked) return <p className="text-sm text-ink-3">{t.messages.send.noLesson}</p>

  const text = edits[picked.id] ?? write(picked)
  const edited = edits[picked.id] !== undefined && edits[picked.id] !== write(picked)
  const chat = whatsAppLink(registration.parent_phone, text)
  const when = next?.events
    ? date(next.events.event_date, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    : null

  const options: Option[] = choices.map((choice) => ({
    id: choice.id,
    label: choice.title,
    description:
      choice.kind === 'lesson' && !next ? t.messages.send.noLesson : choice.title === t.messages.kinds[choice.kind] ? undefined : t.messages.kinds[choice.kind],
    isDisabled: choice.kind === 'lesson' && !next
  }))

  // The sheet closes at once; a failed record says so in a toast of its own
  const sent = () => {
    log({ kind: picked.kind, registrationId: registration.id, participantId: picked.kind === 'lesson' ? next?.id : null, templateId: picked.templateId })
    toast({ tone: 'success', title: t.messages.send.logged })
    onDone()
  }

  const copy = async () => {
    const ok = await copyText(text)
    toast(ok ? { tone: 'success', title: t.messages.send.copied } : { tone: 'error', title: t.messages.send.copyFailed })
  }

  return (
    <div className="flex flex-col gap-5">
      <RadioList label={t.messages.send.template} options={options} value={picked.id} onChange={setPickedId} />
      {picked.kind === 'lesson' && when && <p className="-mt-2 text-[0.8125rem] text-ink-2">{fmt(t.messages.send.nextLesson, { when })}</p>}
      <div className="flex flex-col gap-1.5">
        <TextArea
          label={t.messages.send.text}
          description={t.messages.send.textHint}
          value={text}
          onChange={(value) => setEdits((current) => ({ ...current, [picked.id]: value }))}
          rows={12}
        />
        {edited && (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 self-start"
            onPress={() =>
              setEdits((current) => {
                const rest = { ...current }
                delete rest[picked.id]
                return rest
              })
            }
          >
            {t.messages.send.reset}
          </Button>
        )}
      </div>
      {!chat && <Notice tone="action">{t.messages.send.noPhone}</Notice>}
      <SheetFooter>
        <SheetActions
          start={
            <Button variant="quiet" icon={<CopyIcon aria-hidden className="size-4" />} onPress={() => void copy()} isDisabled={!text.trim()}>
              {t.messages.send.copy}
            </Button>
          }
        >
          <ButtonLink
            variant="primary"
            href={chat ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            isDisabled={!chat || !text.trim()}
            onPress={sent}
            icon={<WhatsappLogoIcon aria-hidden className="size-[1.125rem]" />}
          >
            {t.messages.send.open}
          </ButtonLink>
        </SheetActions>
      </SheetFooter>
    </div>
  )
}

const FIRST = 4

/** What was sent to this family from the panel, newest first. */
export function MessageHistory({ registration, level }: { registration: Registration; level: 2 | 3 }) {
  const { t, date } = useI18n()
  const history = useChildReminders(registration.id)
  const templates = useTemplates().data
  const [all, setAll] = useState(false)
  const rows = history.data ?? []
  const shown = all ? rows : rows.slice(0, FIRST)

  return (
    <Card
      level={level}
      title={t.messages.send.history}
      aside={rows.length > 0 ? <span className="tabular">{rows.length}</span> : undefined}
      footer={!all && rows.length > FIRST ? <CardLink onPress={() => setAll(true)}>{t.messages.send.showAll}</CardLink> : undefined}
    >
      {history.isPending ? (
        <div aria-busy className="px-4 pb-5 sm:px-[1.375rem]">
          <Skeleton className="h-16" />
        </div>
      ) : history.isError ? (
        <div className="px-4 pb-5 sm:px-[1.375rem]">
          <LoadError message={t.messages.logFailed} retryLabel={t.common.retry} onRetry={() => void history.refetch()} />
        </div>
      ) : rows.length === 0 ? (
        <p className="px-4 pb-5 text-[0.9375rem] text-ink-3 sm:px-[1.375rem]">{t.messages.send.historyEmpty}</p>
      ) : (
        <ul className="pb-1.5">
          {shown.map((entry) => {
            const title = templates?.find((template) => template.id === entry.template_id)?.title
            const kind = t.messages.kinds[entry.kind as MessageKind] ?? entry.kind
            return (
              <li key={entry.id} className="flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0 sm:px-[1.375rem]">
                <WhatsappLogoIcon aria-hidden className="size-[1.125rem] shrink-0 text-whatsapp" />
                <span className="min-w-0 flex-1 truncate text-[0.9375rem] text-ink">
                  {title ?? kind}
                  {title && title !== kind && <span className="text-ink-3">, {kind}</span>}
                </span>
                <time dateTime={entry.sent_at} className="shrink-0 text-[0.84375rem] text-ink-3 tabular">
                  {date(entry.sent_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </time>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
