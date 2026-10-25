import { useEffect, useMemo, useState } from 'react'
import { updatePackageType, type PackageType } from '@hellokido/core/api'
import { formatAmountForInput, isPositiveAmount, parseAmount } from '@hellokido/core/rules/money.js'
import { useCatalog, useLabels, useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useToast } from '../../providers/Toasts'
import { LoadError, Mark } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { Switch } from '../../ui/Choice'
import { AmountField } from '../../ui/Field'
import { FormRule } from '../../ui/Notice'
import { Sheet, SheetActions, SheetFooter } from '../../ui/Sheet'
import { useSheet } from '../../ui/useSheet'
import { ListSkeleton } from '../finance/bits'
import { amountError } from '../money/PaymentFields'
import { NameFields, SettingList, SettingRow } from './bits'
import { filledNames, namesOf, type Names } from './rules'

const isFree = (row: PackageType) => row.family === 'free'

/** The package catalog: a price here is what a payment form suggests for that package. */
export function PackageList() {
  const { t, plural, money } = useI18n()
  const labels = useLabels()
  const catalog = useCatalog()
  const sheet = useSheet<PackageType>()

  if (catalog.isError) return <LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={() => void catalog.refetch()} />
  if (!catalog.data) return <ListSkeleton rows={4} />

  const lessonsOf = (row: PackageType, name: string) => {
    if (isFree(row)) return t.children.form.noQuota
    // "3 aylık - 12 atölye" already says how many lessons it has
    if (!row.lessons || new RegExp(`(^|\\D)${row.lessons}(\\D|$)`).test(name)) return undefined
    return plural(t.children.form.lessons, row.lessons)
  }

  return (
    <>
      <SettingList>
        {catalog.data.packages.map((row) => (
          <SettingRow
            key={row.code}
            title={labels.packageName(row.code)}
            muted={!row.is_active}
            mark={!row.is_active && <Mark tone="neutral">{t.settings.hidden}</Mark>}
            meta={lessonsOf(row, labels.packageName(row.code))}
            trail={
              isFree(row) ? undefined : row.default_price != null ? (
                <span className="font-medium text-ink">{money(row.default_price)}</span>
              ) : (
                <span className="text-ink-3">{t.settings.packages.noPrice}</span>
              )
            }
            onPress={() => sheet.open(row)}
          />
        ))}
      </SettingList>
      {sheet.isOpen || sheet.key > 0 ? <PackageSheet key={sheet.key} isOpen={sheet.isOpen} onOpenChange={sheet.setOpen} pkg={sheet.payload} /> : null}
    </>
  )
}

type FormState = { dirty: boolean; busy: boolean }

function PackageSheet({ isOpen, onOpenChange, pkg }: { isOpen: boolean; onOpenChange: (open: boolean) => void; pkg: PackageType | null }) {
  const { t } = useI18n()
  const labels = useLabels()
  const [state, setState] = useState<FormState>({ dirty: false, busy: false })
  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={t.settings.packages.form.title}
      description={pkg ? labels.packageName(pkg.code) : undefined}
      isDirty={state.dirty}
      isBusy={state.busy}
    >
      {pkg && <PackageForm pkg={pkg} onDone={() => onOpenChange(false)} onStateChange={setState} />}
    </Sheet>
  )
}

function PackageForm({ pkg, onDone, onStateChange }: { pkg: PackageType; onDone: () => void; onStateChange: (state: FormState) => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const refresh = useRefresh()
  const free = isFree(pkg)

  const initial = useMemo(
    () => ({ price: pkg.default_price != null ? formatAmountForInput(pkg.default_price) : '', names: namesOf(pkg), active: pkg.is_active }),
    [pkg]
  )
  const [price, setPrice] = useState(initial.price)
  const [names, setNames] = useState<Names>(initial.names)
  const [active, setActive] = useState(initial.active)
  const [busy, setBusy] = useState(false)

  const valid = Boolean(names.tr.trim()) && (free || !price.trim() || isPositiveAmount(price))
  const dirty =
    price !== initial.price ||
    names.tr !== initial.names.tr ||
    names.en !== initial.names.en ||
    names.uk !== initial.names.uk ||
    active !== initial.active
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
    if (Object.keys(changes).length === 0) {
      onDone()
      return
    }
    setBusy(true)
    try {
      await updatePackageType(pkg.code, changes)
      toast({ tone: 'success', title: t.settings.packages.form.saved })
      void refresh.catalog()
      onDone()
    } catch (error) {
      if (String((error as Error)?.message).includes('not_found')) {
        toast({ tone: 'warning', title: t.settings.packages.form.notFound })
        void refresh.catalog()
        onDone()
        return
      }
      toast({ tone: 'error', title: t.settings.packages.form.failed })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {!free && (
        <AmountField
          label={t.settings.packages.form.price}
          value={price}
          onChange={setPrice}
          description={t.settings.packages.form.priceHint}
          errorMessage={amountError(price, t.common.amountInvalid)}
        />
      )}
      <NameFields value={names} onChange={setNames} />
      <FormRule />
      <div className="flex flex-col gap-1">
        <Switch isSelected={active} onChange={setActive}>
          {t.settings.packages.form.active}
        </Switch>
        <p className="text-[0.8125rem] text-ink-3">{t.settings.packages.form.activeHint}</p>
      </div>
      <SheetFooter>
        <SheetActions>
          <Button variant="primary" isDisabled={!valid} isPending={busy} onPress={() => void save()} className="max-md:flex-1">
            {t.common.save}
          </Button>
        </SheetActions>
      </SheetFooter>
    </div>
  )
}
