import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import { updatePackageType, type PackageType } from '@hellokido/core/api'
import { formatAmountForInput, isPositiveAmount, parseAmount } from '@hellokido/core/rules/money.js'
import { filledNames, namesOf, type Names } from '@hellokido/core/view'
import { useCatalog, useLabels, useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { EmptyState, Skeleton } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { AmountField, SwitchField } from '../../ui/Fields'
import { SheetActions, SheetScreen, useSheet } from '../../ui/Sheet'
import { Text } from '../../ui/Text'
import { useToast } from '../../ui/Toast'
import { amountError, type FormState } from '../payment/fields'
import { NameFields } from './bits'

const IDLE: FormState = { dirty: false, busy: false }
const isFree = (row: PackageType) => row.family === 'free'

/** The price a payment form suggests for a package, its names, and whether new registrations offer it. */
export function PackageSheet({ code }: { code: string }) {
  const { t } = useI18n()
  const labels = useLabels()
  const catalog = useCatalog()
  const [state, setState] = useState(IDLE)
  const pkg = catalog.data?.packages.find((row) => row.code === code) ?? null

  return (
    <SheetScreen title={t.settings.packages.form.title} subtitle={pkg ? labels.packageName(pkg.code) : undefined} dirty={state.dirty} busy={state.busy}>
      {!catalog.data ? (
        catalog.isError ? (
          <EmptyState icon="info" title={t.common.loadFailed} />
        ) : (
          <View style={styles.stack}>
            <Skeleton height={50} radius={13} />
            <Skeleton height={50} radius={13} />
            <Skeleton height={50} radius={13} />
          </View>
        )
      ) : !pkg ? (
        <EmptyState icon="info" title={t.settings.packages.form.notFound} />
      ) : (
        <PackageForm pkg={pkg} onStateChange={setState} />
      )}
    </SheetScreen>
  )
}

function PackageForm({ pkg, onStateChange }: { pkg: PackageType; onStateChange: (state: FormState) => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const refresh = useRefresh()
  const sheet = useSheet()
  const free = isFree(pkg)

  const [initial] = useState(() => ({ price: pkg.default_price != null ? formatAmountForInput(pkg.default_price) : '', names: namesOf(pkg), active: pkg.is_active }))
  const [price, setPrice] = useState(initial.price)
  const [names, setNames] = useState<Names>(initial.names)
  const [active, setActive] = useState(initial.active)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const valid = Boolean(names.tr.trim()) && (free || !price.trim() || isPositiveAmount(price))
  const dirty = price !== initial.price || names.tr !== initial.names.tr || names.en !== initial.names.en || names.uk !== initial.names.uk || active !== initial.active
  useEffect(() => onStateChange({ dirty, busy }), [dirty, busy, onStateChange])

  const save = async () => {
    if (!valid || busy) return
    // Only what changed is sent, so the other admin's edit of the rest is kept
    const changes: Parameters<typeof updatePackageType>[1] = {}
    const nextPrice = price.trim() ? parseAmount(price) : null
    const before = pkg.default_price == null ? null : Number(pkg.default_price)
    if (!free && nextPrice !== before) changes.default_price = nextPrice
    const filled = filledNames(names)
    if (filled.name_tr !== pkg.name_tr) changes.name_tr = filled.name_tr
    if (filled.name_en !== pkg.name_en) changes.name_en = filled.name_en
    if (filled.name_uk !== pkg.name_uk) changes.name_uk = filled.name_uk
    if (active !== pkg.is_active) changes.is_active = active
    if (Object.keys(changes).length === 0) return sheet.finish()
    setBusy(true)
    setError(null)
    try {
      await updatePackageType(pkg.code, changes)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      toast({ title: t.settings.packages.form.saved })
      void refresh.catalog()
      sheet.finish()
    } catch (caught) {
      if (String((caught as Error)?.message).includes('not_found')) {
        toast({ tone: 'warning', title: t.settings.packages.form.notFound })
        void refresh.catalog()
        sheet.finish()
        return
      }
      setError(t.settings.packages.form.failed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {!free && (
        <View>
          <AmountField label={t.settings.packages.form.price} value={price} onChange={setPrice} error={amountError(price, t.common.amountInvalid)} />
          <Text variant="foot" tone="ink3" style={styles.hint}>
            {t.settings.packages.form.priceHint}
          </Text>
        </View>
      )}
      <NameFields value={names} onChange={setNames} />
      <SwitchField label={t.settings.packages.form.active} hint={t.settings.packages.form.activeHint} value={active} onChange={setActive} />
      <SheetActions error={error}>
        <Button variant="primary" size="lg" disabled={!valid} busy={busy} onPress={() => void save()}>
          {t.common.save}
        </Button>
      </SheetActions>
    </>
  )
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  hint: { marginTop: 6, paddingHorizontal: 2 }
})
