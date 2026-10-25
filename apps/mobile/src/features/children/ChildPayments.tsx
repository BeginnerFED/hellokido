import { useState } from 'react'
import { Alert, Pressable, StyleSheet, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import { deleteIncomeEntry, deleteLastExtension, startsNewPeriod, type IncomeEntry, type Registration, type ResolvedExtension } from '@hellokido/core/api'
import { FREE, formatPeriod, isFree, shortDate } from '@hellokido/core/view'
import { useChildEntries, useHistory, useLabels, useRefresh } from '../../data/queries'
import { tasks } from '../../lib/navigation'
import { useI18n } from '../../providers/I18n'
import { useColors } from '../../theme/colors'
import { useActionMenu, type MenuItem } from '../../ui/ActionMenu'
import { LoadError, Mark, Skeleton } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { Icon } from '../../ui/Icon'
import { Card, Section } from '../../ui/Screen'
import { Text } from '../../ui/Text'
import { useToast } from '../../ui/Toast'

/** The latest payments tell what matters now; years of monthly renewals wait behind a button. */
const FIRST = 4
const STEP = 10

type Line = {
  key: string
  title: string
  meta: string
  amount: number
  state: 'paid' | 'pending' | 'free'
  /** How and when a received payment came in: "Card · 12 Oct" */
  paid: string
  created: number
  actions?: MenuItem[]
  collect?: () => void
}

/**
 * Every payment of the child in one list, newest first: the first registration, each later
 * payment (a new period or an instalment) and extra fees. Only the latest package payment can be
 * corrected or undone, which keeps the ledger and the lesson counts in step. A line with things to
 * do opens them in the phone's action sheet.
 */
export function ChildPayments({ registration }: { registration: Registration }) {
  const c = useColors()
  const i18n = useI18n()
  const { t, fmt, plural, money } = i18n
  const labels = useLabels()
  const toast = useToast()
  const refresh = useRefresh()
  const menu = useActionMenu()
  const history = useHistory(registration.id)
  const entries = useChildEntries(registration.id)
  const [shown, setShown] = useState(FIRST)
  const [busy, setBusy] = useState(false)

  const paidLine = (method: string | null | undefined, date: string | null | undefined) =>
    [method && method !== 'belirlenmedi' ? (t.finance.methodShort[method] ?? labels.method(method)) : '', date ? shortDate(i18n, date) : '']
      .filter(Boolean)
      .join(' · ')

  const undo = async (extension: ResolvedExtension) => {
    if (busy) return
    setBusy(true)
    try {
      await deleteLastExtension(extension.id)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      toast({ title: t.children.undo.done })
      refresh.children(registration.id)
    } catch {
      toast({ tone: 'error', title: t.children.undo.failed })
    } finally {
      setBusy(false)
    }
  }
  const askUndo = (extension: ResolvedExtension) =>
    Alert.alert(t.children.undo.title, fmt(t.children.undo.body, { amount: money(extension.payment_amount) }), [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.children.undo.confirm, style: 'destructive', onPress: () => void undo(extension) }
    ])

  const remove = async (entry: IncomeEntry) => {
    if (busy) return
    setBusy(true)
    try {
      const found = await deleteIncomeEntry(entry.id)
      toast(found ? { title: t.finance.entry.deleted } : { tone: 'warning', title: t.finance.entry.notFound })
      refresh.finance(registration.id)
    } catch {
      toast({ tone: 'error', title: t.finance.entry.deleteFailed })
    } finally {
      setBusy(false)
    }
  }
  const askRemove = (entry: IncomeEntry) =>
    Alert.alert(t.finance.entry.deleteTitle, fmt(t.finance.entry.deleteBody, { amount: money(entry.amount) }), [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.finance.entry.deleteConfirm, style: 'destructive', onPress: () => void remove(entry) }
    ])

  const lines: Line[] = []
  const data = history.data
  if (data) {
    const fresh = data.registration
    const { extensions, initialPayment } = data
    const last = extensions[extensions.length - 1]
    const initialType = fresh.initial_package_type ?? fresh.package_type
    const initialFree = initialType === FREE
    lines.push({
      key: 'initial',
      title: t.children.detail.initial,
      meta: [labels.packageName(initialType), initialFree ? '' : formatPeriod(i18n, fresh.initial_start_date, fresh.initial_end_date)].filter(Boolean).join(' · '),
      amount: Number(initialPayment?.amount ?? fresh.initial_payment_amount ?? 0),
      state: initialFree ? 'free' : extensions.length === 0 && fresh.payment_status === 'beklemede' ? 'pending' : 'paid',
      paid: paidLine(initialPayment?.payment_method ?? fresh.initial_payment_method, initialPayment?.payment_date),
      created: new Date(fresh.created_at ?? 0).getTime()
    })
    extensions.forEach((extension, index) => {
      // Older rows did not keep the start of the period they closed: it is the start the row before opened
      const before = index === 0 ? fresh.initial_start_date : (extensions[index - 1].new_start_date ?? extensions[index - 1].previous_end_date)
      const previousStart = extension.previous_start_date ?? before
      // Rows from before start dates were stored always began a new period
      const renews = !extension.new_start_date || startsNewPeriod(previousStart, new Date(extension.new_start_date))
      // Never another child's payment; free participation has nothing to correct
      const editable = extension === last && extension.registration_id === fresh.id && !isFree(fresh)
      lines.push({
        key: extension.id,
        title: renews ? t.children.payment.renew : t.children.payment.instalment,
        meta: [labels.packageName(extension.new_package_type), formatPeriod(i18n, extension.new_start_date ?? extension.previous_end_date, extension.new_end_date)]
          .filter(Boolean)
          .join(' · '),
        amount: Number(extension.payment_amount ?? 0),
        state: extension.payment_status === 'beklemede' ? 'pending' : 'paid',
        paid: paidLine(extension.payment_method, extension.payment_date),
        created: new Date(extension.created_at ?? 0).getTime(),
        actions: editable
          ? [
              { label: t.children.detail.editLast, icon: 'edit', onPress: () => tasks.extensionEdit(fresh.id) },
              { label: t.children.detail.undoLast, icon: 'undo', destructive: true, onPress: () => askUndo(extension) }
            ]
          : undefined
      })
    })
  }
  for (const entry of entries.data ?? []) {
    const pending = entry.payment_status === 'beklemede'
    const due = pending && entry.due_date ? fmt(t.children.detail.dueOn, { date: shortDate(i18n, `${entry.due_date}T00:00:00`) }) : ''
    lines.push({
      key: entry.id,
      title: entry.description || t.children.detail.fee,
      meta: [entry.description ? t.children.detail.fee : '', due].filter(Boolean).join(' · '),
      amount: Number(entry.amount) || 0,
      state: pending ? 'pending' : 'paid',
      paid: paidLine(entry.payment_method, entry.payment_date),
      created: new Date(entry.created_at ?? 0).getTime(),
      collect: pending && registration.is_active === true ? () => tasks.payment({ registrationId: registration.id, choice: 'collect', entryId: entry.id }) : undefined,
      actions: [
        { label: t.common.edit, icon: 'edit', onPress: () => tasks.income({ id: entry.id }) },
        { label: t.common.delete, icon: 'delete', destructive: true, onPress: () => askRemove(entry) }
      ]
    })
  }
  lines.sort((a, b) => b.created - a.created)

  return (
    <Section title={t.children.detail.historyTitle}>
      {menu.element}
      {history.isError || entries.isError ? (
        <LoadError
          message={t.children.detail.historyFailed}
          retryLabel={t.common.retry}
          onRetry={() => {
            void history.refetch()
            void entries.refetch()
          }}
        />
      ) : !data || !entries.data ? (
        <View style={[styles.waiting, { backgroundColor: c.surface }]}>
          <Skeleton height={40} />
          <Skeleton height={40} />
        </View>
      ) : (
        <>
          <Card>
            {lines.slice(0, shown).map((line) => {
              const amountText = line.state === 'free' ? t.children.free : line.amount > 0 || line.state === 'paid' ? money(line.amount) : ''
              const body = (
                <>
                  <View style={styles.flex}>
                    <View style={styles.top}>
                      <Text variant="body" weight="500" numberOfLines={1} style={styles.flex}>
                        {line.title}
                      </Text>
                      <Text variant="body" weight={line.state === 'paid' ? '600' : '400'} tone={line.state === 'paid' ? 'ink' : 'ink3'} tabular>
                        {amountText}
                      </Text>
                    </View>
                    <View style={styles.bottom}>
                      <Text variant="foot" tone="ink3" style={styles.flex}>
                        {line.meta}
                      </Text>
                      {line.state === 'pending' ? (
                        <Mark tone="action">{labels.paymentStatus('beklemede')}</Mark>
                      ) : (
                        line.state === 'paid' &&
                        line.paid !== '' && (
                          <Text variant="foot" tone="ink3" tabular>
                            {line.paid}
                          </Text>
                        )
                      )}
                    </View>
                    {line.collect && (
                      <Button size="sm" onPress={line.collect} style={styles.collect}>
                        {t.children.detail.collect}
                      </Button>
                    )}
                  </View>
                  {line.actions && <Icon name="more" size={20} color={c.ink3} />}
                </>
              )
              const actions = line.actions
              return actions ? (
                <Pressable
                  key={line.key}
                  onPress={() => menu.open(line.title, actions)}
                  accessibilityRole="button"
                  accessibilityHint={t.mobile.paymentActions}
                  disabled={busy}
                  style={({ pressed }) => [styles.line, pressed && { backgroundColor: c.well }]}
                >
                  {body}
                </Pressable>
              ) : (
                <View key={line.key} style={styles.line}>
                  {body}
                </View>
              )
            })}
          </Card>
          {lines.length > shown && (
            <Button variant="plain" size="sm" onPress={() => setShown((count) => count + STEP)} style={styles.more}>
              {plural(t.children.detail.showMorePayments, Math.min(STEP, lines.length - shown))}
            </Button>
          )}
        </>
      )}
    </Section>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  waiting: { borderRadius: 16, padding: 16, gap: 12 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 16, paddingRight: 14, paddingVertical: 12 },
  top: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  bottom: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 2 },
  collect: { alignSelf: 'flex-start', marginTop: 10 },
  more: { alignSelf: 'flex-start', marginTop: 6, marginLeft: 4 }
})
