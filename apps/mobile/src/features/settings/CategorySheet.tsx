import { useMemo, useState } from 'react'
import { Alert } from 'react-native'
import * as Haptics from 'expo-haptics'
import { addCategory, deleteCategory, updateCategory, type Catalog, type ExpenseCategory, type IncomeCategory } from '@hellokido/core/api'
import { filledNames, localName, namesOf, sameName, type Names } from '@hellokido/core/view'
import { useCatalog, useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { EmptyState, ListSkeleton } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { SwitchField } from '../../ui/Fields'
import { CardButton, FormGroup } from '../../ui/Screen'
import { SheetActions, SheetScreen, useSheet } from '../../ui/Sheet'
import { useToast } from '../../ui/Toast'
import { NameFields } from './bits'

export type CategoryKind = 'expense' | 'income'
type Category = ExpenseCategory | IncomeCategory

const TABLES = { expense: 'expense_categories', income: 'income_categories' } as const
// "Other" keeps sort order 999 so it stays last; a new category goes right before it
const LAST = 999

const listOf = (catalog: Catalog | undefined, kind: CategoryKind): Category[] => (kind === 'expense' ? catalog?.expenseCategories : catalog?.incomeCategories) ?? []

/** An expense or income category to rename or hide, or a new one of the workshop's own. */
export function CategorySheet({ kind, code }: { kind: CategoryKind; code?: string }) {
  const { t } = useI18n()
  const catalog = useCatalog()
  const form = t.settings.categories.form
  const category = code ? (listOf(catalog.data, kind).find((row) => row.code === code) ?? null) : null

  if (catalog.data && (!code || category)) return <CategoryForm kind={kind} category={category} catalog={catalog.data} />
  return (
    <SheetScreen title={code ? form.editTitle : form.newTitle} subtitle={kind === 'expense' ? form.expenseKind : form.incomeKind}>
      {catalog.data ? (
        <EmptyState icon="info" title={form.notFound} />
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
        <ListSkeleton rows={2} />
      )}
    </SheetScreen>
  )
}

type FormProps = { kind: CategoryKind; category: Category | null; catalog: Catalog }

function CategoryForm({ kind, category, catalog }: FormProps) {
  const { t, fmt, locale } = useI18n()
  const toast = useToast()
  const refresh = useRefresh()
  // This form draws its own SheetScreen, so the bar's action closes the sheet it is in through this
  const sheet = useSheet()
  const form = t.settings.categories.form
  const table = TABLES[kind]
  const shownName = category ? localName(category, locale) : ''

  const [initial] = useState(() => ({ names: namesOf(category), active: category?.is_active ?? true }))
  const [names, setNames] = useState<Names>(initial.names)
  const [active, setActive] = useState(initial.active)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const siblings = useMemo(() => listOf(catalog, kind).filter((row) => row.code !== category?.code), [catalog, kind, category])
  const duplicate = names.tr.trim() !== '' && siblings.some((row) => sameName(row.name_tr, names.tr))
  const valid = Boolean(names.tr.trim()) && !duplicate
  const dirty = names.tr !== initial.names.tr || names.en !== initial.names.en || names.uk !== initial.names.uk || active !== initial.active

  const gone = () => {
    toast({ tone: 'warning', title: form.notFound })
    void refresh.catalog()
    sheet.finish()
  }

  const save = async () => {
    if (!valid || busy) return
    const filled = filledNames(names)
    setBusy(true)
    setError(null)
    try {
      if (!category) {
        const before = siblings.map((row) => row.sort_order).filter((order) => order < LAST)
        await addCategory(table, { ...filled, sort_order: (before.length ? Math.max(...before) : 0) + 10 })
        toast({ title: fmt(form.saved, { name: localName(filled, locale) }) })
      } else {
        const changes: Parameters<typeof updateCategory>[2] = {}
        if (filled.name_tr !== category.name_tr) changes.name_tr = filled.name_tr
        if (filled.name_en !== category.name_en) changes.name_en = filled.name_en
        if (filled.name_uk !== category.name_uk) changes.name_uk = filled.name_uk
        if (active !== category.is_active) changes.is_active = active
        if (Object.keys(changes).length > 0) {
          await updateCategory(table, category.code, changes)
          toast({ title: form.updated })
        }
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      void refresh.catalog()
      sheet.finish()
    } catch (caught) {
      if (String((caught as Error)?.message).includes('not_found')) return gone()
      setError(form.failed)
    } finally {
      setBusy(false)
    }
  }

  // A category that entries use is kept by the database; it is hidden instead, so old entries keep their name
  const remove = () => {
    if (!category) return
    Alert.alert(form.deleteTitle, fmt(form.deleteBody, { name: shownName }), [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.delete,
        style: 'destructive',
        onPress: async () => {
          setBusy(true)
          setError(null)
          try {
            const found = await deleteCategory(table, category.code)
            if (!found) return gone()
            toast({ title: form.deleted })
            void refresh.catalog()
            sheet.finish()
          } catch (caught) {
            if ((caught as { code?: string })?.code !== '23503') {
              setError(form.deleteFailed)
              return
            }
            try {
              await updateCategory(table, category.code, { is_active: false })
              toast({ tone: 'info', title: fmt(form.hiddenInstead, { name: shownName }) })
              void refresh.catalog()
              sheet.finish()
            } catch {
              setError(form.deleteFailed)
            }
          } finally {
            setBusy(false)
          }
        }
      }
    ])
  }

  return (
    <SheetScreen
      title={category ? form.editTitle : form.newTitle}
      subtitle={kind === 'expense' ? form.expenseKind : form.incomeKind}
      dirty={dirty}
      busy={busy}
      // A new category is added, a known one saved, as the phone's own forms say it
      // A known one waits for a change before it can be saved; a new one only for a free name
      action={{ label: category ? t.common.save : t.common.add, disabled: !valid || (category !== null && !dirty), onPress: () => void save() }}
    >
      <NameFields value={names} onChange={setNames} error={duplicate ? form.duplicate : undefined} autoFocus={!category} />
      {category && (
        <FormGroup footer={form.activeHint}>
          <SwitchField label={form.active} value={active} onChange={setActive} />
        </FormGroup>
      )}
      <SheetActions error={error}>{category && !category.is_system && <CardButton label={form.delete} destructive disabled={busy} onPress={remove} />}</SheetActions>
    </SheetScreen>
  )
}
