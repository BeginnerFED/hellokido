import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Pressable, StyleSheet, View, type TextInputInstance } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { addNote, deleteNote, listNotes, NOTE_COLORS, updateNote, type Note, type NoteFields } from '@hellokido/core/api'
import { noteColor, PLAIN_NOTE } from '@hellokido/core/view'
import { keys, useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useColors } from '../../theme/colors'
import { EmptyState, ListSkeleton } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { SwitchField, TextField } from '../../ui/Fields'
import { Icon } from '../../ui/Icon'
import { CardButton, FormGroup } from '../../ui/Screen'
import { SheetActions, SheetScreen, useSheet } from '../../ui/Sheet'
import { Text } from '../../ui/Text'
import { useToast } from '../../ui/Toast'
import { useCopyNote } from './copy'

// Dark ink on the coloured swatches: they stay light in both themes
const SWATCH_INK = '#1c1b18'

/** A note to write or change; it can be copied from here too, before or after saving. */
export function NoteSheet({ id }: { id?: string }) {
  const { t } = useI18n()
  const list = useQuery({ queryKey: keys.notes, queryFn: listNotes, enabled: Boolean(id) })
  const note = id ? (list.data?.find((row) => row.id === id) ?? null) : null

  if (!id || note) return <NoteForm note={note} />
  return (
    <SheetScreen title={t.notes.form.editTitle}>
      {list.isPending ? (
        <ListSkeleton rows={2} />
      ) : (
        <EmptyState
          icon="info"
          title={list.isError ? t.common.loadFailed : t.notes.form.notFound}
          action={
            list.isError ? (
              <Button size="sm" icon="refresh" busy={list.isFetching} onPress={() => void list.refetch()}>
                {t.common.retry}
              </Button>
            ) : undefined
          }
        />
      )}
    </SheetScreen>
  )
}

function NoteForm({ note }: { note: Note | null }) {
  const { t, fmt } = useI18n()
  const toast = useToast()
  const refresh = useRefresh()
  // This form draws its own SheetScreen, so the bar's action closes the sheet it is in through this
  const sheet = useSheet()
  const copyNote = useCopyNote()

  const [initial] = useState(() => ({
    title: note?.title ?? '',
    content: note?.content ?? '',
    color: noteColor(note?.color) ?? PLAIN_NOTE,
    favorite: note?.is_favorite === true
  }))
  const [title, setTitle] = useState(initial.title)
  const [content, setContent] = useState(initial.content)
  const [color, setColor] = useState<string>(initial.color)
  const [favorite, setFavorite] = useState(initial.favorite)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contentRef = useRef<TextInputInstance>(null)
  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current)
  }, [])

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

  const save = async () => {
    if (!valid || busy) return
    if (note && !dirty) return sheet.finish()
    setBusy(true)
    setError(null)
    try {
      if (note) {
        await updateNote(note.id, changes)
        toast({ title: t.notes.form.updated })
      } else {
        await addNote({ title: title.trim(), content: content.trim() || null, color, is_favorite: favorite })
        toast({ title: t.notes.form.saved })
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      void refresh.notes()
      sheet.finish()
    } catch (caught) {
      if (String((caught as Error)?.message).includes('not_found')) {
        toast({ tone: 'warning', title: t.notes.form.notFound })
        void refresh.notes()
        sheet.finish()
        return
      }
      setError(t.notes.form.failed)
    } finally {
      setBusy(false)
    }
  }

  const remove = () => {
    if (!note) return
    Alert.alert(t.notes.form.deleteTitle, fmt(t.notes.form.deleteBody, { title: note.title }), [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.delete,
        style: 'destructive',
        onPress: async () => {
          setBusy(true)
          setError(null)
          try {
            const found = await deleteNote(note.id)
            toast(found ? { title: t.notes.form.deleted } : { tone: 'warning', title: t.notes.form.notFound })
            void refresh.notes()
            sheet.finish()
          } catch {
            setError(t.notes.form.deleteFailed)
          } finally {
            setBusy(false)
          }
        }
      }
    ])
  }

  // A toast would be drawn under the sheet, so the row itself says it worked
  const copy = async () => {
    const done = await copyNote({ title, content })
    if (!done) {
      setError(t.notes.copyFailed)
      return
    }
    setError(null)
    setCopied(true)
    if (copiedTimer.current) clearTimeout(copiedTimer.current)
    copiedTimer.current = setTimeout(() => setCopied(false), 2000)
  }

  // Title and text in one card, as the phone's Reminders writes a task; the bar saves
  return (
    <SheetScreen
      title={note ? t.notes.form.editTitle : t.notes.form.newTitle}
      dirty={dirty}
      busy={busy}
      // A note being changed waits for a change; a new one for its title
      action={{ label: t.notes.form.save, disabled: !valid || (note !== null && !dirty), onPress: () => void save() }}
    >
      <FormGroup>
        <TextField
          accessibilityLabel={t.notes.form.title}
          placeholder={t.notes.form.title}
          value={title}
          onChangeText={setTitle}
          autoCapitalize="sentences"
          autoComplete="off"
          autoFocus={!note}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => contentRef.current?.focus()}
        />
        <TextField
          ref={contentRef}
          accessibilityLabel={t.notes.form.content}
          placeholder={t.notes.form.contentPlaceholder}
          value={content}
          onChangeText={setContent}
          autoCapitalize="sentences"
          multiline
          minHeight={180}
        />
      </FormGroup>
      <ColorPicker value={color} onChange={setColor} />
      <FormGroup>
        <SwitchField label={t.notes.form.favorite} value={favorite} onChange={setFavorite} />
      </FormGroup>
      <SheetActions error={error}>
        {(content.trim() !== '' || title.trim() !== '') && <CardButton icon={copied ? 'check' : 'copy'} label={copied ? t.notes.copied : t.notes.copy} onPress={() => void copy()} />}
        {note && <CardButton label={t.notes.form.delete} destructive disabled={busy} onPress={remove} />}
      </SheetActions>
    </SheetScreen>
  )
}

function ColorPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const c = useColors()
  const { t } = useI18n()
  return (
    <FormGroup
      title={
        // The chosen colour's name stands at the right of the heading
        <View style={styles.colorTitle}>
          <Text variant="sub" weight="600" tone="ink2">
            {t.notes.form.color}
          </Text>
          <Text variant="sub" tone="ink3">
            {t.notes.colors[value]}
          </Text>
        </View>
      }
    >
      <View accessibilityRole="radiogroup" accessibilityLabel={t.notes.form.color} style={styles.colors}>
        {NOTE_COLORS.map((hex) => {
          const on = hex === value
          const plain = hex === PLAIN_NOTE
          return (
            <Pressable
              key={hex}
              onPress={() => {
                if (on) return
                void Haptics.selectionAsync()
                onChange(hex)
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={t.notes.colors[hex] ?? hex}
              style={styles.colorTarget}
            >
              {/* The chosen colour gets a ring, with a little ground between ring and colour */}
              <View style={[styles.ring, { borderColor: on ? c.ink : 'transparent' }]}>
                {/* "No colour" is a plain piece lifted off the felt */}
                <View style={[styles.swatch, { backgroundColor: plain ? c.raised : hex }, plain && { borderWidth: 1, borderColor: c.lineStrong }]}>
                  {on && <Icon name="check" size={15} color={plain ? c.ink : SWATCH_INK} weight="bold" />}
                </View>
              </View>
            </Pressable>
          )
        })}
      </View>
    </FormGroup>
  )
}

const styles = StyleSheet.create({
  colorTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  // The swatches spread over the row, as the colours of a list in Reminders
  colors: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 6 },
  colorTarget: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  ring: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }
})
