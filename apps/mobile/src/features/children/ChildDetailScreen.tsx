import { useEffect, useState, type ReactNode } from 'react'
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native'
import { Stack } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { releaseSeats, remainingTone, setRegistrationActive, upcomingSeats, type Registration, type Usage } from '@hellokido/core/api'
import { phoneDigits, whatsAppLink } from '@hellokido/core/rules/phone.js'
import { beadsLabel, isFree, lessonsLeftText, needsRenewal, packageStartText } from '@hellokido/core/view'
import { keys, useActiveUsage, useChildUsage, useLabels, useRefresh, useRegistrations } from '../../data/queries'
import { headerMenu, tasks } from '../../lib/navigation'
import { useI18n } from '../../providers/I18n'
import { useColors } from '../../theme/colors'
import { useActionMenu, type MenuItem } from '../../ui/ActionMenu'
import { EmptyState, initialsOf, LoadError, Mark, Notice, Skeleton } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { displayPhone } from '../../ui/PhoneActions'
import { Card, Screen, Section } from '../../ui/Screen'
import { BeadLegend, Beads } from '../../ui/signature'
import { Text } from '../../ui/Text'
import { useToast } from '../../ui/Toast'
import { usePackagePrice } from '../payment/fields'
import { ChildLessons } from './ChildLessons'
import { MessageHistory, useMessageItems } from './ChildMessages'
import { ChildPayments } from './ChildPayments'
import { QuickActions, type QuickAction } from './parts'

/** One child: who to call, where the package stands, every payment and every lesson. */
export function ChildDetailScreen({ id }: { id: string }) {
  const { t } = useI18n()
  const client = useQueryClient()
  const registrations = useRegistrations()
  const registration = registrations.data?.find((row) => row.id === id)
  // A child saved a moment ago may not be in the list yet: the list is read once more before the
  // page says the child is missing, and the page keeps its loading shapes meanwhile
  const [recheck, setRecheck] = useState<'idle' | 'running' | 'done'>('idle')
  const { data, isFetching, refetch } = registrations
  useEffect(() => {
    if (!data || registration || isFetching || recheck !== 'idle') return
    setRecheck('running')
    void refetch().finally(() => setRecheck('done'))
  }, [data, registration, isFetching, recheck, refetch])

  const refresh = () =>
    Promise.all([
      registrations.refetch(),
      client.invalidateQueries({ queryKey: ['usage'] }),
      client.invalidateQueries({ queryKey: keys.history(id) }),
      client.invalidateQueries({ queryKey: keys.childEntries(id) }),
      client.invalidateQueries({ queryKey: keys.childLessons(id) })
    ])

  if (registrations.isError && !registration) {
    return (
      <Screen>
        <LoadError message={t.children.loadFailed} retryLabel={t.common.retry} onRetry={() => void registrations.refetch()} />
      </Screen>
    )
  }
  if (!registration && (!data || isFetching || recheck !== 'done')) {
    return (
      <Screen>
        {/* The page's own shapes: the monogram and name, the three buttons, the package and parent cards */}
        <View style={styles.top}>
          <View style={styles.who}>
            <Skeleton height={68} width={68} radius={34} />
            <View style={styles.whoWords}>
              <Skeleton height={26} width="70%" />
              <Skeleton height={14} width="50%" style={styles.whoLine} />
            </View>
          </View>
          <View style={styles.waitingButtons}>
            {[0, 1, 2].map((key) => (
              <View key={key} style={styles.flex}>
                <Skeleton height={44} radius={22} />
              </View>
            ))}
          </View>
          <Skeleton height={200} radius={26} style={styles.packageGap} />
          <Skeleton height={104} radius={26} />
        </View>
      </Screen>
    )
  }
  if (!registration) {
    return (
      <>
        {/* The page may have shown the child a moment ago: its name and menu go with it */}
        <Stack.Screen options={{ title: '', headerLargeTitleEnabled: false, headerRight: undefined, unstable_headerRightItems: undefined }} />
        <Screen>
          <Card padded>
            <EmptyState icon="info" title={t.mobile.childMissing} />
          </Card>
        </Screen>
      </>
    )
  }
  return <ChildPage key={registration.id} registration={registration} onRefresh={refresh} />
}

/** The child's initials on a 68pt circle of sky felt, as on a contact card. */
function Monogram({ name }: { name: string }) {
  const c = useColors()
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.monogram, { backgroundColor: c.skyFelt }]}>
      <Text weight="600" maxFontSizeMultiplier={1.15} style={[styles.monogramText, { color: c.skyInk }]}>
        {initialsOf(name)}
      </Text>
    </View>
  )
}

function ChildPage({ registration, onRefresh }: { registration: Registration; onRefresh: () => Promise<unknown> }) {
  const c = useColors()
  const { t, fmt, plural } = useI18n()
  const toast = useToast()
  const refresh = useRefresh()
  const menu = useActionMenu()
  const active = registration.is_active === true
  const activeUsage = useActiveUsage()
  // Archived children are not in the batch of active ones
  const ownUsage = useChildUsage(active ? undefined : registration)
  const usage = active ? activeUsage.data?.[registration.id] : ownUsage.data
  const usageQuery = active ? activeUsage : ownUsage
  const name = registration.student_name
  const messages = useMessageItems(registration, usage)

  /**
   * Archiving hides the child from every list but keeps payments and lessons. Seats it still holds
   * in lessons that have not happened can be freed at the same time.
   */
  const archive = async () => {
    // If the seats cannot be read the question is left out and archiving works as before
    const seats = await upcomingSeats(registration.id).catch(() => [] as string[])
    const run = async (release: boolean) => {
      try {
        await setRegistrationActive(registration.id, false)
      } catch {
        toast({ tone: 'error', title: t.children.archive.failed })
        return
      }
      let seatsFreed = true
      if (release && seats.length > 0) {
        try {
          await releaseSeats(seats)
        } catch {
          seatsFreed = false
        }
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      refresh.children(registration.id)
      toast(seatsFreed ? { title: fmt(t.children.archive.done, { name }) } : { tone: 'warning', title: fmt(t.children.archive.seatsFailed, { name }) })
    }
    const title = fmt(t.children.archive.title, { name })
    if (seats.length === 0) {
      Alert.alert(title, t.children.archive.body, [
        { text: t.common.cancel, style: 'cancel' },
        { text: t.children.archive.confirm, onPress: () => void run(false) }
      ])
      return
    }
    Alert.alert(title, `${t.children.archive.body}\n\n${plural(t.mobile.archiveSeats, seats.length)} ${t.mobile.archiveReleaseHint}`, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.mobile.archiveOnly, onPress: () => void run(false) },
      { text: t.mobile.archiveRelease, style: 'default', onPress: () => void run(true) }
    ])
  }

  const activate = () =>
    Alert.alert(fmt(t.children.archive.activateTitle, { name }), t.children.archive.activateBody, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.children.archive.activateConfirm,
        onPress: async () => {
          try {
            await setRegistrationActive(registration.id, true)
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            refresh.children(registration.id)
            toast({ title: fmt(t.children.archive.activated, { name }) })
          } catch {
            toast({ tone: 'error', title: t.children.archive.activateFailed })
          }
        }
      }
    ])

  const more = t.children.detail.actions.more
  const items: MenuItem[] = [
    { label: t.children.detail.actions.edit, icon: 'edit', onPress: () => tasks.registration({ id: registration.id }) },
    { label: t.children.detail.actions.addFee, icon: 'receipt', onPress: () => tasks.payment({ registrationId: registration.id, choice: 'fee' }) },
    { label: t.children.detail.actions.archive, icon: 'archive', onPress: () => void archive() }
  ]

  // Call and WhatsApp only when the number can be dialled, or read as international
  const digits = phoneDigits(registration.parent_phone)
  const phone = displayPhone(registration.parent_phone)
  const call = () => void Linking.openURL(`tel:${digits}`).catch(() => undefined)
  const offered: (QuickAction | null)[] = [
    digits ? { key: 'call', label: t.children.phone.call, icon: 'call', onPress: call, accessibilityLabel: t.children.detail.callParent } : null,
    whatsAppLink(registration.parent_phone)
      ? {
          key: 'chat',
          label: t.mobile.messageShort,
          icon: 'chat',
          onPress: () => menu.open(t.messages.send.button, messages, t.messages.send.menuHint),
          accessibilityLabel: fmt(t.messages.send.label, { name })
        }
      : null,
    active
      ? {
          key: 'pay',
          label: t.children.phone.pay,
          icon: 'lira',
          primary: true,
          onPress: () => tasks.payment({ registrationId: registration.id }),
          accessibilityLabel: t.children.detail.actions.takePayment
        }
      : { key: 'activate', label: t.children.phone.unarchive, icon: 'unarchive', primary: true, onPress: activate, accessibilityLabel: t.children.detail.actions.activate }
  ]
  const quick = offered.filter((item): item is QuickAction => item !== null)

  const who = [registration.student_age?.trim(), registration.parent_name ? fmt(t.children.phone.parentOf, { name: registration.parent_name }) : '']
    .filter(Boolean)
    .join(' · ')

  return (
    <>
      <Stack.Screen
        options={{
          // The name stands large on the page, as on a contact card; the bar keeps only its buttons
          title: '',
          // Options merge: an archived child has to take the menu away, not only leave it out
          ...(active ? headerMenu(c, more, items, (list) => menu.open(more, list), 'more') : { headerRight: undefined, unstable_headerRightItems: undefined })
        }}
      />
      {menu.element}
      <Screen onRefresh={onRefresh}>
        <View style={styles.top}>
          <View style={styles.who}>
            <Monogram name={name} />
            <View style={styles.whoWords}>
              <Text variant="title" numberOfLines={2} accessibilityRole="header">
                {name}
              </Text>
              {who ? (
                <Text tone="ink2" numberOfLines={2} style={styles.whoSub}>
                  {who}
                </Text>
              ) : null}
              {!active && (
                <View style={styles.whoLine}>
                  <Mark tone="neutral">{t.common.archived}</Mark>
                </View>
              )}
            </View>
          </View>
          {!active && <Notice style={styles.archivedNote}>{t.children.detail.archivedNote}</Notice>}
          <QuickActions items={quick} />

          <View style={styles.cards}>
            <PackageCard
              registration={registration}
              usage={usage}
              failed={usageQuery.isError && !usage}
              onRetry={() => void usageQuery.refetch()}
            />
            {/* The one place the parent's whole name is read: a long one takes a second line */}
            <Card>
              <View style={styles.pair}>
                <Text tone="ink3" style={styles.pairLabel}>
                  {t.children.detail.parent}
                </Text>
                <Text weight="500" numberOfLines={2} selectable align="right" style={styles.pairValue}>
                  {registration.parent_name}
                </Text>
              </View>
              {digits ? (
                <Pressable
                  onPress={call}
                  accessibilityRole="button"
                  accessibilityLabel={`${t.children.detail.callParent}, ${phone}`}
                  style={({ pressed }) => [styles.pair, pressed && { backgroundColor: c.pressed }]}
                >
                  <Text tone="ink3" style={styles.pairLabel}>
                    {t.common.phone}
                  </Text>
                  <Text weight="500" tone="accentInk" tabular numberOfLines={1} style={styles.pairValue} align="right">
                    {phone}
                  </Text>
                </Pressable>
              ) : null}
            </Card>
          </View>
        </View>

        {registration.notes?.trim() ? (
          <Section title={t.children.detail.notesTitle}>
            <Card padded>
              <Text variant="body" selectable>
                {registration.notes}
              </Text>
            </Card>
          </Section>
        ) : null}

        <ChildLessons registration={registration} part="upcoming" />
        <ChildPayments registration={registration} />
        <ChildLessons registration={registration} part="past" />
        <MessageHistory registration={registration} />
      </Screen>
    </>
  )
}

/** A line of the package card under a rule: what is the matter at the left, its one button at the right. */
function CardLine({ children, action }: { children: ReactNode; action?: ReactNode }) {
  const c = useColors()
  return (
    <View style={[styles.line, { borderTopColor: c.line }]}>
      <View style={styles.lineWords}>{children}</View>
      {action}
    </View>
  )
}

/**
 * The package as a felt card: its name and weeks, the lessons left as a big figure, one bead per
 * lesson with its key, and under a rule what waits: an unpaid period, forgotten attendance, a renewal.
 */
function PackageCard({ registration, usage, failed, onRetry }: { registration: Registration; usage: Usage | undefined; failed: boolean; onRetry: () => void }) {
  const c = useColors()
  const i18n = useI18n()
  const { t, fmt, plural, money } = i18n
  const labels = useLabels()
  const price = usePackagePrice(registration.package_type)
  const free = isFree(registration)
  const active = registration.is_active === true
  const pending = !free && registration.payment_status === 'beklemede'
  const tone = remainingTone(usage)
  const out = tone === 'out'
  // A renewal, offered once the lessons run low or out: the period's last day does not end a package
  const ending = needsRenewal(registration, usage)

  const extras = usage
    ? [
        usage.carried > 0 && plural(t.children.detail.carried, usage.carried),
        usage.earlierPaymentLessons > 0 && fmt(t.children.detail.earlier, { total: usage.packageTotal ?? 0 }),
        usage.extra > 0 && plural(t.children.detail.extra, usage.extra)
      ].filter((line): line is string => Boolean(line))
    : []

  let body: ReactNode
  if (failed) {
    body = (
      <View style={styles.usageGap}>
        <LoadError message={t.children.phone.usageFailed} retryLabel={t.common.retry} onRetry={onRetry} />
      </View>
    )
  } else if (!usage) {
    // The figure, the beads and their key
    body = (
      <View style={styles.usageGap}>
        <Skeleton height={44} width={120} />
        <Skeleton height={26} radius={13} style={styles.beads} />
        <Skeleton height={14} width="60%" style={styles.legend} />
      </View>
    )
  } else if (free) {
    body = (
      <Text variant="sub" tone="ink2" style={styles.usageGap}>
        {fmt(t.children.detail.freeUsage, { count: usage.attended })}
      </Text>
    )
  } else {
    const remaining = Math.max(usage.remaining ?? 0, 0)
    // Every lesson of the package is a bead: those used, those booked, those still to book
    const planned = Math.min(Math.max(usage.scheduled, 0), remaining)
    const open = remaining - planned
    body = (
      <>
        <View style={styles.count}>
          <Text variant="bigCount" tabular tone={tone === 'low' || out ? 'amberInk' : 'ink'}>
            {remaining}
          </Text>
          <Text tone="ink2" style={styles.countWords}>
            {plural(t.children.phone.leftUnit, remaining)}
          </Text>
        </View>
        <Beads attended={usage.attended} absent={usage.noShow} planned={planned} open={open} perRow={12} label={beadsLabel(i18n, usage)} style={styles.beads} />
        <View style={styles.legend}>
          <BeadLegend
            attended={plural(t.children.detail.attended, usage.attended)}
            absent={plural(t.children.detail.absent, usage.noShow)}
            planned={plural(t.children.detail.booked, planned)}
            open={open > 0 ? plural(t.children.phone.unbooked, open) : undefined}
          />
        </View>
        {extras.map((line) => (
          <Text key={line} variant="sub" tone="ink3" style={styles.extra}>
            {line}
          </Text>
        ))}
      </>
    )
  }

  return (
    <Card padded>
      <View style={styles.head}>
        <Text weight="600" numberOfLines={2} style={styles.flex}>
          {labels.packageName(registration.package_type)}
        </Text>
        <Text variant="sub" tone="ink3" tabular numberOfLines={1}>
          {free ? t.children.detail.unlimited : packageStartText(i18n, registration.package_start_date, registration.package_type)}
        </Text>
      </View>
      {body}

      {pending && (
        <CardLine
          action={
            active ? (
              <Button size="sm" onPress={() => tasks.payment({ registrationId: registration.id, choice: 'collect' })}>
                {t.children.detail.collect}
              </Button>
            ) : undefined
          }
        >
          <Mark tone="action">{t.children.phone.unpaid}</Mark>
          {price ? (
            <Text variant="sub" tone="ink3" tabular style={styles.lineSub}>
              {fmt(t.children.form.suggestedPrice, { amount: money(price) })}
            </Text>
          ) : null}
        </CardLine>
      )}

      {usage && usage.unmarkedPast > 0 && (
        <CardLine>
          <View style={styles.note}>
            <View style={[styles.noteDot, { backgroundColor: c.amber }]} />
            <Text variant="sub" tone="amberInk" style={styles.flex}>
              {plural(t.children.detail.unmarked, usage.unmarkedPast)}
            </Text>
          </View>
        </CardLine>
      )}

      {ending && (
        <CardLine
          action={
            // A due payment comes first: a new period cannot open while one waits
            pending ? undefined : (
              <Button size="sm" accessibilityLabel={t.children.detail.actions.renew} onPress={() => tasks.payment({ registrationId: registration.id, choice: 'renew' })}>
                {t.today.ending.renew}
              </Button>
            )
          }
        >
          <Mark tone={out ? 'action' : 'neutral'}>{lessonsLeftText(i18n, Math.max(usage?.remaining ?? 0, 0))}</Mark>
        </CardLine>
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  top: { gap: 0 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 4, paddingTop: 2, paddingBottom: 18 },
  whoWords: { flex: 1, minWidth: 0 },
  whoSub: { fontSize: 15, lineHeight: 20, marginTop: 2 },
  whoLine: { marginTop: 6 },
  monogram: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  monogramText: { fontSize: 23, lineHeight: 28, letterSpacing: 0.2 },
  archivedNote: { marginBottom: 14 },
  waitingButtons: { flexDirection: 'row', gap: 8 },
  packageGap: { marginTop: 14, marginBottom: 12 },
  cards: { gap: 12, marginTop: 14 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  usageGap: { marginTop: 12 },
  count: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 10 },
  countWords: { fontSize: 17, lineHeight: 22, flexShrink: 1 },
  beads: { marginTop: 12 },
  legend: { marginTop: 10 },
  extra: { marginTop: 6 },
  line: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 8, marginTop: 14, paddingTop: 14, borderTopWidth: 1 },
  lineWords: { flexGrow: 1, flexShrink: 1, flexBasis: 170, minWidth: 0 },
  lineSub: { marginTop: 2 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  noteDot: { width: 7, height: 7, borderRadius: 4, marginTop: 6 },
  // A label at the left, its value at the right, as on the mock's parent card
  pair: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingHorizontal: 18, paddingVertical: 13, minHeight: 50 },
  pairLabel: { fontSize: 15, lineHeight: 20 },
  pairValue: { flexShrink: 1 }
})
