import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BackHandler, FlatList, Keyboard, Linking, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { Stack, useNavigation } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQueryClient } from '@tanstack/react-query'
import { remainingTone, type Registration, type Usage, type UsageMap } from '@hellokido/core/api'
import { phoneDigits, whatsAppLink } from '@hellokido/core/rules/phone.js'
import { byName, daysLeft, ENDING_WINDOW_DAYS, isEnding, isFree, isPaymentDue, isRunningLow, matchesChild, remainingText } from '@hellokido/core/view'
import { useTemplates } from '../../data/messages'
import { useActiveUsage, useCatalog, useChildLessons, useChildUsage, useLabels, useRegistrations } from '../../data/queries'
import { headerButton, tasks, useOpenChild } from '../../lib/navigation'
import { useI18n } from '../../providers/I18n'
import { useColors } from '../../theme/colors'
import { useActionMenu, type MenuItem } from '../../ui/ActionMenu'
import { Avatar, AVATAR_INSET, EmptyState, firstNameOf, ListSkeleton, LoadError, Mark, Skeleton } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { Chip, SearchField, Segmented } from '../../ui/Fields'
import { OfflineNotice } from '../../ui/OfflineNotice'
import { Card, RoundButton, ScreenHeader, usePullRefresh, useTabHeader } from '../../ui/Screen'
import { closeSwipedRow, SwipeRow, type RowAction } from '../../ui/SwipeRow'
import { DOT, Text } from '../../ui/Text'
import { usePackageOptions } from '../payment/fields'
import { packageEndText } from './ChildDetailScreen'
import { useMessageItems } from './ChildMessages'

type ListView = 'active' | 'archived'
type Filter = 'pending' | 'low' | 'ending'
const ANY_PACKAGE = 'all'

const TESTS: Record<Filter, (row: Registration, usage: UsageMap | undefined) => boolean> = {
  pending: (row) => isPaymentDue(row),
  low: (row, usage) => !isFree(row) && isRunningLow(usage?.[row.id]),
  ending: (row) => isEnding(row)
}

/**
 * Every child as one felt list, found by name, parent or phone. The title and the search sit in
 * the page; the chips say how many children each filter leaves; each row shows the lessons left as
 * a big figure. A child opens on its own page and back returns to the same place.
 */
export function ChildrenScreen() {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const { t, plural } = useI18n()
  // "+" in the iPhone's own bar, as on the other tabs; Android keeps the round button
  const head = useTabHeader({ options: headerButton(c, t.children.newRegistration, 'add', () => tasks.registration()), buttons: 1 })
  const labels = useLabels()
  const client = useQueryClient()
  const menu = useActionMenu()
  const openChild = useOpenChild()
  const registrations = useRegistrations()
  const usage = useActiveUsage().data
  const packageOrder = usePackageOptions({ includeFree: true })

  const [view, setView] = useState<ListView>('active')
  const [filter, setFilter] = useState<Filter | null>(null)
  const [pkg, setPkg] = useState<string>(ANY_PACKAGE)
  const [query, setQuery] = useState('')

  // On Android back first hides the keyboard (the phone does that), then empties the search. Only
  // while the list is on screen: a child's page opened from the search goes back as usual.
  const navigation = useNavigation()
  const searching = query !== ''
  useEffect(() => {
    if (Platform.OS !== 'android' || !searching) return
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!navigation.isFocused()) return false
      setQuery('')
      return true
    })
    return () => subscription.remove()
  }, [searching, navigation])

  const rows = registrations.data
  const activeCount = useMemo(() => (rows ?? []).filter((row) => row.is_active === true).length, [rows])
  const inView = useMemo(() => (rows ?? []).filter((row) => (view === 'active' ? row.is_active === true : row.is_active !== true)), [rows, view])
  const searched = useMemo(() => inView.filter((row) => matchesChild(row, query)), [inView, query])
  const inPackage = useMemo(() => (pkg === ANY_PACKAGE ? searched : searched.filter((row) => row.package_type === pkg)), [searched, pkg])

  const shown = useMemo(() => {
    const list = view === 'active' && filter ? inPackage.filter((row) => TESTS[filter](row, usage)) : [...inPackage]
    if (view === 'active' && filter === 'ending') {
      return list.sort((a, b) => new Date(a.package_end_date).getTime() - new Date(b.package_end_date).getTime() || byName(a, b))
    }
    if (view === 'active' && filter === 'low') {
      return list.sort((a, b) => (usage?.[a.id]?.remaining ?? 0) - (usage?.[b.id]?.remaining ?? 0) || byName(a, b))
    }
    return list.sort(byName)
  }, [inPackage, view, filter, usage])

  // No count before the list has loaded: a 0 there would say "nobody" while it is not known yet
  const count = (id: Filter) => (rows && (id !== 'low' || usage) ? inPackage.filter((row) => TESTS[id](row, usage)).length : undefined)
  const filters: { id: Filter; label: string }[] = [
    { id: 'pending', label: t.children.filters.pending },
    { id: 'low', label: t.children.filters.low },
    { id: 'ending', label: t.children.filters.ending }
  ]

  // Only the packages children in this view actually have, in the catalog's order
  const packages = useMemo(() => {
    const order = packageOrder.map((option) => option.id)
    const counts = new Map<string, number>()
    for (const row of searched) counts.set(row.package_type, (counts.get(row.package_type) ?? 0) + 1)
    const rank = (code: string) => (order.indexOf(code) === -1 ? order.length : order.indexOf(code))
    return [...counts.keys()].sort((a, b) => rank(a) - rank(b)).map((code) => ({ code, count: counts.get(code) ?? 0 }))
  }, [packageOrder, searched])

  const choosePackage = () =>
    menu.open(t.children.anyPackage, [
      { label: t.children.anyPackage, onPress: () => setPkg(ANY_PACKAGE) },
      ...packages.map(({ code, count: total }) => ({ label: `${labels.packageName(code)}${DOT}${total}`, onPress: () => setPkg(code) }))
    ])

  const changeView = (next: ListView) => {
    setView(next)
    setFilter(null)
    setPkg(ANY_PACKAGE)
  }
  const clearFilters = () => {
    setFilter(null)
    setPkg(ANY_PACKAGE)
  }

  // The search keeps the keyboard (and Android's back) under the child's page unless it lets go first
  const open = useCallback(
    (id: string) => {
      Keyboard.dismiss()
      openChild(id)
    },
    [openChild]
  )

  const refresh = useCallback(async () => {
    await Promise.all([registrations.refetch(), client.invalidateQueries({ queryKey: ['usage'] })])
  }, [registrations, client])
  const pull = usePullRefresh(refresh)

  // "Message" from a row's menu: the family's saved messages are read for that child alone, then offered
  const [messaging, setMessaging] = useState<Registration | null>(null)
  const openMenu = menu.open
  const offerMessages = useCallback(
    (items: MenuItem[]) => {
      setMessaging(null)
      openMenu(t.messages.send.button, items, t.messages.send.menuHint)
    },
    [openMenu, t]
  )

  const pendingCount = count('pending')
  const header = (
    <View>
      <ScreenHeader
        title={t.children.title}
        subtitle={rows ? plural(t.children.summary.active, activeCount) : undefined}
        actions={head.native ? undefined : <RoundButton icon="add" label={t.children.newRegistration} onPress={() => tasks.registration()} />}
        head={head}
      />
      <View style={styles.tools}>
        <OfflineNotice />
        <SearchField value={query} onChange={setQuery} placeholder={t.children.searchPlaceholder} label={t.children.searchPlaceholder} />
        <Segmented<ListView>
          options={[
            { id: 'active', label: t.children.views.active },
            { id: 'archived', label: t.children.views.archived }
          ]}
          value={view}
          onChange={changeView}
        />
        {/* One row that scrolls sideways, like the filters of the phone's own apps */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={styles.chipsScroll}
          contentContainerStyle={styles.chips}
          accessibilityLabel={t.children.filters.label}
        >
          {view === 'active' &&
            filters.map((item) => (
              <Chip
                key={item.id}
                label={item.label}
                count={count(item.id)}
                dot={item.id === 'pending' && pendingCount ? c.amber : undefined}
                selected={filter === item.id}
                onPress={() => setFilter(filter === item.id ? null : item.id)}
              />
            ))}
          <Chip label={pkg === ANY_PACKAGE ? t.children.anyPackage : labels.packageName(pkg)} selected={pkg !== ANY_PACKAGE} onPress={choosePackage} menu />
        </ScrollView>
      </View>
    </View>
  )
  // The count closes the list, as in the phone's Contacts
  const footer =
    rows && shown.length > 0 ? (
      <Text variant="foot" tone="ink3" align="center" tabular style={styles.count}>
        {plural(t.children.count, shown.length)}
      </Text>
    ) : undefined

  const empty = registrations.isError ? (
    <LoadError message={t.children.loadFailed} retryLabel={t.common.retry} onRetry={() => void registrations.refetch()} />
  ) : !rows ? (
    <ListSkeleton rows={8} />
  ) : (
    <Card padded>
      {rows.length === 0 ? (
        <EmptyState
          icon="personAdd"
          title={t.children.empty.none}
          body={t.children.empty.noneBody}
          action={
            <Button variant="primary" icon="add" onPress={() => tasks.registration()}>
              {t.children.newRegistration}
            </Button>
          }
        />
      ) : view === 'archived' && inView.length === 0 ? (
        <EmptyState icon="archive" title={t.children.empty.archive} />
      ) : (
        <EmptyState
          icon="search"
          title={query.trim() ? t.children.empty.search : t.children.empty.filters}
          action={
            filter || pkg !== ANY_PACKAGE ? (
              <Button size="sm" onPress={clearFilters}>
                {t.common.clearFilters}
              </Button>
            ) : undefined
          }
        />
      )}
    </Card>
  )

  // The iPhone keeps the list under the status bar by itself; Android's page starts at the very top
  const top = Platform.OS === 'android' ? insets.top : 0

  return (
    <View style={[styles.flex, { backgroundColor: c.page }]}>
      <Stack.Screen options={head.options} />
      {menu.element}
      {messaging && <MessagePicker key={messaging.id} registration={messaging} activeUsage={usage?.[messaging.id]} onReady={offerMessages} />}
      <FlatList
        data={rows ? shown : []}
        keyExtractor={(row) => row.id}
        renderItem={({ item, index }) => (
          <ChildRow row={item} usage={usage} first={index === 0} last={index === shown.length - 1} onOpen={open} openMenu={openMenu} onMessage={setMessaging} />
        )}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ListEmptyComponent={empty}
        onScrollBeginDrag={closeSwipedRow}
        contentInsetAdjustmentBehavior="automatic"
        contentInset={head.contentInset}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        initialNumToRender={14}
        windowSize={11}
        style={{ backgroundColor: c.page }}
        contentContainerStyle={[styles.content, { paddingTop: top }]}
        refreshControl={
          <RefreshControl
            refreshing={pull.refreshing}
            onRefresh={pull.onRefresh}
            tintColor={c.ink3}
            colors={[c.accent]}
            progressBackgroundColor={c.raised}
            progressViewOffset={top}
          />
        }
      />
      {/* What scrolls up passes under the status bar on plain paper, not under the clock */}
      <View pointerEvents="none" style={[styles.statusCover, { height: insets.top, backgroundColor: c.page }]} />
    </View>
  )
}

type ChildRowProps = {
  row: Registration
  usage: UsageMap | undefined
  first: boolean
  last: boolean
  onOpen: (id: string) => void
  openMenu: (title: string | undefined, items: MenuItem[]) => void
  onMessage: (row: Registration) => void
}

/** The lessons left at the right of a row: the figure (amber when two or fewer) over a small word. */
function LessonsLeft({ usage }: { usage: Usage | undefined }) {
  const i18n = useI18n()
  if (!usage) {
    return (
      <View style={styles.left}>
        <Skeleton height={20} width={22} radius={6} />
      </View>
    )
  }
  if (usage.isFree || usage.total === null) return null
  const remaining = Math.max(usage.remaining ?? 0, 0)
  const tone = remainingTone(usage)
  return (
    <View style={styles.left}>
      <Text variant="figure" tabular tone={tone === 'low' || tone === 'out' ? 'amberInk' : 'ink'} maxFontSizeMultiplier={1.2}>
        {remaining}
      </Text>
      <Text variant="foot" tone="ink3" numberOfLines={1} maxFontSizeMultiplier={1.2}>
        {i18n.plural(i18n.t.children.phone.lessonsUnit, remaining)}
      </Text>
    </View>
  )
}

function ChildRow({ row, usage, first, last, onOpen, openMenu, onMessage }: ChildRowProps) {
  const c = useColors()
  const i18n = useI18n()
  const { t, fmt } = i18n
  const labels = useLabels()
  const active = row.is_active === true
  const free = isFree(row)
  const days = active ? daysLeft(row) : null
  // The child's page's own buttons, a swipe or a hold away: call and take a payment behind the row
  const digits = phoneDigits(row.parent_phone)
  const offered: (RowAction | null)[] = [
    digits
      ? { key: 'call', label: t.children.detail.callParent, short: t.common.call, icon: 'call', swipe: 'accent', onPress: () => void Linking.openURL(`tel:${digits}`).catch(() => undefined) }
      : null,
    whatsAppLink(row.parent_phone) ? { key: 'message', label: t.messages.send.button, icon: 'chat', onPress: () => onMessage(row) } : null,
    active ? { key: 'pay', label: t.children.detail.actions.takePayment, icon: 'money', swipe: 'positive', onPress: () => tasks.payment({ registrationId: row.id }) } : null
  ]
  const actions = offered.filter((action): action is RowAction => action !== null)
  // Under the name: the one thing that asks for a look, else the package and the parent
  const about = [labels.packageName(row.package_type), row.parent_name ? fmt(t.children.phone.parentOf, { name: firstNameOf(row.parent_name) }) : ''].filter(Boolean).join(', ')
  const kind = !active ? 'about' : isPaymentDue(row) ? 'due' : days !== null && days < 0 ? 'ended' : days !== null && days <= ENDING_WINDOW_DAYS ? 'ending' : 'about'
  const subText = kind === 'due' ? t.children.pendingPayment : (kind === 'ended' || kind === 'ending') && days !== null ? packageEndText(i18n, days) : about
  const sub =
    kind === 'due' || kind === 'ended' ? (
      <Mark tone="action">{subText}</Mark>
    ) : (
      <Text variant="sub" tone={kind === 'ending' ? 'ink2' : 'ink3'} numberOfLines={1}>
        {subText}
      </Text>
    )
  // The row reads as one sentence to a screen reader: name, what asks for a look, lessons left
  const left = active && !free ? usage?.[row.id] : undefined
  const label = [row.student_name, subText, left && !left.isFree && left.total !== null ? remainingText(i18n, left) : ''].filter(Boolean).join(', ')
  // The rows of a long list draw the felt card between them: its corners and its rules
  return (
    <View style={[styles.card, { backgroundColor: c.felt }, first && styles.first, first && !last && styles.overlap, last && styles.last]}>
      {/* The card's corners clip the buttons a swipe shows */}
      <SwipeRow actions={actions} openMenu={openMenu} menuTitle={row.student_name} onPress={() => onOpen(row.id)}>
        {(press) => (
          <Pressable {...press} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.pressed }]}>
            <Avatar name={row.student_name} />
            <View style={styles.text}>
              <Text weight="500" numberOfLines={1}>
                {row.student_name}
              </Text>
              {sub}
            </View>
            {active && !free && <LessonsLeft usage={usage?.[row.id]} />}
          </Pressable>
        )}
      </SwipeRow>
      {/* On the top edge of the row below: a line on a row's bottom edge can lose its last pixel row
          to the next row when heights fall between pixels, and the rule then vanishes. */}
      {!first && <View pointerEvents="none" style={[styles.separator, { backgroundColor: c.line }]} />}
    </View>
  )
}

/**
 * The child's page's message menu, for one row: the same reads that page makes, for this child
 * only, and the menu once they are in (or failed: the plain chat is still offered).
 */
function MessagePicker({ registration, activeUsage, onReady }: { registration: Registration; activeUsage: Usage | undefined; onReady: (items: MenuItem[]) => void }) {
  const active = registration.is_active === true
  // Archived children are not in the batch of active ones
  const own = useChildUsage(active ? undefined : registration)
  const items = useMessageItems(registration, active ? activeUsage : own.data)
  const templates = useTemplates()
  const catalog = useCatalog()
  const lessons = useChildLessons(registration.id)
  const settled = (query: { data?: unknown; isError: boolean }) => query.data !== undefined || query.isError
  const ready = settled(templates) && settled(catalog) && settled(lessons) && (active || settled(own))
  const done = useRef(false)
  useEffect(() => {
    if (!ready || done.current) return
    done.current = true
    onReady(items)
  }, [ready, items, onReady])
  return null
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  statusCover: { position: 'absolute', top: 0, left: 0, right: 0 },
  tools: { gap: 12, marginBottom: 14 },
  chipsScroll: { marginHorizontal: -16 },
  chips: { paddingHorizontal: 16, paddingVertical: 3, gap: 8 },
  count: { marginTop: 14 },
  // Card and Row of the kit: no edge, 26pt corners, rules across the content
  card: { overflow: 'hidden' },
  first: { borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 2 },
  last: { borderBottomLeftRadius: 26, borderBottomRightRadius: 26, paddingBottom: 2 },
  // Android softens the straight bottom edge of the rounded first row into a faint rule across the
  // card; the row below covers that edge by a point
  overlap: { marginBottom: -1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 18, paddingVertical: 11, minHeight: 64 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  left: { alignItems: 'flex-end', minWidth: 44, flexShrink: 0 },
  separator: { position: 'absolute', left: AVATAR_INSET, right: 16, top: 0, height: 1 }
})
