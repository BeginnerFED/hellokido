import { useEffect, useMemo, useState } from 'react'
import { PlusIcon, TrashIcon } from '@phosphor-icons/react'
import { addCategory, deleteCategory, updateCategory, type ExpenseCategory, type IncomeCategory } from '@hellokido/core/api'
import { useCatalog, useLabels, useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useToast } from '../../providers/Toasts'
import { LoadError, Mark } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { Switch } from '../../ui/Choice'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { FormRule } from '../../ui/Notice'
import { Sheet, SheetActions, SheetFooter } from '../../ui/Sheet'
import { useSheet } from '../../ui/useSheet'
import { CategoryTablet, IncomeTablet, ListSkeleton } from '../finance/bits'
import { NameFields, SettingList, SettingRow } from './bits'
import { filledNames, localName, namesOf, sameName, type Names } from './rules'

export type CategoryKind = 'expense' | 'income'
type Category = ExpenseCategory | IncomeCategory

const TABLES = { expense: 'expense_categories', income: 'income_categories' } as const
// "Other" keeps sort order 999 so it stays last; a new category goes right before it
const LAST = 999

const listOf = (catalog: ReturnType<typeof useCatalog>['data'], kind: CategoryKind): Category[] =>
  (kind === 'expense' ? catalog?.expenseCategories : catalog?.incomeCategories) ?? []

/** Expense or income categories: rename, hide, or add one of your own. */
export function CategoryList({ kind }: { kind: CategoryKind }) {
  const { t } = useI18n()
  const labels = useLabels()
  const catalog = useCatalog()
  const sheet = useSheet<Category | null>()

  if (catalog.isError) return <LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={() => void catalog.refetch()} />
  if (!catalog.data) return <ListSkeleton rows={4} />

  const name = (code: string) => (kind === 'expense' ? labels.expenseCategory(code) : labels.incomeCategory(code))

  return (
    <>
      <SettingList>
        {listOf(catalog.data, kind).map((row) => (
          <SettingRow
            key={row.code}
            lead={kind === 'expense' ? <CategoryTablet code={row.code} /> : <IncomeTablet code={row.code} />}
            title={name(row.code)}
            muted={!row.is_active}
            mark={!row.is_active && <Mark tone="neutral">{t.settings.hidden}</Mark>}
            onPress={() => sheet.open(row)}
          />
        ))}
      </SettingList>
      <Button variant="ghost" size="sm" className="mt-2 -ml-3" icon={<PlusIcon aria-hidden weight="bold" className="size-4" />} onPress={() => sheet.open(null)}>
        {t.settings.categories.add}
      </Button>
      {sheet.isOpen || sheet.key > 0 ? (
        <CategorySheet key={sheet.key} kind={kind} isOpen={sheet.isOpen} onOpenChange={sheet.setOpen} category={sheet.payload} />
      ) : null}
    </>
  )
}

type FormState = { dirty: boolean; busy: boolean }

type SheetProps = { kind: CategoryKind; isOpen: boolean; onOpenChange: (open: boolean) => void; category: Category | null }

function CategorySheet({ kind, isOpen, onOpenChange, category }: SheetProps) {
  const { t } = useI18n()
  const [state, setState] = useState<FormState>({ dirty: false, busy: false })
  const form = t.settings.categories.form
  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={category ? form.editTitle : form.newTitle}
      description={kind === 'expense' ? form.expenseKind : form.incomeKind}
      isDirty={state.dirty}
      isBusy={state.busy}
    >
      <CategoryForm kind={kind} category={category} onDone={() => onOpenChange(false)} onStateChange={setState} />
    </Sheet>
  )
}

function CategoryForm({
  kind,
  category,
  onDone,
  onStateChange
}: {
  kind: CategoryKind
  category: Category | null
  onDone: () => void
  onStateChange: (state: FormState) => void
}) {
  const { t, fmt, locale } = useI18n()
  const catalog = useCatalog().data
  const toast = useToast()
  const refresh = useRefresh()
  const form = t.settings.categories.form
  const table = TABLES[kind]
  const shownName = category ? localName(category, locale) : ''

  const initial = useMemo(() => ({ names: namesOf(category), active: category?.is_active ?? true }), [category])
  const [names, setNames] = useState<Names>(initial.names)
  const [active, setActive] = useState(initial.active)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const siblings = useMemo(() => listOf(catalog, kind).filter((row) => row.code !== category?.code), [catalog, kind, category])
  const duplicate = names.tr.trim() !== '' && siblings.some((row) => sameName(row.name_tr, names.tr))
  const valid = Boolean(names.tr.trim()) && !duplicate
  const dirty = names.tr !== initial.names.tr || names.en !== initial.names.en || names.uk !== initial.names.uk || active !== initial.active
  useEffect(() => onStateChange({ dirty, busy }), [dirty, busy, onStateChange])

  const gone = () => {
    toast({ tone: 'warning', title: form.notFound })
    void refresh.catalog()
    onDone()
  }

  const save = async () => {
    if (!valid || busy) return
    const filled = filledNames(names)
    setBusy(true)
    try {
      if (!category) {
        const before = siblings.map((row) => row.sort_order).filter((order) => order < LAST)
        await addCategory(table, { ...filled, sort_order: (before.length ? Math.max(...before) : 0) + 10 })
        toast({ tone: 'success', title: fmt(form.saved, { name: localName(filled, locale) }) })
      } else {
        const changes: Parameters<typeof updateCategory>[2] = {}
        if (filled.name_tr !== category.name_tr) changes.name_tr = filled.name_tr
        if (filled.name_en !== category.name_en) changes.name_en = filled.name_en
        if (filled.name_uk !== category.name_uk) changes.name_uk = filled.name_uk
        if (active !== category.is_active) changes.is_active = active
        if (Object.keys(changes).length > 0) {
          await updateCategory(table, category.code, changes)
          toast({ tone: 'success', title: form.updated })
        }
      }
      void refresh.catalog()
      onDone()
    } catch (error) {
      if (String((error as Error)?.message).includes('not_found')) return gone()
      toast({ tone: 'error', title: form.failed })
    } finally {
      setBusy(false)
    }
  }

  // A category that entries use is kept by the database; it is hidden instead, so old entries keep their name
  const remove = async () => {
    if (!category) return
    setBusy(true)
    try {
      const found = await deleteCategory(table, category.code)
      setConfirming(false)
      if (!found) return gone()
      toast({ tone: 'success', title: form.deleted })
      void refresh.catalog()
      onDone()
    } catch (error) {
      if ((error as { code?: string })?.code === '23503') {
        try {
          await updateCategory(table, category.code, { is_active: false })
          setConfirming(false)
          toast({ tone: 'info', title: fmt(form.hiddenInstead, { name: shownName }) })
          void refresh.catalog()
          onDone()
        } catch {
          toast({ tone: 'error', title: form.deleteFailed })
        }
        return
      }
      toast({ tone: 'error', title: form.deleteFailed })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <NameFields value={names} onChange={setNames} errorMessage={duplicate ? form.duplicate : undefined} autoFocus={!category} />
      {category && (
        <>
          <FormRule />
          <div className="flex flex-col gap-1">
            <Switch isSelected={active} onChange={setActive}>
              {form.active}
            </Switch>
            <p className="text-[0.8125rem] text-ink-3">{form.activeHint}</p>
          </div>
        </>
      )}
      <SheetFooter>
        <SheetActions
          start={
            category &&
            !category.is_system && (
              <Button variant="danger-soft" icon={<TrashIcon aria-hidden className="size-4" />} onPress={() => setConfirming(true)} isDisabled={busy}>
                {form.delete}
              </Button>
            )
          }
        >
          <Button variant="primary" isDisabled={!valid} isPending={busy} onPress={() => void save()} className="max-md:flex-1">
            {t.common.save}
          </Button>
        </SheetActions>
      </SheetFooter>
      <ConfirmDialog
        isOpen={confirming}
        onOpenChange={(open) => !busy && setConfirming(open)}
        title={form.deleteTitle}
        body={category && fmt(form.deleteBody, { name: shownName })}
        confirmLabel={t.common.delete}
        tone="danger"
        isPending={busy}
        onConfirm={() => void remove()}
      />
    </div>
  )
}
