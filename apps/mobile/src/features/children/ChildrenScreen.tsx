import { useCallback, useMemo, useState } from 'react'
import { FlatList, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { Stack } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import type { Registration, UsageMap } from '@hellokido/core/api'
import { byName, daysLeft, endText, ENDING_WINDOW_DAYS, isEnding, isFree, isPaymentDue, isRunningLow, matchesChild } from '@hellokido/core/view'
import { useActiveUsage, useLabels, useRegistrations } from '../../data/queries'
import { headerButton, tasks, useOpenChild } from '../../lib/navigation'
import { useI18n } from '../../providers/I18n'
import { useColors } from '../../theme/colors'
import { useActionMenu } from '../../ui/ActionMenu'
import { EmptyState, ListSkeleton, LoadError, Mark } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { Chip, Segmented } from '../../ui/Fields'
import { Icon } from '../../ui/Icon'
import { OfflineNotice } from '../../ui/OfflineNotice'
import { usePullRefresh } from '../../ui/Screen'
import { Peg } from '../../ui/signature'
import { Text } from '../../ui/Text'
import { UsageLine } from '../../ui/UsageLine'
import { usePackageOptions } from '../payment/fields'

type ListView = 'active' | 'archived'
type Filter = 'pending' | 'low' | 'ending'
const ANY_PACKAGE = 'all'

const TESTS: Record<Filter, (row: Registration, usage: UsageMap | undefined) => boolean> = {
  pending: (row) => isPaymentDue(row),
  low: (row, usage) => !isFree(row) && isRunningLow(usage?.[row.id]),
  ending: (row) => isEnding(row)
}

/**
 * Every child, found by name, parent or phone from the search bar of the phone. The filters say how
 * many children each one leaves; a child opens on its own page and back returns to the same place.
 */
export function ChildrenScreen() {
  const c = useColors()
  const { t, plural } = useI18n()
  const labels = useLabels()
  const client = useQueryClient()
  const menu = useActionMenu()
  const registrations = useRegistrations()
  const usage = useActiveUsage().data
  const packageOrder = usePackageOptions({ includeFree: true })

  const [view, setView] = useState<ListView>('active')
  const [filter, setFilter] = useState<Filter | null>(null)
  const [pkg, setPkg] = useState<string>(ANY_PACKAGE)
  const [query, setQuery] = useState('')

  const rows = registrations.data
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
      ...packages.map(({ code, count: total }) => ({ label: `${labels.packageName(code)} · ${total}`, onPress: () => setPkg(code) }))
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

  const refresh = useCallback(async () => {
    await Promise.all([registrations.refetch(), client.invalidateQueries({ queryKey: ['usage'] })])
  }, [registrations, client])
  const pull = usePullRefresh(refresh)

  const header = (
    <View style={styles.header}>
      <OfflineNotice />
      <Segmented<ListView>
        options={[
          { id: 'active', label: t.children.views.active },
          { id: 'archived', label: t.children.views.archived }
        ]}
        value={view}
        onChange={changeView}
      />
      {/* One row that scrolls sideways, like the filters of the phone's own apps */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chips} accessibilityLabel={t.children.filters.label}>
        <Chip label={pkg === ANY_PACKAGE ? t.children.anyPackage : labels.packageName(pkg)} selected={pkg !== ANY_PACKAGE} onPress={choosePackage} menu />
        {view === 'active' &&
          filters.map((item) => (
            <Chip key={item.id} label={item.label} count={count(item.id)} selected={filter === item.id} onPress={() => setFilter(filter === item.id ? null : item.id)} />
          ))}
      </ScrollView>
      {rows && shown.length > 0 && (
        <Text variant="foot" tone="ink3" style={styles.count}>
          {plural(t.children.count, shown.length)}
        </Text>
      )}
    </View>
  )

  const empty = registrations.isError ? (
    <LoadError message={t.children.loadFailed} retryLabel={t.common.retry} onRetry={() => void registrations.refetch()} />
  ) : !rows ? (
    <ListSkeleton rows={8} />
  ) : rows.length === 0 ? (
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
    <EmptyState title={t.children.empty.archive} />
  ) : (
    <EmptyState
      icon={query.trim() ? 'search' : undefined}
      title={query.trim() ? t.children.empty.search : t.children.empty.filters}
      action={
        filter || pkg !== ANY_PACKAGE ? (
          <Button size="sm" onPress={clearFilters}>
            {t.common.clearFilters}
          </Button>
        ) : undefined
      }
    />
  )

  return (
    <>
      <Stack.Screen
        options={{
          ...headerButton(c, t.children.newRegistration, 'add', () => tasks.registration()),
          headerSearchBarOptions: {
            placeholder: t.children.searchPlaceholder,
            onChangeText: (event) => setQuery(event.nativeEvent.text),
            onCancelButtonPress: () => setQuery(''),
            onClose: () => setQuery(''),
            autoCapitalize: 'none',
            hideWhenScrolling: false,
            placement: 'stacked',
            tintColor: c.accentInk,
            textColor: c.ink,
            headerIconColor: c.ink2,
            hintTextColor: c.ink3
          }
        }}
      />
      {menu.element}
      <FlatList
        data={rows ? shown : []}
        keyExtractor={(row) => row.id}
        renderItem={({ item, index }) => <ChildRow row={item} usage={usage} first={index === 0} last={index === shown.length - 1} />}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        initialNumToRender={14}
        windowSize={11}
        style={{ backgroundColor: c.ground }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={c.ink3} colors={[c.accent]} />}
      />
    </>
  )
}

function ChildRow({ row, usage, first, last }: { row: Registration; usage: UsageMap | undefined; first: boolean; last: boolean }) {
  const c = useColors()
  const i18n = useI18n()
  const { t } = i18n
  const labels = useLabels()
  const openChild = useOpenChild()
  const active = row.is_active === true
  const free = isFree(row)
  const days = active ? daysLeft(row) : null
  const mark = !active ? null : isPaymentDue(row) ? (
    <Mark tone="action">{t.children.pendingPayment}</Mark>
  ) : days !== null && days <= ENDING_WINDOW_DAYS ? (
    <Mark tone={days < 0 ? 'action' : 'neutral'}>{endText(i18n, days)}</Mark>
  ) : null
  const corners = [first && styles.first, last && styles.last]

  return (
    <View style={[{ backgroundColor: c.surface }, corners]}>
      <Pressable
        onPress={() => openChild(row.id)}
        accessibilityRole="button"
        style={({ pressed }) => [styles.row, corners, pressed && { backgroundColor: c.well }]}
      >
        <Peg seat={{ id: row.id, name: row.student_name, status: 'scheduled' }} size="md" />
        <View style={styles.text}>
          <View style={styles.nameLine}>
            <Text variant="body" weight="500" numberOfLines={1} style={styles.name}>
              {row.student_name}
            </Text>
            {mark}
          </View>
          {active && !free && <UsageLine usage={usage?.[row.id]} />}
          <Text variant="foot" tone="ink3" numberOfLines={1}>
            {labels.packageName(row.package_type)} · {row.parent_name}
          </Text>
        </View>
        <Icon name="chevronRight" size={13} color={c.ink3} weight="semibold" />
      </Pressable>
      {/* On the top edge of the row below: a line on a row's bottom edge can lose its last pixel row
          to the next row when heights fall between pixels, and a hairline then vanishes. */}
      {!first && <View pointerEvents="none" style={[styles.separator, { backgroundColor: c.line }]} />}
    </View>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 4 : 10, paddingBottom: 40 },
  header: { gap: 12, marginBottom: 10 },
  chipsScroll: { marginHorizontal: -16 },
  chips: { paddingHorizontal: 16, paddingVertical: 3, gap: 8 },
  count: { paddingHorizontal: 4, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 14, paddingVertical: 11, minHeight: 64 },
  first: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  last: { borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  text: { flex: 1, minWidth: 0, gap: 3 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flexShrink: 1 },
  separator: { position: 'absolute', left: 60, right: 0, top: 0, height: StyleSheet.hairlineWidth }
})
