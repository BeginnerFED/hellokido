import { useState } from 'react'
import * as Haptics from 'expo-haptics'
import { updatePackageType, type PackageType } from '@hellokido/core/api'
import { formatAmountForInput, isPositiveAmount, parseAmount } from '@hellokido/core/rules/money.js'
import { filledNames, namesOf, type Names } from '@hellokido/core/view'
import { useCatalog, useLabels, useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { EmptyState, ListSkeleton } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { AmountField, SwitchField } from '../../ui/Fields'
import { FormGroup } from '../../ui/Screen'
import { SheetActions, SheetScreen, useSheet } from '../../ui/Sheet'
import { useToast } from '../../ui/Toast'
import { amountError } from '../payment/fields'
import { NameFields } from './bits'

const isFree = (row: PackageType) => row.family === 'free'

/** The price a payment form suggests for a package, its names, and whether new registrations offer it. */
export function PackageSheet({ code }: { code: string }) {
  const { t } = useI18n()
  const catalog = useCatalog()
  const pkg = catalog.data?.packages.find((row) => row.code === code) ?? null

  if (pkg) return <PackageForm pkg={pkg} />
  return (
    <SheetScreen title={t.settings.packages.form.title}>
      {catalog.data ? (
        <EmptyState icon="info" title={t.settings.packages.form.notFound} />
      ) : catalog.isError ? (
        <EmptyState
          icon="info"
          title={t.common.loadFailed}
          action={
            <Button size="sm" icon="refresh" busy={catalog.isFetching} onPress={() => void catalog.refetch()}>
              {t.common.retry}
            </Button>
          }
        />
      ) : (
        <ListSkeleton rows={3} />
      )}
    </SheetScreen>
  )
}

function PackageForm({ pkg }: { pkg: PackageType }) {
  const { t } = useI18n()
  const labels = useLabels()
  const toast = useToast()
  const refresh = useRefresh()
  // This form draws its own SheetScreen, so the bar's action closes the sheet it is in through this
  const sheet = useSheet()
  const free = isFree(pkg)
  const copy = t.settings.packages.form

  const [initial] = useState(() => ({ price: pkg.default_price != null ? formatAmountForInput(pkg.default_price) : '', names: namesOf(pkg), active: pkg.is_active }))
  const [price, setPrice] = useState(initial.price)
  const [names, setNames] = useState<Names>(initial.names)
  const [active, setActive] = useState(initial.active)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const valid = Boolean(names.tr.trim()) && (free || !price.trim() || isPositiveAmount(price))
  const dirty = price !== initial.price || names.tr !== initial.names.tr || names.en !== initial.names.en || names.uk !== initial.names.uk || active !== initial.active

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
      toast({ title: copy.saved })
      void refresh.catalog()
      sheet.finish()
    } catch (caught) {
      if (String((caught as Error)?.message).includes('not_found')) {
        toast({ tone: 'warning', title: copy.notFound })
        void refresh.catalog()
        sheet.finish()
        return
      }
      setError(copy.failed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <SheetScreen
      title={copy.title}
      subtitle={labels.packageName(pkg.code)}
      dirty={dirty}
      busy={busy}
      // Nothing to save until something changed
      action={{ label: t.common.save, disabled: !valid || !dirty, onPress: () => void save() }}
    >
      {!free && (
        <FormGroup footer={copy.priceHint}>
          <AmountField label={copy.price} value={price} onChange={setPrice} error={amountError(price, t.common.amountInvalid)} />
        </FormGroup>
      )}
      <NameFields value={names} onChange={setNames} />
      <FormGroup footer={copy.activeHint}>
        <SwitchField label={copy.active} value={active} onChange={setActive} />
      </FormGroup>
      <SheetActions error={error} />
    </SheetScreen>
  )
}
