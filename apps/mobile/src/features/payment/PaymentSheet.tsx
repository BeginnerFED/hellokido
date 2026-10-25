import { useMemo, useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import { byName, isFree, matchesChild } from '@hellokido/core/view'
import { useActiveUsage, useChildEntries, useLabels, useRegistrations } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useColors } from '../../theme/colors'
import { Notice, Skeleton } from '../../ui/Bits'
import { SearchField } from '../../ui/Fields'
import { Icon, type IconName } from '../../ui/Icon'
import { Card, Row } from '../../ui/Screen'
import { SheetScreen } from '../../ui/Sheet'
import { Peg } from '../../ui/signature'
import { Text } from '../../ui/Text'
import { UsageLine } from '../../ui/UsageLine'
import type { FormState } from './fields'
import { CollectForm, ExtendForm, IncomeForm } from './forms'

const IDLE: FormState = { dirty: false, busy: false }

export type PaymentChoice = 'renew' | 'instalment' | 'collect' | 'fee'
export type PaymentParams = { registrationId?: string; choice?: PaymentChoice; entryId?: string }

type Choice = { id: string; title: string; hint: string; icon: IconName; action?: boolean }

/**
 * "Take a payment": pick the child, say what the money is for, fill in one short form. All four
 * paths live in one sheet, so going back to change the choice never closes it.
 */
export function PaymentSheet({ params }: { params: PaymentParams }) {
  const c = useColors()
  const { t, fmt, money, date } = useI18n()
  const labels = useLabels()
  const registrations = useRegistrations().data
  const usage = useActiveUsage().data
  const [childId, setChildId] = useState<string | null>(params.registrationId ?? null)
  const [choice, setChoice] = useState<PaymentChoice | null>(params.choice ?? null)
  const [entryId, setEntryId] = useState<string | null>(params.entryId ?? null)
  const [state, setState] = useState(IDLE)
  const [query, setQuery] = useState('')

  const row = registrations?.find((item) => item.id === childId) ?? null
  const entries = useChildEntries(childId ?? undefined).data
  const pendingEntries = (entries ?? []).filter((entry) => entry.payment_status === 'beklemede')
  const entry = pendingEntries.find((item) => item.id === entryId) ?? null
  const free = row ? isFree(row) : false
  const periodDue = Boolean(row && !free && row.payment_status === 'beklemede')

  // A choice that no longer fits (paid meanwhile, free child) falls back to the list of choices
  const usable =
    choice === 'fee' ||
    (choice === 'collect' && (entry || (periodDue && !entryId))) ||
    ((choice === 'renew' || choice === 'instalment') && row && !free && !periodDue)
  const waiting = (Boolean(params.registrationId) && !registrations) || (Boolean(entryId) && entries === undefined)
  const step: 'wait' | 'child' | 'choice' | 'form' = waiting ? 'wait' : !row ? 'child' : choice && usable ? 'form' : 'choice'

  const goBack = (to: 'choice' | 'child') => {
    setState(IDLE)
    setChoice(null)
    setEntryId(null)
    if (to === 'child') setChildId(null)
  }
  const requestBack = (to: 'choice' | 'child') => {
    if (!state.dirty) return goBack(to)
    Alert.alert(t.common.unsavedChanges, undefined, [
      { text: t.common.keepEditing, style: 'cancel' },
      { text: t.common.discard, style: 'destructive', onPress: () => goBack(to) }
    ])
  }
  // Back from the form returns to the choices; from the choices to the children, unless the sheet was opened for this child
  const back = step === 'form' ? () => requestBack('choice') : step === 'choice' && !params.registrationId ? () => requestBack('child') : undefined

  const active = useMemo(() => (registrations ?? []).filter((item) => item.is_active === true && matchesChild(item, query)).sort(byName), [registrations, query])

  const title =
    step !== 'form'
      ? t.children.payment.title
      : choice === 'renew'
        ? t.children.extend.renewTitle
        : choice === 'instalment'
          ? t.children.extend.instalmentTitle
          : choice === 'collect'
            ? t.children.collect.title
            : t.finance.entry.feeTitle

  const choices: Choice[] = []
  if (row) {
    if (periodDue) {
      choices.push({ id: 'collect', title: t.children.payment.collect, hint: `${labels.packageName(row.package_type)} · ${t.children.payment.collectHint}`, icon: 'money', action: true })
    }
    for (const item of pendingEntries) {
      const due = item.due_date ? ` · ${fmt(t.children.detail.dueOn, { date: date(`${item.due_date}T00:00:00`, { day: 'numeric', month: 'long' }) })}` : ''
      choices.push({
        id: `entry:${item.id}`,
        title: item.description || t.children.detail.fee,
        hint: fmt(t.children.payment.collectEntryHint, { amount: money(item.amount) }) + due,
        icon: 'money',
        action: true
      })
    }
    if (!free && !periodDue) {
      choices.push(
        { id: 'renew', title: t.children.payment.renew, hint: t.children.payment.renewHint, icon: 'refresh' },
        { id: 'instalment', title: t.children.payment.instalment, hint: t.children.payment.instalmentHint, icon: 'wallet' }
      )
    }
    choices.push({ id: 'fee', title: t.children.payment.fee, hint: t.children.payment.feeHint, icon: 'receipt' })
  }

  const choose = (id: string) => {
    void Haptics.selectionAsync()
    setState(IDLE)
    if (id.startsWith('entry:')) {
      setEntryId(id.slice(6))
      setChoice('collect')
    } else {
      setEntryId(null)
      setChoice(id as PaymentChoice)
    }
  }

  return (
    <SheetScreen title={title} subtitle={row?.student_name} dirty={state.dirty} busy={state.busy} onBack={back} backLabel={step === 'form' ? t.children.payment.change : undefined}>
      {step === 'wait' && (
        <View style={styles.stack}>
          <Skeleton height={64} radius={16} />
          <Skeleton height={52} radius={16} />
          <Skeleton height={52} radius={16} />
        </View>
      )}

      {step === 'child' && (
        <View style={styles.stack}>
          <SearchField value={query} onChange={setQuery} placeholder={t.children.payment.searchChild} label={t.children.payment.who} />
          {!registrations ? (
            <View style={styles.stack}>
              {[0, 1, 2, 3].map((key) => (
                <Skeleton key={key} height={52} radius={12} />
              ))}
            </View>
          ) : active.length === 0 ? (
            <Text variant="sub" tone="ink2" align="center" style={styles.empty}>
              {t.children.payment.noChildren}
            </Text>
          ) : (
            <Card inset={60}>
              {active.map((item) => (
                <Row
                  key={item.id}
                  leading={<Peg seat={{ id: item.id, name: item.student_name, status: 'scheduled' }} size="md" />}
                  title={item.student_name}
                  subtitle={`${labels.packageName(item.package_type)} · ${item.parent_name}`}
                  onPress={() => {
                    void Haptics.selectionAsync()
                    setChildId(item.id)
                  }}
                />
              ))}
            </Card>
          )}
        </View>
      )}

      {step === 'choice' && row && (
        <View style={styles.stack}>
          <Card>
            <Row
              leading={<Peg seat={{ id: row.id, name: row.student_name, status: 'scheduled' }} size="md" />}
              title={
                <Text variant="sub" tone="ink2" numberOfLines={1}>
                  {labels.packageName(row.package_type)}
                </Text>
              }
              subtitle={<UsageLine usage={usage?.[row.id]} />}
            />
          </Card>
          {free && <Notice>{t.children.payment.freeOnly}</Notice>}
          <View accessibilityLabel={t.children.payment.whatFor}>
            <Card inset={60}>
              {choices.map((item) => (
                <Row
                  key={item.id}
                  leading={
                    <View style={[styles.choiceIcon, { backgroundColor: item.action ? c.actionWash : c.accentWash2 }]}>
                      <Icon name={item.icon} size={18} color={item.action ? c.actionInk : c.accentInk} />
                    </View>
                  }
                  title={
                    <Text variant="body" weight="600" numberOfLines={2}>
                      {item.title}
                    </Text>
                  }
                  subtitle={
                    <Text variant="foot" tone="ink3">
                      {item.hint}
                    </Text>
                  }
                  onPress={() => choose(item.id)}
                  chevron
                />
              ))}
            </Card>
          </View>
          {periodDue && (
            <Text variant="foot" tone="ink3" style={styles.footnote}>
              {t.children.extend.pendingBlocked}
            </Text>
          )}
        </View>
      )}

      {step === 'form' && row && (choice === 'renew' || choice === 'instalment') && (
        <ExtendForm key={choice} registration={row} mode={choice} onStateChange={setState} />
      )}
      {step === 'form' && row && choice === 'collect' && <CollectForm key={entry?.id ?? 'period'} registration={row} entry={entry} onStateChange={setState} />}
      {step === 'form' && row && choice === 'fee' && <IncomeForm kind="child" registrationId={row.id} onStateChange={setState} />}
    </SheetScreen>
  )
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  empty: { paddingVertical: 28 },
  choiceIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  footnote: { paddingHorizontal: 4 }
})
