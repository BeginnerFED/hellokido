import { useMemo, useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import { byName, isFree, matchesChild } from '@hellokido/core/view'
import { useActiveUsage, useChildEntries, useLabels, useRegistrations } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import type { TileTone } from '../../theme/colors'
import { Avatar, AVATAR_INSET, EmptyState, ListSkeleton, Skeleton } from '../../ui/Bits'
import { SearchField } from '../../ui/Fields'
import type { IconName } from '../../ui/Icon'
import { Card, FormGroup, IconTile, Row, TILE_INSET } from '../../ui/Screen'
import { formAction, SheetScreen, type FormState } from '../../ui/Sheet'
import { DOT, Text } from '../../ui/Text'
import { UsageLine } from '../../ui/UsageLine'
import { CollectForm, ExtendForm, IncomeForm } from './forms'

const IDLE: FormState = { dirty: false, busy: false }

export type PaymentChoice = 'renew' | 'instalment' | 'collect' | 'fee'
export type PaymentParams = { registrationId?: string; choice?: PaymentChoice; entryId?: string }

// Each kind of payment keeps its colour, as Settings keeps one per kind of row; amber asks for action
type Choice = { id: string; title: string; hint: string; icon: IconName; tone: TileTone }

/**
 * "Take a payment": pick the child, say what the money is for, fill in one short form. All four
 * paths live in one sheet, so going back to change the choice never closes it.
 */
export function PaymentSheet({ params }: { params: PaymentParams }) {
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
      choices.push({ id: 'collect', title: t.children.payment.collect, hint: `${labels.packageName(row.package_type)}${DOT}${t.children.payment.collectHint}`, icon: 'lira', tone: 'orange' })
    }
    for (const item of pendingEntries) {
      const due = item.due_date ? `${DOT}${fmt(t.children.detail.dueOn, { date: date(`${item.due_date}T00:00:00`, { day: 'numeric', month: 'long' }) })}` : ''
      choices.push({
        id: `entry:${item.id}`,
        title: item.description || t.children.detail.fee,
        hint: fmt(t.children.payment.collectEntryHint, { amount: money(item.amount) }) + due,
        icon: 'lira',
        tone: 'orange'
      })
    }
    if (!free && !periodDue) {
      choices.push(
        { id: 'renew', title: t.children.payment.renew, hint: t.children.payment.renewHint, icon: 'renew', tone: 'blue' },
        { id: 'instalment', title: t.children.payment.instalment, hint: t.children.payment.instalmentHint, icon: 'wallet', tone: 'green' }
      )
    }
    choices.push({ id: 'fee', title: t.children.payment.fee, hint: t.children.payment.feeHint, icon: 'receipt', tone: 'gray' })
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
    <SheetScreen
      title={title}
      subtitle={row?.student_name}
      dirty={state.dirty}
      busy={state.busy}
      onBack={back}
      backLabel={step === 'form' ? t.children.payment.change : undefined}
      // Only the form step has something to save; a stale report of a form left behind never shows
      action={step === 'form' ? formAction(state, t.common.save) : undefined}
    >
      {step === 'wait' && (
        <View style={styles.stack}>
          <Skeleton height={60} radius={26} />
          <Skeleton height={240} radius={26} />
        </View>
      )}

      {step === 'child' && (
        <View style={styles.list}>
          <SearchField value={query} onChange={setQuery} placeholder={t.children.payment.searchChild} label={t.children.payment.who} />
          {!registrations ? (
            <ListSkeleton rows={5} />
          ) : active.length === 0 ? (
            <EmptyState icon="search" title={t.children.payment.noChildren} />
          ) : (
            <Card inset={AVATAR_INSET}>
              {active.map((item) => (
                <Row
                  key={item.id}
                  leading={<Avatar name={item.student_name} />}
                  title={item.student_name}
                  subtitle={`${labels.packageName(item.package_type)}${DOT}${item.parent_name}`}
                  chevron
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
        <>
          {/* Where the package stands decides between a new period and an instalment */}
          <FormGroup footer={free ? t.children.payment.freeOnly : undefined}>
            <Row
              leading={<Avatar name={row.student_name} />}
              title={labels.packageName(row.package_type)}
              subtitle={<UsageLine usage={usage?.[row.id]} />}
            />
          </FormGroup>
          <FormGroup title={t.children.payment.whatFor} footer={periodDue ? t.children.extend.pendingBlocked : undefined} inset={TILE_INSET}>
            {choices.map((item) => (
              <Row
                key={item.id}
                leading={<IconTile icon={item.icon} tone={item.tone} size={36} />}
                title={
                  <Text weight="500" numberOfLines={2}>
                    {item.title}
                  </Text>
                }
                subtitle={
                  <Text variant="sub" tone="ink3">
                    {item.hint}
                  </Text>
                }
                onPress={() => choose(item.id)}
                chevron
              />
            ))}
          </FormGroup>
        </>
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
  stack: { gap: 24 },
  list: { gap: 16 }
})
