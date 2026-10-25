import { useMemo, useState } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowCounterClockwiseIcon, CheckIcon, DotsThreeIcon, HourglassIcon, PencilSimpleIcon, PlusIcon, TrashIcon, UserPlusIcon } from '@phosphor-icons/react'
import { deleteWaitlistEntry, listWaitlist, updateWaitlistEntry, WAITLIST_PACKAGES, type WaitlistEntry } from '@hellokido/core/api'
import { keys, useLabels, useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useToast } from '../../providers/Toasts'
import { useActions } from '../../shell/Actions'
import { EmptyState, IconDisc, initialsOf, LoadError, Skeleton } from '../../ui/Bits'
import { Button, IconButton } from '../../ui/Button'
import { Select, type Option } from '../../ui/Choice'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { SearchField } from '../../ui/Field'
import { Menu, MenuItem, MenuSeparator } from '../../ui/Menu'
import { Card, Page } from '../../ui/Page'
import { displayPhone, PhoneActions } from '../../ui/PhoneActions'
import { askedAgo, askedOn, byQueue, CONTACTED, matchesEntry, UNDECIDED, WAITING, type WaitStatus } from './rules'

const ANY_PACKAGE = 'all'
/** A short list is read at a glance; search and the package filter come once there is a list to search. */
const TOOLS_FROM = 6

/**
 * Families who asked for a place, in the order they asked. Waiting ones still need a call; once
 * talked to they move over, and a family that takes the place is registered from here.
 */
export default function WaitlistPage() {
  const { t, fmt, plural } = useI18n()
  const labels = useLabels()
  const toast = useToast()
  const refresh = useRefresh()
  const client = useQueryClient()
  const { startTask } = useActions()
  const list = useQuery({ queryKey: keys.waitlist, queryFn: listWaitlist })

  const [query, setQuery] = useState('')
  const [pkg, setPkg] = useState<string>(ANY_PACKAGE)
  const [deleting, setDeleting] = useState<WaitlistEntry | null>(null)
  const [removing, setRemoving] = useState(false)

  const rows = list.data
  const tools = (rows?.length ?? 0) >= TOOLS_FROM
  const term = tools ? query : ''
  const packageCode = tools ? pkg : ANY_PACKAGE

  const shown = useMemo(
    () => (rows ?? []).filter((entry) => matchesEntry(entry, term) && (packageCode === ANY_PACKAGE || entry.package_type === packageCode)).sort(byQueue),
    [rows, term, packageCode]
  )
  const waiting = shown.filter((entry) => entry.status !== CONTACTED)
  const contacted = shown.filter((entry) => entry.status === CONTACTED)

  // Only the packages families on the list asked about, in the usual order
  const packageOptions = useMemo<Option[]>(() => {
    const counts = new Map<string, number>()
    for (const entry of rows ?? []) counts.set(entry.package_type, (counts.get(entry.package_type) ?? 0) + 1)
    const codes = [...counts.keys()].sort((a, b) => rank(a) - rank(b))
    return [{ id: ANY_PACKAGE, label: t.children.anyPackage }, ...codes.map((code) => ({ id: code, label: `${labels.packageName(code)} (${counts.get(code)})` }))]
  }, [rows, labels, t])

  const changeStatus = async (entry: WaitlistEntry, next: WaitStatus, undoable = true) => {
    const before = entry.status === CONTACTED ? CONTACTED : WAITING
    await client.cancelQueries({ queryKey: keys.waitlist })
    client.setQueryData<WaitlistEntry[]>(keys.waitlist, (current) => current?.map((row) => (row.id === entry.id ? { ...row, status: next } : row)))
    try {
      await updateWaitlistEntry(entry.id, { status: next })
      toast({
        tone: 'success',
        title: fmt(next === CONTACTED ? t.waitlist.markedContacted : t.waitlist.markedWaiting, { name: entry.student_name }),
        action: undoable ? { label: t.common.undo, onAction: () => void changeStatus({ ...entry, status: next }, before, false) } : undefined
      })
    } catch (error) {
      const gone = String((error as Error)?.message).includes('not_found')
      toast(gone ? { tone: 'warning', title: t.waitlist.form.notFound } : { tone: 'error', title: t.waitlist.markFailed })
    } finally {
      void refresh.waitlist()
    }
  }

  const remove = async () => {
    if (!deleting) return
    setRemoving(true)
    try {
      const found = await deleteWaitlistEntry(deleting.id)
      toast(found ? { tone: 'success', title: t.waitlist.form.deleted } : { tone: 'warning', title: t.waitlist.form.alreadyDeleted })
      setDeleting(null)
    } catch {
      toast({ tone: 'error', title: t.waitlist.form.deleteFailed })
    } finally {
      setRemoving(false)
      void refresh.waitlist()
    }
  }

  const add = () => startTask('waitlist')
  const actions = {
    edit: (entry: WaitlistEntry) => startTask('waitlist', { entry }),
    register: (entry: WaitlistEntry) => startTask('registration', { fromWaitlist: entry }),
    status: (entry: WaitlistEntry, next: WaitStatus) => void changeStatus(entry, next),
    delete: setDeleting
  }

  const toolbar = (
    <>
      {tools && (
        <Select aria-label={t.waitlist.packageFilter} options={packageOptions} value={pkg} onChange={setPkg} className="min-w-0 flex-1 sm:w-[15rem] sm:flex-none" />
      )}
      {/* Phones: the header's + stays the one filled button */}
      <Button variant="quiet" icon={<PlusIcon aria-hidden weight="bold" className="size-4" />} onPress={add} className="lg:hidden">
        {t.waitlist.add}
      </Button>
    </>
  )

  return (
    <Page
      title={t.waitlist.title}
      summary={rows && (rows.length ? plural(t.waitlist.summary, rows.length) : t.waitlist.summaryNone)}
      toolbar={toolbar}
      action={{ label: t.waitlist.add, onPress: add }}
    >
      {list.isError ? (
        <LoadError message={t.waitlist.loadFailed} retryLabel={t.common.retry} onRetry={() => void list.refetch()} />
      ) : !rows ? (
        <div aria-busy className="grid items-start gap-4 lg:grid-cols-2 lg:gap-5">
          {[0, 1].map((column) => (
            <div key={column} className="flex flex-col gap-3 rounded-panel bg-felt px-4 pt-5 pb-4 sm:px-[1.375rem]">
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          className="rounded-panel bg-felt py-14"
          icon={
            <IconDisc className="size-11 bg-raised dark:bg-track">
              <HourglassIcon className="size-5" />
            </IconDisc>
          }
          title={t.waitlist.empty}
          body={t.waitlist.emptyBody}
          action={
            <Button variant="primary" icon={<PlusIcon aria-hidden weight="bold" className="size-4" />} onPress={add}>
              {t.waitlist.add}
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-5">
          {tools && <SearchField value={query} onChange={setQuery} placeholder={t.waitlist.search} label={t.waitlist.search} className="lg:max-w-[28rem]" />}
          {shown.length === 0 ? (
            <EmptyState
              title={t.waitlist.noMatch}
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onPress={() => {
                    setQuery('')
                    setPkg(ANY_PACKAGE)
                  }}
                >
                  {t.common.clearFilters}
                </Button>
              }
            />
          ) : (
            <div className="grid items-start gap-4 lg:grid-cols-2 lg:gap-5">
              <Card title={t.waitlist.waiting} aside={waiting.length} bodyClassName="pb-1.5">
                <Entries entries={waiting} empty={t.waitlist.waitingEmpty} actions={actions} />
              </Card>
              <Card title={t.waitlist.contacted} aside={contacted.length} bodyClassName="pb-1.5">
                <Entries entries={contacted} empty={t.waitlist.contactedEmpty} actions={actions} />
              </Card>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={deleting !== null}
        onOpenChange={(open) => !open && !removing && setDeleting(null)}
        title={t.waitlist.form.deleteTitle}
        body={deleting && fmt(t.waitlist.form.deleteBody, { child: deleting.student_name, parent: deleting.parent_name })}
        confirmLabel={t.common.delete}
        tone="danger"
        isPending={removing}
        onConfirm={() => void remove()}
      />
    </Page>
  )
}

const rank = (code: string) => {
  const index = (WAITLIST_PACKAGES as readonly string[]).indexOf(code)
  return index === -1 ? WAITLIST_PACKAGES.length : index
}

type EntryActions = {
  edit: (entry: WaitlistEntry) => void
  register: (entry: WaitlistEntry) => void
  status: (entry: WaitlistEntry, next: WaitStatus) => void
  delete: (entry: WaitlistEntry) => void
}

function Entries({ entries, empty, actions }: { entries: WaitlistEntry[]; empty: string; actions: EntryActions }) {
  if (entries.length === 0) return <p className="px-4 pt-0.5 pb-4 text-[0.9375rem] text-ink-3 sm:px-[1.375rem]">{empty}</p>
  return (
    <ul>
      {entries.map((entry) => (
        <Entry key={entry.id} entry={entry} actions={actions} />
      ))}
    </ul>
  )
}

function Entry({ entry, actions }: { entry: WaitlistEntry; actions: EntryActions }) {
  const { t, fmt, tag } = useI18n()
  const labels = useLabels()
  const day = askedOn(entry)
  const contacted = entry.status === CONTACTED
  const name = entry.student_name
  const more = fmt(t.waitlist.more, { name })
  const note = entry.notes?.trim()
  const phone = displayPhone(entry.parent_phone)

  return (
    <li className="flex gap-3 border-t border-line px-4 pt-3.5 pb-4 first:border-t-0 first:pt-1.5 sm:px-[1.375rem]">
      {/* A seat not taken yet: the peg of a child who has no place */}
      <span
        aria-hidden
        className="mt-0.5 grid size-[2.375rem] shrink-0 place-items-center rounded-full border-[1.5px] border-dashed border-ink-3/50 text-[0.8125rem] font-semibold text-ink-2"
      >
        {initialsOf(name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="min-w-0">
              <AriaButton
                onPress={() => actions.edit(entry)}
                className="relative inline-block max-w-full rounded-[0.25rem] text-left align-top text-[0.96875rem] leading-[1.3125rem] font-medium text-ink outline-none data-hovered:underline data-hovered:decoration-1 data-hovered:underline-offset-[3px] data-focus-visible:ring-2 data-focus-visible:ring-focus pointer-coarse:after:absolute pointer-coarse:after:-inset-x-1 pointer-coarse:after:-inset-y-2.5"
              >
                {/* Cut off inside, so the larger touch area is not cut off with it */}
                <span className="block truncate">{name}</span>
              </AriaButton>
            </h3>
            <p className="mt-0.5 text-[0.84375rem] leading-[1.125rem] text-ink-2">
              {entry.student_age}
              {' · '}
              {entry.parent_name}
              {phone && (
                <>
                  {' · '}
                  <span className="whitespace-nowrap tabular">{phone}</span>
                </>
              )}
            </p>
          </div>
          <Menu
            label={more}
            trigger={
              <IconButton label={more} size="sm" className="-mt-0.5 -mr-2 shrink-0 max-lg:size-10">
                <DotsThreeIcon aria-hidden weight="bold" className="size-[1.125rem]" />
              </IconButton>
            }
          >
            {contacted ? (
              <MenuItem icon={<ArrowCounterClockwiseIcon aria-hidden className="size-[1.125rem]" />} onAction={() => actions.status(entry, WAITING)}>
                {t.waitlist.markWaiting}
              </MenuItem>
            ) : (
              <MenuItem icon={<UserPlusIcon aria-hidden className="size-[1.125rem]" />} onAction={() => actions.register(entry)}>
                {t.waitlist.register}
              </MenuItem>
            )}
            <MenuItem icon={<PencilSimpleIcon aria-hidden className="size-[1.125rem]" />} onAction={() => actions.edit(entry)}>
              {t.waitlist.edit}
            </MenuItem>
            <MenuSeparator />
            <MenuItem tone="danger" icon={<TrashIcon aria-hidden className="size-[1.125rem]" />} onAction={() => actions.delete(entry)}>
              {t.waitlist.delete}
            </MenuItem>
          </Menu>
        </div>
        <p className="mt-0.5 text-[0.84375rem] leading-[1.125rem] text-ink-3">
          <span className={entry.package_type === UNDECIDED ? undefined : 'font-medium text-ink-2'}>{labels.packageName(entry.package_type)}</span>
          {day && (
            <>
              {' · '}
              <time dateTime={entry.contact_date} className="whitespace-nowrap">
                {fmt(t.waitlist.asked, { when: askedAgo(tag, day) })}
              </time>
            </>
          )}
        </p>
        {note && <p className="mt-2 line-clamp-3 text-[0.90625rem] leading-[1.3125rem] whitespace-pre-line text-ink text-pretty">{note}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <PhoneActions phone={entry.parent_phone} />
          {contacted ? (
            <Button
              variant="secondary"
              icon={<UserPlusIcon aria-hidden className="size-4" />}
              aria-label={fmt(t.waitlist.registerLabel, { name })}
              onPress={() => actions.register(entry)}
            >
              {t.waitlist.register}
            </Button>
          ) : (
            <Button
              variant="secondary"
              icon={<CheckIcon aria-hidden weight="bold" className="size-4" />}
              aria-label={fmt(t.waitlist.markContactedLabel, { name })}
              onPress={() => actions.status(entry, CONTACTED)}
            >
              {t.waitlist.markContacted}
            </Button>
          )}
        </div>
      </div>
    </li>
  )
}
