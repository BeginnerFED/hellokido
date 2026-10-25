import { Alert, StyleSheet, View } from 'react-native'
import { Stack } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { releaseSeats, remainingTone, setRegistrationActive, upcomingSeats, type Registration, type Usage } from '@hellokido/core/api'
import { beadsLabel, daysLeft, endText, ENDING_WINDOW_DAYS, formatPeriod, isEnding, isFree, remainingText } from '@hellokido/core/view'
import { keys, useActiveUsage, useChildUsage, useLabels, useRefresh, useRegistrations } from '../../data/queries'
import { headerMenu, tasks } from '../../lib/navigation'
import { useI18n } from '../../providers/I18n'
import { useColors } from '../../theme/colors'
import { useActionMenu, type MenuItem } from '../../ui/ActionMenu'
import { EmptyState, LoadError, Notice, Skeleton } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { displayPhone, PhoneActions } from '../../ui/PhoneActions'
import { Card, Screen, Section } from '../../ui/Screen'
import { BeadString } from '../../ui/signature'
import { DOT, Text } from '../../ui/Text'
import { useToast } from '../../ui/Toast'
import { ChildLessons } from './ChildLessons'
import { MessageHistory, useMessageItems } from './ChildMessages'
import { ChildPayments } from './ChildPayments'

/** One child: who to call, where the package stands, every payment and every lesson. */
export function ChildDetailScreen({ id }: { id: string }) {
  const { t } = useI18n()
  const client = useQueryClient()
  const registrations = useRegistrations()
  const registration = registrations.data?.find((row) => row.id === id)

  const refresh = () =>
    Promise.all([
      registrations.refetch(),
      client.invalidateQueries({ queryKey: ['usage'] }),
      client.invalidateQueries({ queryKey: keys.history(id) }),
      client.invalidateQueries({ queryKey: keys.childEntries(id) }),
      client.invalidateQueries({ queryKey: keys.childLessons(id) })
    ])

  if (registrations.isError) {
    return (
      <Screen>
        <LoadError message={t.children.loadFailed} retryLabel={t.common.retry} onRetry={() => void registrations.refetch()} />
      </Screen>
    )
  }
  if (!registrations.data) {
    return (
      <Screen>
        {/* The page's own shapes: the parent's card, the payment pill, the package card */}
        <View style={styles.waiting}>
          <Skeleton height={16} width="30%" radius={6} style={styles.summary} />
          <Skeleton height={66} radius={18} />
          <Skeleton height={50} radius={25} />
          <Skeleton height={190} radius={18} style={styles.later} />
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
          <EmptyState icon="info" title={t.mobile.childMissing} />
        </Screen>
      </>
    )
  }
  return <ChildPage key={registration.id} registration={registration} onRefresh={refresh} />
}

function ChildPage({ registration, onRefresh }: { registration: Registration; onRefresh: () => Promise<unknown> }) {
  const c = useColors()
  const { t, fmt, plural } = useI18n()
  const toast = useToast()
  const refresh = useRefresh()
  const menu = useActionMenu()
  const active = registration.is_active === true
  const activeUsage = useActiveUsage().data?.[registration.id]
  // Archived children are not in the batch of active ones
  const ownUsage = useChildUsage(active ? undefined : registration).data
  const usage = active ? activeUsage : ownUsage
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

  return (
    <>
      <Stack.Screen
        options={{
          title: name,
          // Options merge: an archived child has to take the menu away, not only leave it out
          ...(active ? headerMenu(c, more, items, (list) => menu.open(more, list), 'more') : { headerRight: undefined, unstable_headerRightItems: undefined })
        }}
      />
      {menu.element}
      <Screen onRefresh={onRefresh}>
        <View style={styles.top}>
          {registration.student_age ? (
            <Text variant="callout" tone="ink2" style={styles.summary}>
              {registration.student_age}
            </Text>
          ) : null}
          <Card>
            <View style={styles.parent}>
              <View style={styles.flex}>
                {/* The one place the parent's whole name is read: a long one takes a second line */}
                <Text variant="body" weight="500" numberOfLines={2}>
                  {registration.parent_name}
                </Text>
                <Text variant="foot" tone="ink2" tabular selectable>
                  {t.children.detail.parent}{DOT}{displayPhone(registration.parent_phone)}
                </Text>
              </View>
              <PhoneActions
                phone={registration.parent_phone}
                whatsAppLabel={fmt(t.messages.send.label, { name })}
                onWhatsApp={() => menu.open(t.messages.send.button, messages, t.messages.send.menuHint)}
              />
            </View>
          </Card>
          {active ? (
            <Button variant="primary" size="lg" icon="money" onPress={() => tasks.payment({ registrationId: registration.id })}>
              {t.children.detail.actions.takePayment}
            </Button>
          ) : (
            <View style={styles.archived}>
              <Notice>{t.children.detail.archivedNote}</Notice>
              <Button icon="unarchive" onPress={activate} style={styles.start}>
                {t.children.detail.actions.activate}
              </Button>
            </View>
          )}
        </View>

        <PackageSection registration={registration} usage={usage} />

        {registration.notes?.trim() ? (
          <Section title={t.children.detail.notesTitle}>
            <Card>
              <Text variant="sub" tone="ink2" selectable style={styles.notes}>
                {registration.notes}
              </Text>
            </Card>
          </Section>
        ) : null}

        <ChildPayments registration={registration} />
        <ChildLessons registration={registration} />
        <MessageHistory registration={registration} />
      </Screen>
    </>
  )
}

function PackageSection({ registration, usage }: { registration: Registration; usage: Usage | undefined }) {
  const c = useColors()
  const i18n = useI18n()
  const { t, fmt, plural } = i18n
  const labels = useLabels()
  const free = isFree(registration)
  const active = registration.is_active === true
  const days = daysLeft(registration)
  const pending = !free && registration.payment_status === 'beklemede'
  const tone = remainingTone(usage)
  const renewable = active && !free && !pending && (isEnding(registration) || tone === 'out')
  const soon = days !== null && days <= ENDING_WINDOW_DAYS

  const counts = usage
    ? [
        usage.attended > 0 && plural(t.children.detail.attended, usage.attended),
        usage.noShow > 0 && plural(t.children.detail.absent, usage.noShow),
        usage.scheduled - usage.unmarkedPast > 0 && plural(t.children.detail.booked, usage.scheduled - usage.unmarkedPast)
      ].filter((line): line is string => Boolean(line))
    : []
  const extras = usage
    ? [
        usage.carried > 0 && plural(t.children.detail.carried, usage.carried),
        usage.earlierPaymentLessons > 0 && fmt(t.children.detail.earlier, { total: usage.packageTotal ?? 0 }),
        usage.extra > 0 && plural(t.children.detail.extra, usage.extra)
      ].filter((line): line is string => Boolean(line))
    : []

  return (
    <Section title={t.children.detail.packageTitle}>
      <Card>
        <View style={styles.package}>
          <View>
            <Text variant="body" weight="600">
              {labels.packageName(registration.package_type)}
            </Text>
            <Text variant="foot" tone="ink2" tabular>
              {free ? t.children.detail.unlimited : formatPeriod(i18n, registration.package_start_date, registration.package_end_date)}
              {active && days !== null && (
                <Text variant="foot" weight={soon ? '600' : '400'} tone={soon ? 'actionInk' : 'ink3'}>
                  {DOT}
                  {endText(i18n, days)}
                </Text>
              )}
            </Text>
          </View>

          {!usage ? (
            <Skeleton height={72} />
          ) : free ? (
            <Text variant="sub" tone="ink2">
              {fmt(t.children.detail.freeUsage, { count: usage.attended })}
            </Text>
          ) : (
            <View style={styles.usage}>
              <Text variant="title" weight="600" tone={tone === 'out' || tone === 'low' ? 'actionInk' : 'ink'} tabular>
                {remainingText(i18n, usage)}
              </Text>
              <BeadString usage={usage} size="lg" label={beadsLabel(i18n, usage)} />
              {counts.length > 0 && (
                <Text variant="foot" tone="ink2">
                  {counts.join(DOT)}
                </Text>
              )}
              {extras.map((line) => (
                <Text key={line} variant="foot" tone="ink3">
                  {line}
                </Text>
              ))}
            </View>
          )}

          {usage && usage.unmarkedPast > 0 && <Notice tone="action">{plural(t.children.detail.unmarked, usage.unmarkedPast)}</Notice>}

          {pending && (
            <View style={[styles.pending, { backgroundColor: c.actionWash, borderColor: c.actionLine }]}>
              <Text variant="foot" tone="actionInk" style={styles.flex}>
                {t.children.detail.pendingLine}
              </Text>
              {active && (
                <Button size="sm" onPress={() => tasks.payment({ registrationId: registration.id, choice: 'collect' })}>
                  {t.children.detail.collect}
                </Button>
              )}
            </View>
          )}

          {renewable && (
            <Button variant="plain" size="sm" icon="refresh" onPress={() => tasks.payment({ registrationId: registration.id, choice: 'renew' })} style={styles.start}>
              {t.children.detail.actions.renew}
            </Button>
          )}
        </View>
      </Card>
    </Section>
  )
}

const styles = StyleSheet.create({
  waiting: { gap: 12 },
  later: { marginTop: 18 },
  top: { gap: 12 },
  summary: { marginHorizontal: 4, marginTop: -2 },
  flex: { flex: 1, minWidth: 0 },
  parent: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 12, paddingVertical: 12 },
  archived: { gap: 12 },
  start: { alignSelf: 'flex-start' },
  notes: { paddingHorizontal: 16, paddingVertical: 12 },
  package: { padding: 16, gap: 14 },
  usage: { gap: 8 },
  // Outlined like the kit's Notice, so the two amber lines of the card read as one kind
  pending: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 8, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 }
})
