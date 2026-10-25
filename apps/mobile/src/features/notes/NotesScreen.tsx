import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Stack } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { listNotes, updateNote, type Note } from '@hellokido/core/api'
import { matchesSearch } from '@hellokido/core/rules/text.js'
import { noteColor } from '@hellokido/core/view'
import { keys, useRefresh } from '../../data/queries'
import { headerButton, tasks } from '../../lib/navigation'
import { useI18n } from '../../providers/I18n'
import { useColors } from '../../theme/colors'
import { EmptyState, LoadError, Skeleton } from '../../ui/Bits'
import { Button, IconButton } from '../../ui/Button'
import { SearchField } from '../../ui/Fields'
import { Screen, Section } from '../../ui/Screen'
import { Text } from '../../ui/Text'
import { useToast } from '../../ui/Toast'
import { useCopyNote } from './copy'

/** A handful of notes is read at a glance; search comes once there are enough to look through. */
const SEARCH_FROM = 4

/**
 * Notes are mostly ready answers to what parents ask. Each one copies with one tap for a message;
 * the ones used most sit on top as favourites.
 */
export function NotesScreen() {
  const c = useColors()
  const { t, plural } = useI18n()
  const toast = useToast()
  const refresh = useRefresh()
  const client = useQueryClient()
  const copyNote = useCopyNote()
  const list = useQuery({ queryKey: keys.notes, queryFn: listNotes })
  const [query, setQuery] = useState('')

  const rows = list.data
  const search = (rows?.length ?? 0) >= SEARCH_FROM
  const term = search ? query : ''
  const shown = useMemo(() => (rows ?? []).filter((note) => matchesSearch(note.title, term) || matchesSearch(note.content ?? '', term)), [rows, term])
  const favorites = shown.filter((note) => note.is_favorite === true)
  const others = shown.filter((note) => note.is_favorite !== true)

  const copy = async (note: Note) => {
    const copied = await copyNote(note)
    toast(copied ? { title: t.notes.copied, body: t.notes.copiedBody } : { tone: 'error', title: t.notes.copyFailed })
  }

  const toggleFavorite = async (note: Note) => {
    const next = note.is_favorite !== true
    await client.cancelQueries({ queryKey: keys.notes })
    client.setQueryData<Note[]>(keys.notes, (current) => current?.map((row) => (row.id === note.id ? { ...row, is_favorite: next } : row)))
    void Haptics.selectionAsync()
    try {
      await updateNote(note.id, { is_favorite: next })
    } catch (error) {
      const gone = String((error as Error)?.message).includes('not_found')
      toast(gone ? { tone: 'warning', title: t.notes.form.notFound } : { tone: 'error', title: t.notes.favoriteFailed })
    } finally {
      void refresh.notes()
    }
  }

  const cards = (notes: Note[]) => (
    <View style={styles.cards}>
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} onCopy={() => void copy(note)} onFavorite={() => void toggleFavorite(note)} />
      ))}
    </View>
  )

  return (
    <>
      <Stack.Screen options={headerButton(c, t.notes.add, 'add', () => tasks.note())} />
      <Screen onRefresh={() => list.refetch()} gap={26}>
        {list.isError ? (
          <LoadError message={t.notes.loadFailed} retryLabel={t.common.retry} onRetry={() => void list.refetch()} />
        ) : !rows ? (
          <View style={styles.cards}>
            {[0, 1, 2].map((key) => (
              <Skeleton key={key} height={150} radius={16} />
            ))}
          </View>
        ) : rows.length === 0 ? (
          <EmptyState
            icon="note"
            title={t.notes.empty}
            body={t.notes.emptyBody}
            action={
              <Button variant="primary" icon="add" onPress={() => tasks.note()}>
                {t.notes.add}
              </Button>
            }
          />
        ) : (
          <>
            <View style={styles.top}>
              <Text variant="sub" tone="ink2" style={styles.summary}>
                {plural(t.notes.count, rows.length)}
              </Text>
              {search && <SearchField value={query} onChange={setQuery} placeholder={t.notes.search} label={t.notes.search} />}
            </View>
            {shown.length === 0 ? (
              <EmptyState icon="search" title={t.notes.noMatch} />
            ) : favorites.length > 0 ? (
              <>
                <Section title={t.notes.favorites} aside={favorites.length}>
                  {cards(favorites)}
                </Section>
                {others.length > 0 && (
                  <Section title={t.notes.others} aside={others.length}>
                    {cards(others)}
                  </Section>
                )}
              </>
            ) : (
              cards(others)
            )}
          </>
        )}
      </Screen>
    </>
  )
}

function NoteCard({ note, onCopy, onFavorite }: { note: Note; onCopy: () => void; onFavorite: () => void }) {
  const c = useColors()
  const { t, fmt, date } = useI18n()
  const color = noteColor(note.color)
  const favorite = note.is_favorite === true
  const content = note.content?.trim()

  return (
    <View style={[styles.card, { backgroundColor: c.surface }]}>
      <View style={styles.cardTop}>
        {/* The words open the note; the star and the copy button stay buttons of their own */}
        <Pressable
          onPress={() => tasks.note(note.id)}
          accessibilityRole="button"
          accessibilityLabel={[note.title, content].filter(Boolean).join('. ')}
          style={({ pressed }) => [styles.cardText, pressed && styles.pressed]}
        >
          <View style={styles.titleLine}>
            {/* The note's own colour stays on its dot: a tinted card in red would read as a warning */}
            {color && <View style={[styles.dot, { backgroundColor: color }]} />}
            <Text variant="callout" weight="600" numberOfLines={2} style={styles.title}>
              {note.title}
            </Text>
          </View>
          {content && (
            <Text variant="sub" tone="ink2" numberOfLines={6}>
              {content}
            </Text>
          )}
        </Pressable>
        <IconButton
          icon={favorite ? 'starFill' : 'star'}
          label={favorite ? t.notes.unfavorite : t.notes.favorite}
          variant="plain"
          size={34}
          color={favorite ? c.accent : c.ink3}
          onPress={onFavorite}
        />
      </View>
      <View style={styles.cardFoot}>
        <Text variant="foot" tone="ink3" numberOfLines={1} style={styles.title}>
          {note.created_at ? date(note.created_at, { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
        </Text>
        <Button size="sm" icon="copy" accessibilityLabel={fmt(t.notes.copyLabel, { title: note.title })} onPress={onCopy}>
          {t.notes.copy}
        </Button>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  top: { gap: 12 },
  summary: { paddingHorizontal: 4 },
  cards: { gap: 10 },
  card: { borderRadius: 18, paddingLeft: 16, paddingRight: 8, paddingTop: 12, paddingBottom: 12, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  cardText: { flex: 1, minWidth: 0, gap: 6, paddingTop: 2 },
  pressed: { opacity: 0.6 },
  // The dot sits on the first line of a title that wraps
  titleLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5.5 },
  title: { flex: 1, minWidth: 0 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 8 }
})
