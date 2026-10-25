import { useMemo, useState } from 'react'
import { Alert, Pressable, StyleSheet, View } from 'react-native'
import { Stack } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { deleteWaitlistEntry, listWaitlist, updateWaitlistEntry, WAITLIST_PACKAGES, type WaitlistEntry } from '@hellokido/core/api'
import { askedOn, byQueue, CONTACTED, matchesEntry, UNDECIDED, WAITING, type WaitStatus } from '@hellokido/core/view'
import { keys, useLabels, useRefresh } from '../../data/queries'
import { headerButton, tasks } from '../../lib/navigation'
import { useI18n } from '../../providers/I18n'
import { useColors } from '../../theme/colors'
import { useActionMenu } from '../../ui/ActionMenu'
import { EmptyState, ListSkeleton, LoadError } from '../../ui/Bits'
import { Button, IconButton } from '../../ui/Button'
import { Chip, SearchField } from '../../ui/Fields'
import { displayPhone, PhoneActions } from '../../ui/PhoneActions'
import { Card, Screen, Section } from '../../ui/Screen'
import { DOT, Text } from '../../ui/Text'
import { useToast } from '../../ui/Toast'
import { askedAgo, WaitPeg } from './bits'

const ANY_PACKAGE = 'all'
/** A short list is read at a glance; search and the package filter come once there is a list to search. */
const TOOLS_FROM = 6

const rank = (code: string) => {
  const index = (WAITLIST_PACKAGES as readonly string[]).indexOf(code)
  return index === -1 ? WAITLIST_PACKAGES.length : index
}

/**
 * Families who asked for a place, in the order they asked. Waiting ones still need a call; once
 * talked to they move down, and a family that takes the place is registered from here.
 */
export function WaitlistScreen() {
  const c = useColors()
  const { t, fmt, plural } = useI18n()
  const labels = useLabels()
  const toast = useToast()
  const refresh = useRefresh()
  const client = useQueryClient()
  const menu = useActionMenu()
  const list = useQuery({ queryKey: keys.waitlist, queryFn: listWaitlist })

  const [query, setQuery] = useState('')
  const [pkg, setPkg] = useState<string>(ANY_PACKAGE)

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
  const packages = useMemo(() => {
    const counts = new Map<string, number>()
    for (const entry of rows ?? []) counts.set(entry.package_type, (counts.get(entry.package_type) ?? 0) + 1)
    return [...counts.keys()].sort((a, b) => rank(a) - rank(b)).map((code) => ({ code, count: counts.get(code) ?? 0 }))
  }, [rows])

  const choosePackage = () =>
    menu.open(t.waitlist.packageFilter, [
      { label: t.children.anyPackage, onPress: () => setPkg(ANY_PACKAGE) },
      ...packages.map(({ code, count }) => ({ label: `${labels.packageName(code)}${DOT}${count}`, onPress: () => setPkg(code) }))
    ])

  const clearFilters = () => {
    setQuery('')
    setPkg(ANY_PACKAGE)
  }

  const changeStatus = async (entry: WaitlistEntry, next: WaitStatus, undoable = true) => {
    const before: WaitStatus = entry.status === CONTACTED ? CONTACTED : WAITING
    await client.cancelQueries({ queryKey: keys.waitlist })
    client.setQueryData<WaitlistEntry[]>(keys.waitlist, (current) => current?.map((row) => (row.id === entry.id ? { ...row, status: next } : row)))
    void Haptics.selectionAsync()
    try {
      await updateWaitlistEntry(entry.id, { status: next })
      toast({
        title: fmt(next === CONTACTED ? t.waitlist.markedContacted : t.waitlist.markedWaiting, { name: entry.student_name }),
        action: undoable ? { label: t.common.undo, onPress: () => void changeStatus({ ...entry, status: next }, before, false) } : undefined
      })
    } catch (error) {
      const gone = String((error as Error)?.message).includes('not_found')
      toast(gone ? { tone: 'warning', title: t.waitlist.form.notFound } : { tone: 'error', title: t.waitlist.markFailed })
    } finally {
      void refresh.waitlist()
    }
  }

  const remove = (entry: WaitlistEntry) =>
    Alert.alert(t.waitlist.form.deleteTitle, fmt(t.waitlist.form.deleteBody, { child: entry.student_name, parent: entry.parent_name }), [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.delete,
        style: 'destructive',
        onPress: async () => {
          try {
            const found = await deleteWaitlistEntry(entry.id)
            toast(found ? { title: t.waitlist.form.deleted } : { tone: 'warning', title: t.waitlist.form.alreadyDeleted })
          } catch {
            toast({ tone: 'error', title: t.waitlist.form.deleteFailed })
          } finally {
            void refresh.waitlist()
          }
        }
      }
    ])

  const register = (entry: WaitlistEntry) => tasks.registration({ waitlistId: entry.id })

  const more = (entry: WaitlistEntry) =>
    menu.open(entry.student_name, [
      entry.status === CONTACTED
        ? { label: t.waitlist.markWaiting, icon: 'undo', onPress: () => void changeStatus(entry, WAITING) }
        : { label: t.waitlist.register, icon: 'personAdd', onPress: () => register(entry) },
      { label: t.waitlist.edit, icon: 'edit', onPress: () => tasks.waitlist(entry.id) },
      { label: t.waitlist.delete, icon: 'delete', destructive: true, onPress: () => remove(entry) }
    ])

  const entries = (items: WaitlistEntry[], empty: string) =>
    items.length === 0 ? (
      <Text variant="foot" tone="ink3" style={styles.sectionEmpty}>
        {empty}
      </Text>
    ) : (
      <Card inset={60}>
        {items.map((entry) => (
          <EntryRow
            key={entry.id}
            entry={entry}
            onContacted={() => void changeStatus(entry, CONTACTED)}
            onRegister={() => register(entry)}
            onMore={() => more(entry)}
          />
        ))}
      </Card>
    )

  return (
    <>
      <Stack.Screen options={headerButton(c, t.waitlist.add, 'add', () => tasks.waitlist())} />
      {menu.element}
      <Screen onRefresh={() => list.refetch()} gap={26}>
        {list.isError ? (
          <LoadError message={t.waitlist.loadFailed} retryLabel={t.common.retry} onRetry={() => void list.refetch()} />
        ) : !rows ? (
          <ListSkeleton rows={4} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="waitlist"
            title={t.waitlist.empty}
            body={t.waitlist.emptyBody}
            action={
              <Button variant="primary" icon="add" onPress={() => tasks.waitlist()}>
                {t.waitlist.add}
              </Button>
            }
          />
        ) : (
          <>
            <View style={styles.top}>
              <Text variant="sub" tone="ink2" style={styles.summary}>
                {plural(t.waitlist.summary, rows.length)}
              </Text>
              {tools && <SearchField value={query} onChange={setQuery} placeholder={t.waitlist.search} label={t.waitlist.search} />}
              {tools && (
                <View style={styles.chips}>
                  <Chip label={pkg === ANY_PACKAGE ? t.waitlist.packageFilter : labels.packageName(pkg)} selected={pkg !== ANY_PACKAGE} onPress={choosePackage} menu />
                </View>
              )}
            </View>
            {shown.length === 0 ? (
              <EmptyState
                icon="search"
                title={t.waitlist.noMatch}
                action={
                  <Button size="sm" onPress={clearFilters}>
                    {t.common.clearFilters}
                  </Button>
                }
              />
            ) : (
              <>
                <Section title={t.waitlist.waiting} aside={waiting.length}>
                  {entries(waiting, t.waitlist.waitingEmpty)}
                </Section>
                <Section title={t.waitlist.contacted} aside={contacted.length}>
                  {entries(contacted, t.waitlist.contactedEmpty)}
                </Section>
              </>
            )}
          </>
        )}
      </Screen>
    </>
  )
}

type EntryRowProps = { entry: WaitlistEntry; onContacted: () => void; onRegister: () => void; onMore: () => void }

function EntryRow({ entry, onContacted, onRegister, onMore }: EntryRowProps) {
  const c = useColors()
  const i18n = useI18n()
  const { t, fmt } = i18n
  const labels = useLabels()
  const day = askedOn(entry)
  const name = entry.student_name
  const note = entry.notes?.trim()
  const who = [entry.student_age, entry.parent_name, displayPhone(entry.parent_phone)].filter(Boolean).join(DOT)
  const packageName = labels.packageName(entry.package_type)
  const asked = day ? fmt(t.waitlist.asked, { when: askedAgo(i18n, day) }) : null

  return (
    <View style={styles.entry}>
      <WaitPeg name={name} />
      <View style={styles.entryBody}>
        <View style={styles.entryTop}>
          {/* The words open the entry; the buttons under them stay buttons of their own */}
          <Pressable
            onPress={() => tasks.waitlist(entry.id)}
            accessibilityRole="button"
            accessibilityLabel={[name, who, packageName, asked, note].filter(Boolean).join('. ')}
            style={({ pressed }) => [styles.entryText, pressed && styles.pressed]}
          >
            <Text variant="callout" weight="600" numberOfLines={1}>
              {name}
            </Text>
            <Text variant="foot" tone="ink2" numberOfLines={2}>
              {who}
            </Text>
            <Text variant="foot" tone="ink3" numberOfLines={2}>
              {/* A package they asked about reads stronger than "not decided yet" */}
              <Text variant="foot" tone={entry.package_type === UNDECIDED ? 'ink3' : 'ink2'}>
                {packageName}
              </Text>
              {asked && `${DOT}${asked}`}
            </Text>
            {note && (
              <Text variant="foot" tone="ink2" numberOfLines={3} style={styles.note}>
                {note}
              </Text>
            )}
          </Pressable>
          <IconButton icon="ellipsis" label={fmt(t.waitlist.more, { name })} variant="plain" size={32} color={c.ink3} onPress={onMore} />
        </View>
        <View style={styles.actions}>
          {/* As tall as the button beside them */}
          <PhoneActions phone={entry.parent_phone} size={34} />
          {entry.status === CONTACTED ? (
            <Button size="sm" icon="personAdd" accessibilityLabel={fmt(t.waitlist.registerLabel, { name })} onPress={onRegister}>
              {t.waitlist.register}
            </Button>
          ) : (
            <Button size="sm" icon="check" accessibilityLabel={fmt(t.waitlist.markContactedLabel, { name })} onPress={onContacted}>
              {t.waitlist.markContacted}
            </Button>
          )}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  top: { gap: 12 },
  summary: { paddingHorizontal: 4 },
  chips: { flexDirection: 'row' },
  sectionEmpty: { paddingHorizontal: 4 },
  entry: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingLeft: 16, paddingRight: 8, paddingVertical: 12 },
  entryBody: { flex: 1, minWidth: 0, gap: 10 },
  entryTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  entryText: { flex: 1, minWidth: 0, gap: 2 },
  pressed: { opacity: 0.6 },
  note: { marginTop: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }
})
