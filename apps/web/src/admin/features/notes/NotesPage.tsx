import { useMemo, useState } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CopyIcon, NotePencilIcon, PlusIcon, StarIcon } from '@phosphor-icons/react'
import { listNotes, updateNote, type Note } from '@hellokido/core/api'
import { matchesSearch } from '@hellokido/core/rules/text.js'
import { keys, useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useToast } from '../../providers/Toasts'
import { useActions } from '../../shell/Actions'
import { EmptyState, IconDisc, LoadError, Skeleton } from '../../ui/Bits'
import { Button, IconButton } from '../../ui/Button'
import { SearchField } from '../../ui/Field'
import { Page, Section } from '../../ui/Page'
import { cx } from '../../ui/cx'
import { noteColor } from './bits'
import { useCopyNote } from './NoteSheet'

/** A handful of notes is read at a glance; search comes once there are enough to look through. */
const SEARCH_FROM = 4

/**
 * Notes are mostly ready answers to what parents ask. Each one copies with one tap; the ones used
 * most sit on top as favourites.
 */
export default function NotesPage() {
  const { t, plural } = useI18n()
  const toast = useToast()
  const refresh = useRefresh()
  const client = useQueryClient()
  const { startTask } = useActions()
  const copy = useCopyNote()
  const list = useQuery({ queryKey: keys.notes, queryFn: listNotes })
  const [query, setQuery] = useState('')

  const rows = list.data
  const search = (rows?.length ?? 0) >= SEARCH_FROM
  const term = search ? query : ''
  const shown = useMemo(() => (rows ?? []).filter((note) => matchesSearch(note.title, term) || matchesSearch(note.content ?? '', term)), [rows, term])
  const favorites = shown.filter((note) => note.is_favorite === true)
  const others = shown.filter((note) => note.is_favorite !== true)

  const toggleFavorite = async (note: Note) => {
    const next = note.is_favorite !== true
    await client.cancelQueries({ queryKey: keys.notes })
    client.setQueryData<Note[]>(keys.notes, (current) => current?.map((row) => (row.id === note.id ? { ...row, is_favorite: next } : row)))
    try {
      await updateNote(note.id, { is_favorite: next })
    } catch (error) {
      const gone = String((error as Error)?.message).includes('not_found')
      toast(gone ? { tone: 'warning', title: t.notes.form.notFound } : { tone: 'error', title: t.notes.favoriteFailed })
    } finally {
      void refresh.notes()
    }
  }

  const add = () => startTask('note')
  // Under "Favourites" and "The rest" a card title is a level below them; on its own it is the next level after the page
  const cards = (notes: Note[], level: 2 | 3) => (
    <ul className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
      {notes.map((note) => (
        <NoteCard
          key={note.id}
          level={level}
          note={note}
          onOpen={() => startTask('note', { note })}
          onCopy={() => void copy(note)}
          onFavorite={() => void toggleFavorite(note)}
        />
      ))}
    </ul>
  )

  return (
    <Page
      title={t.notes.title}
      summary={rows && rows.length > 0 ? plural(t.notes.count, rows.length) : undefined}
      toolbar={
        // Phones: the header's + stays the one filled button
        <Button variant="quiet" icon={<PlusIcon aria-hidden weight="bold" className="size-4" />} onPress={add} className="lg:hidden">
          {t.notes.add}
        </Button>
      }
      action={{ label: t.notes.add, onPress: add }}
    >
      {list.isError ? (
        <LoadError message={t.notes.loadFailed} retryLabel={t.common.retry} onRetry={() => void list.refetch()} />
      ) : !rows ? (
        <div aria-busy className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-52 rounded-panel!" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          className="rounded-panel bg-felt py-14"
          icon={
            <IconDisc className="size-11 bg-raised dark:bg-track">
              <NotePencilIcon className="size-5" />
            </IconDisc>
          }
          title={t.notes.empty}
          body={t.notes.emptyBody}
          action={
            <Button variant="primary" icon={<PlusIcon aria-hidden weight="bold" className="size-4" />} onPress={add}>
              {t.notes.add}
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-7">
          {search && <SearchField value={query} onChange={setQuery} placeholder={t.notes.search} label={t.notes.search} className="lg:max-w-[28rem]" />}
          {shown.length === 0 ? (
            <EmptyState title={t.notes.noMatch} />
          ) : favorites.length > 0 ? (
            <>
              <Section title={t.notes.favorites}>{cards(favorites, 3)}</Section>
              {others.length > 0 && <Section title={t.notes.others}>{cards(others, 3)}</Section>}
            </>
          ) : (
            cards(others, 2)
          )}
        </div>
      )}
    </Page>
  )
}

function NoteCard({
  note,
  level,
  onOpen,
  onCopy,
  onFavorite
}: {
  note: Note
  level: 2 | 3
  onOpen: () => void
  onCopy: () => void
  onFavorite: () => void
}) {
  const { t, fmt, date } = useI18n()
  const color = noteColor(note.color)
  const favorite = note.is_favorite === true
  const content = note.content?.trim()
  const Heading = level === 3 ? 'h3' : 'h2'

  return (
    // The note's own colour stays on its dot: a tinted card in red read as a warning
    <li
      className={cx(
        'on-felt relative flex min-w-0 flex-col rounded-panel bg-felt px-[1.125rem] pt-4 pb-[1.125rem] transition-[background-color,scale] duration-150 ease-standard sm:px-5',
        '[&:has(.note-open[data-hovered])]:bg-[color-mix(in_oklab,var(--felt)_95%,var(--ink))] [&:has(.note-open[data-pressed])]:scale-[0.99]'
      )}
    >
      <div className="flex items-start gap-2.5">
        {color && <span aria-hidden className="mt-[0.4375rem] size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
        <Heading className="min-w-0 flex-1 text-[1.0625rem] leading-[1.4375rem] font-semibold tracking-[-0.01em] text-ink">
          {/* The title opens the note; its hit area covers the whole card */}
          <AriaButton
            onPress={onOpen}
            className="note-open line-clamp-2 text-left outline-none after:absolute after:inset-0 after:rounded-panel data-focus-visible:after:ring-2 data-focus-visible:after:ring-focus"
          >
            {note.title}
          </AriaButton>
        </Heading>
        <IconButton
          label={favorite ? t.notes.unfavorite : t.notes.favorite}
          size="sm"
          onPress={onFavorite}
          className="relative z-10 -mt-1 -mr-1.5 shrink-0 max-lg:-mt-2.5 max-lg:size-10"
        >
          <StarIcon aria-hidden weight={favorite ? 'fill' : 'regular'} className={cx('size-[1.125rem]', favorite && 'text-accent')} />
        </IconButton>
      </div>
      {content && <p className="mt-2 line-clamp-6 text-[0.90625rem] leading-[1.375rem] whitespace-pre-line text-ink-2">{content}</p>}
      <div className="mt-auto flex items-center gap-2 pt-4">
        <span className="min-w-0 flex-1 truncate text-[0.84375rem] text-ink-3">
          {note.created_at && date(note.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
        <Button
          size="sm"
          variant="secondary"
          icon={<CopyIcon aria-hidden className="size-4" />}
          aria-label={fmt(t.notes.copyLabel, { title: note.title })}
          onPress={onCopy}
          className="relative z-10 max-lg:h-10"
        >
          {t.notes.copy}
        </Button>
      </div>
    </li>
  )
}
