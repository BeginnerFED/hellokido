import { useMemo, useRef, useState } from 'react'
import { Alert, StyleSheet, View, type TextInputInstance } from 'react-native'
import * as Haptics from 'expo-haptics'
import { useQueryClient } from '@tanstack/react-query'
import {
  addMessageTemplate,
  DEFAULT_MESSAGES,
  deleteMessageTemplate,
  MESSAGE_KINDS,
  MESSAGE_VARIABLES,
  renderMessage,
  setDefaultMessageTemplate,
  unknownVariables,
  updateMessageTemplate,
  VARIABLES_FOR,
  type MessageKind,
  type MessageTemplate
} from '@hellokido/core/api'
import { messageKeys, useTemplates } from '../../data/messages'
import { useActiveUsage, useCatalog, useRegistrations } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useColors } from '../../theme/colors'
import { EmptyState, ListSkeleton, Notice } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { Chip, SelectField, TextField } from '../../ui/Fields'
import { Icon } from '../../ui/Icon'
import { Card, CardButton, FormGroup, GroupFooter, GroupTitle, QuietCard } from '../../ui/Screen'
import { SheetActions, SheetScreen, useSheet } from '../../ui/Sheet'
import { Text } from '../../ui/Text'
import { useToast } from '../../ui/Toast'

const BODY_LIMIT = 4000

type Target = MessageTemplate | { kind: MessageKind }
const isSaved = (target: Target): target is MessageTemplate => 'id' in target
const isKind = (value: string | undefined): value is MessageKind => MESSAGE_KINDS.includes(value as MessageKind)

/** A WhatsApp text to change (`id`), or a new one of a kind, as the web panel's message sheet. */
export function MessageTemplateSheet({ id, kind }: { id?: string; kind?: string }) {
  const { t } = useI18n()
  const templates = useTemplates()
  const form = t.messages.form
  const saved = id ? (templates.data?.find((row) => row.id === id) ?? null) : null
  const target: Target | null = saved ?? (!id && isKind(kind) ? { kind } : null)

  if (target) return <TemplateForm target={target} />
  return (
    <SheetScreen title={id ? form.editTitle : form.newTitle}>
      {templates.data || !id ? (
        <EmptyState icon="info" title={form.notFound} />
      ) : templates.isError ? (
        <EmptyState
          icon="info"
          title={t.common.loadFailed}
          action={
            <Button size="sm" icon="refresh" busy={templates.isFetching} onPress={() => void templates.refetch()}>
              {t.common.retry}
            </Button>
          }
        />
      ) : (
        <ListSkeleton rows={3} />
      )}
    </SheetScreen>
  )
}

function TemplateForm({ target }: { target: Target }) {
  const c = useColors()
  const { t, fmt } = useI18n()
  const toast = useToast()
  const client = useQueryClient()
  // This form draws its own SheetScreen, so the bar's action closes the sheet it is in through this
  const sheet = useSheet()
  const form = t.messages.form
  const saved = isSaved(target) ? target : null
  const kind = target.kind as MessageKind
  const builtIn = kind === 'custom' ? '' : DEFAULT_MESSAGES[kind]
  const inUse = Boolean(saved?.is_default) && kind !== 'custom'

  const [initial] = useState(() => ({ title: saved?.title ?? '', body: saved?.body ?? builtIn }))
  const [title, setTitle] = useState(initial.title)
  const [body, setBody] = useState(initial.body)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<TextInputInstance | null>(null)
  // Where the cursor was last in the text; a new text starts at its end
  const selection = useRef({ start: initial.body.length, end: initial.body.length })

  const dirty = title !== initial.title || body !== initial.body
  const unknown = unknownVariables(body)
  const tooLong = body.length > BODY_LIMIT
  const valid = Boolean(title.trim()) && Boolean(body.trim()) && !tooLong
  const reload = () => void client.invalidateQueries({ queryKey: messageKeys.templates })

  // A variable goes where the cursor is, and the cursor lands after it
  const insert = (name: string) => {
    const token = `{${name}}`
    const { start, end } = selection.current
    setBody((current) => current.slice(0, start) + token + current.slice(end))
    const at = start + token.length
    selection.current = { start: at, end: at }
    void Haptics.selectionAsync()
    requestAnimationFrame(() => {
      input.current?.focus()
      input.current?.setSelection(at, at)
    })
  }

  const run = async (work: () => Promise<unknown>, success: string) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await work()
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      toast({ title: success })
      reload()
      sheet.finish()
    } catch (caught) {
      // Deleted on another device meanwhile: say so and close, the list reads again
      if (String((caught as Error)?.message).includes('not_found')) {
        toast({ tone: 'warning', title: form.notFound })
        reload()
        sheet.finish()
        return
      }
      setError(form.failed)
    } finally {
      setBusy(false)
    }
  }

  const save = () => {
    if (!valid) return
    if (!saved) return void run(() => addMessageTemplate({ kind, title: title.trim(), body }), form.added)
    if (!dirty) return sheet.finish()
    const changes: { title?: string; body?: string } = {}
    if (title !== initial.title) changes.title = title.trim()
    if (body !== initial.body) changes.body = body
    void run(() => updateMessageTemplate(saved.id, changes), form.saved)
  }

  const makeInUse = () => {
    if (!saved) return
    void run(async () => {
      if (dirty) await updateMessageTemplate(saved.id, { title: title.trim(), body })
      await setDefaultMessageTemplate(saved.id)
    }, form.nowInUse)
  }

  const remove = () => {
    if (!saved) return
    Alert.alert(form.deleteTitle, form.deleteBody, [
      { text: t.common.cancel, style: 'cancel' },
      { text: form.delete, style: 'destructive', onPress: () => void run(() => deleteMessageTemplate(saved.id), form.deleted) }
    ])
  }

  // The ones this kind of message usually needs come first
  const suggested = VARIABLES_FOR[kind]
  const names = [...suggested, ...MESSAGE_VARIABLES.filter((name) => !suggested.includes(name))]

  return (
    <SheetScreen
      title={saved ? form.editTitle : form.newTitle}
      subtitle={t.messages.kinds[kind]}
      dirty={dirty}
      busy={busy}
      action={{ label: saved ? t.common.save : t.common.add, disabled: !valid || (saved !== null && !dirty), onPress: save }}
    >
      {inUse && <Notice>{form.inUseNote}</Notice>}
      <FormGroup footer={form.nameHint}>
        <TextField
          label={form.name}
          placeholder={form.namePlaceholder}
          value={title}
          onChangeText={setTitle}
          maxLength={80}
          autoFocus={!saved}
          autoCapitalize="sentences"
          returnKeyType="done"
        />
      </FormGroup>

      <View>
        <GroupTitle>{form.variables}</GroupTitle>
        <View style={styles.chips}>
          {names.map((name) => (
            <Chip
              key={name}
              label={t.messages.variables[name]}
              leading={<Icon name="add" size={13} color={c.ink2} weight="medium" />}
              accessibilityLabel={`${form.variables}: ${t.messages.variables[name]}`}
              onPress={() => insert(name)}
            />
          ))}
        </View>
        <GroupFooter>{form.variablesHint}</GroupFooter>
      </View>

      <TextField
        ref={input}
        label={form.text}
        multiline
        value={body}
        onChangeText={setBody}
        onSelectionChange={(event) => {
          selection.current = event.nativeEvent.selection
        }}
        // The box grows with the text, so the sheet scrolls one thing, not two
        scrollEnabled={false}
        minHeight={kind === 'lesson' ? 260 : 140}
        autoCapitalize="sentences"
        error={tooLong ? form.tooLong : undefined}
      />
      {unknown.length > 0 && <Notice tone="action">{fmt(form.unknown, { names: unknown.map((name) => `{${name}}`).join(', ') })}</Notice>}
      {kind !== 'custom' && body !== builtIn && <CardButton label={form.restore} icon="refresh" disabled={busy} onPress={() => setBody(builtIn)} />}

      <Preview kind={kind} body={body} />

      <SheetActions error={error}>
        {saved && !inUse && kind !== 'custom' && <CardButton label={form.useThis} disabled={!valid || busy} onPress={makeInUse} />}
        {saved && !inUse && <CardButton label={form.delete} destructive disabled={busy} onPress={remove} />}
      </SheetActions>
    </SheetScreen>
  )
}

/** The text as a parent would get it, written for one of the registered children. */
function Preview({ kind, body }: { kind: MessageKind; body: string }) {
  const { t, money } = useI18n()
  const registrations = useRegistrations()
  const usage = useActiveUsage().data
  const catalog = useCatalog().data
  const form = t.messages.form
  const children = useMemo(
    () => (registrations.data ?? []).filter((row) => row.is_active === true).sort((a, b) => a.student_name.localeCompare(b.student_name, 'tr')),
    [registrations.data]
  )
  const [childId, setChildId] = useState<string | null>(null)
  const child = children.find((row) => row.id === childId) ?? children[0]

  // Lesson messages are shown for a lesson tomorrow at 10:00
  const tomorrow = useMemo(() => {
    const day = new Date()
    day.setDate(day.getDate() + 1)
    day.setHours(10, 0, 0, 0)
    return day
  }, [])

  if (!child) {
    return (
      <View>
        <GroupTitle>{form.preview}</GroupTitle>
        <QuietCard>{form.noChild}</QuietCard>
      </View>
    )
  }

  // Package names go to parents in Turkish whatever the app's language
  const packageName = catalog?.packages.find((row) => row.code === child.package_type)?.name_tr ?? child.package_type
  const text = renderMessage(body, {
    parentName: child.parent_name,
    childName: child.student_name,
    lesson: kind === 'lesson' ? { date: tomorrow, type: 'duyusal' } : null,
    packageName,
    remaining: usage?.[child.id]?.remaining ?? null,
    endDate: child.package_end_date,
    amount: child.payment_amount ? money(Number(child.payment_amount)) : null,
    workshop: catalog?.settings.workshop
  })

  return (
    <View>
      <GroupTitle>{form.preview}</GroupTitle>
      <Card>
        <SelectField
          label={form.previewFor}
          placeholder={child.student_name}
          options={children.map((row) => ({ id: row.id, label: row.student_name }))}
          value={child.id}
          onChange={setChildId}
        />
        <Text selectable style={styles.preview}>
          {text}
        </Text>
      </Card>
      {kind === 'lesson' && <GroupFooter>{form.previewNote}</GroupFooter>}
    </View>
  )
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preview: { paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, lineHeight: 22 }
})
