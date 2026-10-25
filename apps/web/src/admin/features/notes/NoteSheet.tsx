import { useCallback, useEffect, useMemo, useState } from 'react'
import { Label, Radio, RadioGroup } from 'react-aria-components'
import { CheckIcon, CopyIcon, TrashIcon } from '@phosphor-icons/react'
import { addNote, deleteNote, NOTE_COLORS, updateNote, type Note, type NoteFields } from '@hellokido/core/api'
import { useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useToast } from '../../providers/Toasts'
import { Button } from '../../ui/Button'
import { Switch } from '../../ui/Choice'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { fieldLabelClass, TextArea, TextField } from '../../ui/Field'
import { Sheet, SheetActions, SheetFooter } from '../../ui/Sheet'
import { cx } from '../../ui/cx'
import { copyable, copyText, noteColor, PLAIN } from './bits'

export type NoteParams = { note?: Note }

type FormState = { dirty: boolean; busy: boolean }

/** Copies a note for a message and says so; the person pastes it right after. */
export function useCopyNote() {
  const { t } = useI18n()
  const toast = useToast()
  return useCallback(
    async (note: { title: string; content: string | null }) => {
      const copied = await copyText(copyable(note))
      toast(copied ? { tone: 'success', title: t.notes.copied, body: t.notes.copiedBody } : { tone: 'error', title: t.notes.copyFailed })
    },
    [t, toast]
  )
}

export function NoteSheet({ isOpen, onOpenChange, params }: { isOpen: boolean; onOpenChange: (open: boolean) => void; params: NoteParams }) {
  const { t } = useI18n()
  const [state, setState] = useState<FormState>({ dirty: false, busy: false })
  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={params.note ? t.notes.form.editTitle : t.notes.form.newTitle}
      isDirty={state.dirty}
      isBusy={state.busy}
      size="lg"
    >
      <NoteForm note={params.note} onDone={() => onOpenChange(false)} onStateChange={setState} />
    </Sheet>
  )
}

function NoteForm({ note, onDone, onStateChange }: { note?: Note; onDone: () => void; onStateChange: (state: FormState) => void }) {
  const { t, fmt } = useI18n()
  const toast = useToast()
  const refresh = useRefresh()
  const copy = useCopyNote()

  const initial = useMemo(
    () => ({ title: note?.title ?? '', content: note?.content ?? '', color: noteColor(note?.color) ?? PLAIN, favorite: note?.is_favorite === true }),
    [note]
  )
  const [title, setTitle] = useState(initial.title)
  const [content, setContent] = useState(initial.content)
  const [color, setColor] = useState(initial.color)
  const [favorite, setFavorite] = useState(initial.favorite)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)

  // Only what changed is sent, so a star set meanwhile by the other admin is kept
  const changes = useMemo<Partial<NoteFields>>(() => {
    const diff: Partial<NoteFields> = {}
    if (title.trim() !== initial.title.trim()) diff.title = title.trim()
    if (content.trim() !== initial.content.trim()) diff.content = content.trim() || null
    if (color !== initial.color) diff.color = color
    if (favorite !== initial.favorite) diff.is_favorite = favorite
    return diff
  }, [title, content, color, favorite, initial])

  const valid = title.trim() !== ''
  const dirty = Object.keys(changes).length > 0
  useEffect(() => onStateChange({ dirty, busy }), [dirty, busy, onStateChange])

  const save = async () => {
    if (!valid || busy) return
    if (note && !dirty) return onDone()
    setBusy(true)
    try {
      if (note) {
        await updateNote(note.id, changes)
        toast({ tone: 'success', title: t.notes.form.updated })
      } else {
        await addNote({ title: title.trim(), content: content.trim() || null, color, is_favorite: favorite })
        toast({ tone: 'success', title: t.notes.form.saved })
      }
      void refresh.notes()
      onDone()
    } catch (error) {
      if (String((error as Error)?.message).includes('not_found')) {
        toast({ tone: 'warning', title: t.notes.form.notFound })
        void refresh.notes()
        onDone()
        return
      }
      toast({ tone: 'error', title: t.notes.form.failed })
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!note) return
    setBusy(true)
    try {
      const found = await deleteNote(note.id)
      setConfirming(false)
      toast(found ? { tone: 'success', title: t.notes.form.deleted } : { tone: 'warning', title: t.notes.form.notFound })
      void refresh.notes()
      onDone()
    } catch {
      toast({ tone: 'error', title: t.notes.form.deleteFailed })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <TextField
        label={t.notes.form.title}
        placeholder={t.notes.form.titlePlaceholder}
        value={title}
        onChange={setTitle}
        autoComplete="off"
        autoFocus={!note}
      />
      <TextArea label={t.notes.form.content} placeholder={t.notes.form.contentPlaceholder} value={content} onChange={setContent} rows={9} />
      <RadioGroup value={color} onChange={setColor} orientation="horizontal" className="flex flex-col gap-1.5">
        <Label className={fieldLabelClass}>{t.notes.form.color}</Label>
        <div className="flex flex-wrap items-center gap-1">
          {NOTE_COLORS.map((hex) => (
            <Radio
              key={hex}
              value={hex}
              aria-label={t.notes.colors[hex] ?? hex}
              className="group grid size-11 cursor-default place-items-center rounded-full outline-none data-focus-visible:ring-2 data-focus-visible:ring-focus"
            >
              <span
                aria-hidden
                style={{ backgroundColor: hex === PLAIN ? 'var(--surface)' : hex }}
                className={cx(
                  'grid size-8 place-items-center rounded-full transition-[box-shadow] duration-150',
                  hex === PLAIN && 'border border-line-strong',
                  'group-data-selected:shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--ink)]'
                )}
              >
                <CheckIcon weight="bold" className={cx('size-4 opacity-0 group-data-selected:opacity-100', hex === PLAIN ? 'text-ink' : 'text-[#1c2430]')} />
              </span>
            </Radio>
          ))}
          <span className="ml-1 text-sm text-ink-2">{t.notes.colors[color] ?? ''}</span>
        </div>
      </RadioGroup>
      <Switch isSelected={favorite} onChange={setFavorite}>
        {t.notes.form.favorite}
      </Switch>

      <SheetFooter>
        <SheetActions
          start={
            note && (
              <Button variant="danger-soft" icon={<TrashIcon aria-hidden className="size-4" />} onPress={() => setConfirming(true)} isDisabled={busy}>
                {t.notes.form.delete}
              </Button>
            )
          }
        >
          {(content.trim() || title.trim()) && (
            <Button variant="secondary" icon={<CopyIcon aria-hidden className="size-4" />} onPress={() => void copy({ title, content })}>
              {t.notes.copy}
            </Button>
          )}
          <Button variant="primary" isDisabled={!valid} isPending={busy} onPress={() => void save()} className="max-md:flex-1">
            {t.notes.form.save}
          </Button>
        </SheetActions>
      </SheetFooter>
      <ConfirmDialog
        isOpen={confirming}
        onOpenChange={setConfirming}
        title={t.notes.form.deleteTitle}
        body={note && fmt(t.notes.form.deleteBody, { title: note.title })}
        confirmLabel={t.common.delete}
        tone="danger"
        isPending={busy}
        onConfirm={() => void remove()}
      />
    </div>
  )
}
