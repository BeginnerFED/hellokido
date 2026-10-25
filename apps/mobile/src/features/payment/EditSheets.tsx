import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { getIncomeEntry, loadHistory } from '@hellokido/core/api'
import { isFree } from '@hellokido/core/view'
import { keys, useRegistrations } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { EmptyState, LoadError, Skeleton } from '../../ui/Bits'
import { SheetScreen } from '../../ui/Sheet'
import type { FormState } from './fields'
import { ExtendForm, IncomeForm } from './forms'

const IDLE: FormState = { dirty: false, busy: false }

function Waiting() {
  return (
    <View style={styles.stack}>
      {/* The form's own shapes: a field, the period card, a field */}
      <Skeleton height={50} radius={14} />
      <Skeleton height={104} radius={18} />
      <Skeleton height={50} radius={14} />
    </View>
  )
}

/**
 * Corrects the latest package payment of a child. The history is read fresh when the sheet opens,
 * so the form never starts from a payment that was changed meanwhile.
 */
export function ExtensionEditSheet({ registrationId }: { registrationId: string }) {
  const { t } = useI18n()
  const [state, setState] = useState(IDLE)
  const history = useQuery({ queryKey: ['history-edit', registrationId], queryFn: () => loadHistory(registrationId), staleTime: 0, gcTime: 0 })
  const fresh = history.data?.registration
  const extensions = history.data?.extensions ?? []
  const last = extensions[extensions.length - 1]
  // Only the latest payment of this very child, and never free participation, can be corrected
  const extension = fresh && last && last.registration_id === fresh.id && !isFree(fresh) ? last : null

  return (
    <SheetScreen title={t.children.extend.editTitle} subtitle={fresh?.student_name} dirty={state.dirty} busy={state.busy}>
      {history.isPending ? (
        <Waiting />
      ) : history.isError ? (
        <LoadError message={t.children.detail.historyFailed} retryLabel={t.common.retry} onRetry={() => void history.refetch()} />
      ) : !fresh || !extension ? (
        <EmptyState icon="info" title={t.children.form.stale} />
      ) : (
        <ExtendForm registration={fresh} mode="edit" extension={extension} onStateChange={setState} />
      )}
    </SheetScreen>
  )
}

/**
 * Income outside the package flow, new or corrected: a child's fee or income of the workshop. An
 * entry opens by its id and is read fresh; `collect` starts an expected one as received.
 */
export function IncomeSheet({ id, collect }: { id?: string; collect?: boolean }) {
  const { t } = useI18n()
  const [state, setState] = useState(IDLE)
  const entry = useQuery({ queryKey: keys.finance('entry', id ?? ''), queryFn: () => getIncomeEntry(id!), enabled: Boolean(id), gcTime: 0 })
  const row = entry.data ?? null
  const kind = row?.kind === 'child' ? 'child' : 'other'
  const child = useRegistrations(kind === 'child').data?.find((item) => item.id === row?.registration_id)
  const collecting = Boolean(collect && row?.payment_status === 'beklemede')

  const title = collecting ? t.finance.entry.collectTitle : id ? t.finance.entry.editTitle : t.finance.entry.otherTitle
  const subtitle = child?.student_name ?? (collecting ? (row?.description ?? undefined) : undefined)

  return (
    <SheetScreen title={title} subtitle={subtitle} dirty={state.dirty} busy={state.busy}>
      {id && entry.isPending ? (
        <Waiting />
      ) : id && entry.isError ? (
        <LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={() => void entry.refetch()} />
      ) : id && !row ? (
        <EmptyState icon="info" title={t.finance.entry.notFound} />
      ) : (
        <IncomeForm kind={kind} registrationId={row?.registration_id ?? null} entry={row} collect={collecting} onStateChange={setState} />
      )}
    </SheetScreen>
  )
}

const styles = StyleSheet.create({
  stack: { gap: 14 }
})
