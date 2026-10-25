import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button as AriaButton } from 'react-aria-components'
import { PlusIcon } from '@phosphor-icons/react'
import {
  addMessageTemplate,
  DEFAULT_EVENING_REMINDER,
  DEFAULT_MESSAGES,
  deleteMessageTemplate,
  MESSAGE_KINDS,
  MESSAGE_VARIABLES,
  parseTimeOfDay,
  renderMessage,
  setDefaultMessageTemplate,
  unknownVariables,
  updateEveningReminder,
  updateMessageTemplate,
  updateWorkshop,
  VARIABLES_FOR,
  type EveningReminder,
  type MessageKind,
  type MessageTemplate,
  type WorkshopInfo
} from '@hellokido/core/api'
import { messageKeys, usePackageNameTr, useTemplates } from '../../data/messages'
import { useActiveUsage, useCatalog, useRefresh, useRegistrations } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useToast } from '../../providers/Toasts'
import { LoadError, Mark } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { Select, Switch } from '../../ui/Choice'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { fieldLabelClass, TextArea, TextField } from '../../ui/Field'
import { Notice } from '../../ui/Notice'
import { Band } from '../../ui/Page'
import { Sheet, SheetActions, SheetFooter } from '../../ui/Sheet'
import { useSheet } from '../../ui/useSheet'
import { cx } from '../../ui/cx'
import { SettingAddRow, SettingBody, SettingList, SettingRow, SettingSkeleton } from './bits'

const BODY_LIMIT = 4000

/**
 * The WhatsApp texts parents receive: one in use per kind, more to choose from, and free ones
 * sent from a child's page. The workshop's facts sit above them, as every message may use them.
 */
export function MessageList() {
  const { t, fmt } = useI18n()
  const templates = useTemplates()
  const catalog = useCatalog()
  const sheet = useSheet<MessageTemplate | { kind: MessageKind }>()
  const workshopSheet = useSheet<WorkshopInfo>()
  const eveningSheet = useSheet<EveningReminder>()

  if (templates.isError)
    return (
      <SettingBody>
        <LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={() => void templates.refetch()} />
      </SettingBody>
    )
  if (!templates.data || !catalog.data) return <SettingSkeleton rows={4} />

  const workshop = catalog.data.settings.workshop
  const evening = catalog.data.settings.eveningReminder
  const byKind = MESSAGE_KINDS.map((kind) => ({ kind, rows: templates.data.filter((row) => row.kind === kind) }))

  return (
    // Each kind is a group with its own head on the felt, as in the panel's lists
    <div>
      <SettingList>
        <SettingRow
          title={t.messages.workshop.title}
          meta={fmt(t.messages.workshop.meta, { place: workshop.place, duration: workshop.duration })}
          onPress={() => workshopSheet.open(workshop)}
        />
        <SettingRow
          title={t.messages.evening.setting.title}
          meta={evening.enabled ? fmt(t.messages.evening.setting.on, { time: evening.time }) : t.messages.evening.setting.off}
          onPress={() => eveningSheet.open(evening)}
        />
      </SettingList>
      {byKind.map(({ kind, rows }) => (
        <div key={kind}>
          <Band className="flex-nowrap! justify-between gap-x-4! border-t border-line pt-3.5!">
            <h3 className="shrink-0">{t.messages.kinds[kind]}</h3>
            <span className="min-w-0 truncate font-normal text-ink-3">{t.messages.kindHints[kind]}</span>
          </Band>
          <SettingList>
            {rows.map((row) => (
              <SettingRow
                key={row.id}
                title={row.title}
                mark={row.is_default && kind !== 'custom' && <Mark tone="accent">{t.messages.inUse}</Mark>}
                meta={row.body.replace(/\s+/g, ' ')}
                onPress={() => sheet.open(row)}
              />
            ))}
            <SettingAddRow onPress={() => sheet.open({ kind })}>{t.messages.add}</SettingAddRow>
          </SettingList>
        </div>
      ))}
      {sheet.isOpen || sheet.key > 0 ? (
        <TemplateSheet key={sheet.key} isOpen={sheet.isOpen} onOpenChange={sheet.setOpen} target={sheet.payload} />
      ) : null}
      {workshopSheet.isOpen || workshopSheet.key > 0 ? (
        <WorkshopSheet key={`w${workshopSheet.key}`} isOpen={workshopSheet.isOpen} onOpenChange={workshopSheet.setOpen} info={workshopSheet.payload} />
      ) : null}
      {eveningSheet.isOpen || eveningSheet.key > 0 ? (
        <EveningSheet key={`e${eveningSheet.key}`} isOpen={eveningSheet.isOpen} onOpenChange={eveningSheet.setOpen} saved={eveningSheet.payload} />
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------

/** On or off and the hour of the evening reminder every admin phone gets from the server. */
function EveningSheet({ isOpen, onOpenChange, saved }: { isOpen: boolean; onOpenChange: (open: boolean) => void; saved: EveningReminder | null }) {
  const { t } = useI18n()
  const toast = useToast()
  const refresh = useRefresh()
  const initial = saved ?? DEFAULT_EVENING_REMINDER
  const [enabled, setEnabled] = useState(initial.enabled)
  const [text, setText] = useState(initial.time)
  const [busy, setBusy] = useState(false)
  const time = parseTimeOfDay(text)
  const dirty = enabled !== initial.enabled || text !== initial.time

  const save = async () => {
    if (busy || time === null) return
    if (!dirty) return onOpenChange(false)
    setBusy(true)
    try {
      await updateEveningReminder({ enabled, time })
      toast({ tone: 'success', title: t.messages.evening.setting.saved })
      void refresh.catalog()
      onOpenChange(false)
    } catch {
      toast({ tone: 'error', title: t.messages.evening.setting.failed })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={t.messages.evening.setting.title}
      description={t.messages.evening.setting.body}
      isDirty={dirty}
      isBusy={busy}
    >
      <div className="flex flex-col gap-5">
        <Switch isSelected={enabled} onChange={setEnabled}>
          {t.messages.evening.setting.enabled}
        </Switch>
        <TextField
          label={t.messages.evening.setting.time}
          description={t.messages.evening.setting.timeHint}
          value={text}
          onChange={(next) => setText(next.replace(/[^\d:.]/g, '').slice(0, 5))}
          onBlur={() => time && setText(time)}
          inputMode="numeric"
          autoComplete="off"
          inputClassName="tabular"
          isDisabled={!enabled}
          errorMessage={time === null ? t.messages.evening.setting.invalid : undefined}
          className="sm:max-w-[12rem]"
        />
        <SheetFooter>
          <SheetActions>
            <Button variant="primary" isDisabled={time === null || !dirty} isPending={busy} onPress={() => void save()} className="max-md:flex-1">
              {t.common.save}
            </Button>
          </SheetActions>
        </SheetFooter>
      </div>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------------------------

function WorkshopSheet({ isOpen, onOpenChange, info }: { isOpen: boolean; onOpenChange: (open: boolean) => void; info: WorkshopInfo | null }) {
  const { t } = useI18n()
  const toast = useToast()
  const refresh = useRefresh()
  const [value, setValue] = useState<WorkshopInfo>(info ?? { place: '', map: '', duration: '' })
  const [busy, setBusy] = useState(false)
  const dirty = Boolean(info) && (value.place !== info!.place || value.map !== info!.map || value.duration !== info!.duration)

  const save = async () => {
    if (busy) return
    if (!dirty) return onOpenChange(false)
    setBusy(true)
    try {
      await updateWorkshop(value)
      toast({ tone: 'success', title: t.messages.workshop.saved })
      void refresh.catalog()
      onOpenChange(false)
    } catch {
      toast({ tone: 'error', title: t.messages.workshop.failed })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet isOpen={isOpen} onOpenChange={onOpenChange} title={t.messages.workshop.title} description={t.messages.workshop.body} isDirty={dirty} isBusy={busy}>
      <div className="flex flex-col gap-5">
        <TextField label={t.messages.workshop.place} value={value.place} onChange={(place) => setValue({ ...value, place })} autoFocus />
        <TextField
          label={t.messages.workshop.map}
          description={t.messages.workshop.mapHint}
          value={value.map}
          onChange={(map) => setValue({ ...value, map })}
          inputMode="url"
          autoComplete="off"
        />
        <TextField label={t.messages.workshop.duration} value={value.duration} onChange={(duration) => setValue({ ...value, duration })} />
        <SheetFooter>
          <SheetActions>
            <Button variant="primary" isDisabled={!dirty} isPending={busy} onPress={() => void save()} className="max-md:flex-1">
              {t.common.save}
            </Button>
          </SheetActions>
        </SheetFooter>
      </div>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------------------------

type Target = MessageTemplate | { kind: MessageKind }
const isSaved = (target: Target | null): target is MessageTemplate => Boolean(target && 'id' in target)

function TemplateSheet({ isOpen, onOpenChange, target }: { isOpen: boolean; onOpenChange: (open: boolean) => void; target: Target | null }) {
  const { t } = useI18n()
  const [state, setState] = useState({ dirty: false, busy: false })
  const saved = isSaved(target)
  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={saved ? t.messages.form.editTitle : t.messages.form.newTitle}
      description={target ? t.messages.kinds[target.kind as MessageKind] : undefined}
      isDirty={state.dirty}
      isBusy={state.busy}
      size="lg"
    >
      {target && <TemplateForm target={target} onDone={() => onOpenChange(false)} onStateChange={setState} />}
    </Sheet>
  )
}

function TemplateForm({ target, onDone, onStateChange }: { target: Target; onDone: () => void; onStateChange: (state: { dirty: boolean; busy: boolean }) => void }) {
  const { t, fmt } = useI18n()
  const toast = useToast()
  const client = useQueryClient()
  const saved = isSaved(target) ? target : null
  const kind = target.kind as MessageKind
  const builtIn = kind === 'custom' ? '' : DEFAULT_MESSAGES[kind]

  const initial = useMemo(() => ({ title: saved?.title ?? '', body: saved?.body ?? builtIn }), [saved, builtIn])
  const [title, setTitle] = useState(initial.title)
  const [body, setBody] = useState(initial.body)
  const [busy, setBusy] = useState(false)
  const [askDelete, setAskDelete] = useState(false)
  const textRef = useRef<HTMLTextAreaElement>(null)

  const dirty = title !== initial.title || body !== initial.body
  useEffect(() => onStateChange({ dirty, busy }), [dirty, busy, onStateChange])

  const unknown = unknownVariables(body)
  const tooLong = body.length > BODY_LIMIT
  const valid = Boolean(title.trim()) && Boolean(body.trim()) && !tooLong
  const reload = () => void client.invalidateQueries({ queryKey: messageKeys.templates })

  // A variable goes where the cursor is, and the cursor lands after it
  const insert = (name: string) => {
    const field = textRef.current
    const token = `{${name}}`
    const start = field?.selectionStart ?? body.length
    const end = field?.selectionEnd ?? body.length
    const next = body.slice(0, start) + token + body.slice(end)
    setBody(next)
    requestAnimationFrame(() => {
      if (!field) return
      field.focus()
      field.setSelectionRange(start + token.length, start + token.length)
    })
  }

  const run = async (work: () => Promise<unknown>, success: string) => {
    if (busy) return
    setBusy(true)
    try {
      await work()
      toast({ tone: 'success', title: success })
      reload()
      onDone()
    } catch (error) {
      if (String((error as Error)?.message).includes('not_found')) {
        toast({ tone: 'warning', title: t.messages.form.notFound })
        reload()
        onDone()
        return
      }
      toast({ tone: 'error', title: t.messages.form.failed })
    } finally {
      setBusy(false)
    }
  }

  const save = () => {
    if (!valid) return
    if (!saved) return void run(() => addMessageTemplate({ kind, title: title.trim(), body }), t.messages.form.added)
    if (!dirty) return onDone()
    const changes: { title?: string; body?: string } = {}
    if (title !== initial.title) changes.title = title.trim()
    if (body !== initial.body) changes.body = body
    void run(() => updateMessageTemplate(saved.id, changes), t.messages.form.saved)
  }

  const makeInUse = () => {
    if (!saved) return
    void run(async () => {
      if (dirty) await updateMessageTemplate(saved.id, { title: title.trim(), body })
      await setDefaultMessageTemplate(saved.id)
    }, t.messages.form.nowInUse)
  }

  const suggested = VARIABLES_FOR[kind]
  const others = MESSAGE_VARIABLES.filter((name) => !suggested.includes(name))

  return (
    <div className="flex flex-col gap-5">
      {saved?.is_default && kind !== 'custom' && <Notice tone="info">{t.messages.form.inUseNote}</Notice>}
      <TextField
        label={t.messages.form.name}
        description={t.messages.form.nameHint}
        placeholder={t.messages.form.namePlaceholder}
        value={title}
        onChange={setTitle}
        maxLength={80}
        isRequired
        autoFocus={!saved}
      />
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className={fieldLabelClass}>{t.messages.form.variables}</span>
          <span className="text-[0.8125rem] text-ink-3">{t.messages.form.variablesHint}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[...suggested, ...others].map((name, index) => (
            <AriaButton
              key={name}
              onPress={() => insert(name)}
              className={cx(
                'relative inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[0.8125rem] font-medium outline-none transition-[background-color,color,box-shadow] duration-150',
                'pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-1.5',
                'data-focus-visible:ring-2 data-focus-visible:ring-focus',
                index < suggested.length
                  ? 'bg-sky-felt text-sky-ink data-hovered:bg-sky-track'
                  : 'text-ink-2 shadow-[inset_0_0_0_1.5px_var(--line)] data-hovered:text-ink data-hovered:shadow-[inset_0_0_0_1.5px_var(--line-strong)]'
              )}
            >
              <PlusIcon aria-hidden weight="bold" className="size-3" />
              {t.messages.variables[name]}
            </AriaButton>
          ))}
        </div>
      </div>
      <TextArea
        ref={textRef}
        label={t.messages.form.text}
        value={body}
        onChange={setBody}
        rows={kind === 'lesson' ? 14 : 6}
        errorMessage={tooLong ? t.messages.form.tooLong : undefined}
        isRequired
      />
      {unknown.length > 0 && <Notice tone="action">{fmt(t.messages.form.unknown, { names: unknown.map((name) => `{${name}}`).join(', ') })}</Notice>}
      {kind !== 'custom' && body !== builtIn && (
        <div className="-mt-2">
          <Button variant="quiet" size="sm" onPress={() => setBody(builtIn)}>
            {t.messages.form.restore}
          </Button>
        </div>
      )}
      <Preview kind={kind} body={body} />
      <SheetFooter>
        <SheetActions
          start={
            saved &&
            !(saved.is_default && kind !== 'custom') && (
              <Button variant="danger-soft" onPress={() => setAskDelete(true)} isDisabled={busy}>
                {t.messages.form.delete}
              </Button>
            )
          }
        >
          {saved && !saved.is_default && kind !== 'custom' && (
            <Button variant="secondary" onPress={makeInUse} isDisabled={!valid || busy}>
              {t.messages.form.useThis}
            </Button>
          )}
          <Button variant="primary" isDisabled={!valid || (saved !== null && !dirty)} isPending={busy} onPress={save} className="max-md:flex-1">
            {t.common.save}
          </Button>
        </SheetActions>
      </SheetFooter>
      <ConfirmDialog
        isOpen={askDelete}
        onOpenChange={setAskDelete}
        title={t.messages.form.deleteTitle}
        body={t.messages.form.deleteBody}
        confirmLabel={t.messages.form.delete}
        tone="danger"
        isPending={busy}
        onConfirm={() => {
          setAskDelete(false)
          if (saved) void run(() => deleteMessageTemplate(saved.id), t.messages.form.deleted)
        }}
      />
    </div>
  )
}

/** The text as a parent would get it, written for one of the registered children. */
function Preview({ kind, body }: { kind: MessageKind; body: string }) {
  const { t, money } = useI18n()
  const registrations = useRegistrations()
  const usage = useActiveUsage().data
  const catalog = useCatalog().data
  const packageName = usePackageNameTr()
  const children = useMemo(() => (registrations.data ?? []).filter((row) => row.is_active === true), [registrations.data])
  const [childId, setChildId] = useState<string | null>(null)
  const child = children.find((row) => row.id === childId) ?? children[0]

  const tomorrow = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() + 1)
    date.setHours(10, 0, 0, 0)
    return date
  }, [])

  if (!child) return <p className="text-sm text-ink-3">{t.messages.form.noChild}</p>
  const text = renderMessage(body, {
    parentName: child.parent_name,
    childName: child.student_name,
    lesson: kind === 'lesson' ? { date: tomorrow, type: 'duyusal' } : null,
    packageName: packageName(child.package_type),
    remaining: usage?.[child.id]?.remaining ?? null,
    endDate: child.package_end_date,
    amount: child.payment_amount ? `${money(Number(child.payment_amount))}` : null,
    workshop: catalog?.settings.workshop
  })

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <span className={fieldLabelClass}>{t.messages.form.preview}</span>
        <Select
          aria-label={t.messages.form.previewFor}
          className="w-full sm:w-64"
          value={child.id}
          onChange={setChildId}
          options={children.map((row) => ({ id: row.id, label: row.student_name }))}
        />
      </div>
      <div className="rounded-tile bg-felt px-4 py-3.5">
        <p className="max-w-[60ch] text-[0.90625rem] leading-relaxed whitespace-pre-wrap text-ink">{text}</p>
      </div>
      {kind === 'lesson' && <p className="text-[0.8125rem] text-ink-3">{t.messages.form.previewNote}</p>}
    </div>
  )
}
