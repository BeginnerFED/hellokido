import { db, fetchAll, unwrap, unwrapRow, type Insert, type Row, type Update } from './db'

export type Expense = Row<'expenses'>
export type RecurringExpense = Row<'recurring_expenses'>
export type IncomeEntry = Row<'income_entries'>

/**
 * One line of income, whatever table it lives in:
 * - `package`: a package payment from the registration ledger (financial_records)
 * - `child`: an extra fee or part payment from a child's family (income_entries)
 * - `other`: income that belongs to no child (income_entries)
 */
export type IncomeLine = {
  key: string
  id: string
  source: 'package' | 'child' | 'other'
  amount: number
  method: string
  status: 'odendi' | 'beklemede'
  paymentDate: string | null
  dueDate: string | null
  createdAt: string | null
  registrationId: string | null
  student: string
  parent: string
  isActive: boolean | null
  packageType: string | null
  periodStart: string | null
  periodEnd: string | null
  transactionType: string | null
  category: string | null
  description: string | null
  notes: string | null
  /** The income_entries row itself (fees and other income), so a list can open it for editing. */
  entry: IncomeEntry | null
}

type LedgerJoined = {
  id: string
  amount: number
  payment_method: string
  payment_status: string
  payment_date: string | null
  created_at: string | null
  transaction_type: string
  registration_id: string
  notes: string | null
  registrations: {
    student_name: string
    parent_name: string
    package_type: string
    package_start_date: string
    package_end_date: string
    is_active: boolean | null
    initial_start_date: string | null
    initial_end_date: string | null
    initial_package_type: string | null
  } | null
  extension_history: { new_start_date: string | null; new_end_date: string; new_package_type: string; previous_end_date: string } | null
}

const LEDGER_FIELDS = (inner: boolean) => `id, amount, payment_method, payment_status, payment_date, created_at, transaction_type, registration_id, notes,
  registrations${inner ? '!inner' : ''}(student_name, parent_name, package_type, package_start_date, package_end_date, is_active, initial_start_date, initial_end_date, initial_package_type),
  extension_history(new_start_date, new_end_date, new_package_type, previous_end_date)`

/** The package and period a ledger payment belongs to (first payment, an extension, or the current package). */
function fromLedger(row: LedgerJoined): IncomeLine {
  const reg = row.registrations
  const ext = row.extension_history
  let packageType = reg?.package_type ?? null
  let periodStart = reg?.package_start_date ?? null
  let periodEnd = reg?.package_end_date ?? null
  if (row.transaction_type === 'initial_payment' && reg) {
    packageType = reg.initial_package_type ?? reg.package_type
    periodStart = reg.initial_start_date ?? reg.package_start_date
    periodEnd = reg.initial_end_date ?? reg.package_end_date
  } else if (ext) {
    packageType = ext.new_package_type
    periodStart = ext.new_start_date ?? ext.previous_end_date
    periodEnd = ext.new_end_date
  }
  return {
    key: `p:${row.id}`,
    id: row.id,
    source: 'package',
    amount: Number(row.amount) || 0,
    method: row.payment_method,
    status: row.payment_status === 'odendi' ? 'odendi' : 'beklemede',
    paymentDate: row.payment_status === 'odendi' ? row.payment_date : null,
    dueDate: null,
    createdAt: row.created_at,
    registrationId: row.registration_id,
    student: reg?.student_name ?? '',
    parent: reg?.parent_name ?? '',
    isActive: reg?.is_active ?? null,
    packageType,
    periodStart,
    periodEnd,
    transactionType: row.transaction_type,
    category: null,
    description: null,
    notes: row.notes,
    entry: null
  }
}

type EntryJoined = IncomeEntry & { registrations: { student_name: string; parent_name: string; is_active: boolean | null } | null }

function fromEntry(joined: EntryJoined): IncomeLine {
  const { registrations, ...row } = joined
  return {
    key: `e:${row.id}`,
    id: row.id,
    source: row.kind === 'child' ? 'child' : 'other',
    amount: Number(row.amount) || 0,
    method: row.payment_method,
    status: row.payment_status === 'odendi' ? 'odendi' : 'beklemede',
    paymentDate: row.payment_status === 'odendi' ? row.payment_date : null,
    dueDate: row.due_date,
    createdAt: row.created_at,
    registrationId: row.registration_id,
    student: registrations?.student_name ?? '',
    parent: registrations?.parent_name ?? '',
    isActive: registrations?.is_active ?? null,
    packageType: null,
    periodStart: null,
    periodEnd: null,
    transactionType: null,
    category: row.category,
    description: row.description,
    notes: row.notes,
    entry: row
  }
}

const ENTRY_FIELDS = '*, registrations(student_name, parent_name, is_active)'

const byPaymentDateDesc = (a: IncomeLine, b: IncomeLine) =>
  new Date(b.paymentDate ?? 0).getTime() - new Date(a.paymentDate ?? 0).getTime() ||
  new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()

/** Money received in [from, to], by payment day: package payments and every other income. */
export async function incomeBetween(from: Date, to: Date): Promise<IncomeLine[]> {
  const [ledger, entries] = await Promise.all([
    fetchAll<LedgerJoined>(() =>
      db
        .from('financial_records')
        .select(LEDGER_FIELDS(false))
        .in('transaction_type', ['initial_payment', 'extension_payment'])
        .eq('payment_status', 'odendi')
        .gte('payment_date', from.toISOString())
        .lte('payment_date', to.toISOString())
        .order('payment_date', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id')
    ),
    fetchAll<EntryJoined>(() =>
      db
        .from('income_entries')
        .select(ENTRY_FIELDS)
        .eq('payment_status', 'odendi')
        .gte('payment_date', from.toISOString())
        .lte('payment_date', to.toISOString())
        .order('payment_date', { ascending: false })
        .order('id')
    )
  ])
  return [...ledger.map(fromLedger), ...entries.map(fromEntry)].sort(byPaymentDateDesc)
}

/**
 * Money still to come: unpaid package payments of active children (no date: an unpaid row has
 * no payment day) and every expected income entry, soonest due date first.
 */
export async function pendingIncome(): Promise<IncomeLine[]> {
  const [ledger, entries] = await Promise.all([
    fetchAll<LedgerJoined>(() =>
      db
        .from('financial_records')
        .select(LEDGER_FIELDS(true))
        .in('transaction_type', ['initial_payment', 'extension_payment'])
        .eq('payment_status', 'beklemede')
        .eq('registrations.is_active', true)
        .order('created_at', { ascending: false })
        .order('id')
    ),
    fetchAll<EntryJoined>(() =>
      db.from('income_entries').select(ENTRY_FIELDS).eq('payment_status', 'beklemede').order('due_date', { ascending: true, nullsFirst: false }).order('id')
    )
  ])
  return [...entries.map(fromEntry), ...ledger.map(fromLedger)]
}

/** Card payments taken since `from`: the money the bank will credit later. */
export async function cardPaymentsSince(from: Date): Promise<IncomeLine[]> {
  const [ledger, entries] = await Promise.all([
    fetchAll<LedgerJoined>(() =>
      db
        .from('financial_records')
        .select(LEDGER_FIELDS(false))
        .eq('payment_status', 'odendi')
        .eq('payment_method', 'kart')
        .gte('payment_date', from.toISOString())
        .order('payment_date', { ascending: false })
        .order('id')
    ),
    fetchAll<EntryJoined>(() =>
      db
        .from('income_entries')
        .select(ENTRY_FIELDS)
        .eq('payment_status', 'odendi')
        .eq('payment_method', 'kart')
        .gte('payment_date', from.toISOString())
        .order('payment_date', { ascending: false })
        .order('id')
    )
  ])
  return [...ledger.map(fromLedger), ...entries.map(fromEntry)].sort(byPaymentDateDesc)
}

/** Daily amounts for the month chart: income by payment day, expenses by expense day. */
export async function moneySince(firstMonth: Date) {
  const [ledger, entries, expenses] = await Promise.all([
    fetchAll<{ id: string; amount: number; payment_date: string }>(() =>
      db
        .from('financial_records')
        .select('id, amount, payment_date')
        .in('transaction_type', ['initial_payment', 'extension_payment'])
        .eq('payment_status', 'odendi')
        .gte('payment_date', firstMonth.toISOString())
        .order('payment_date')
        .order('id')
    ),
    fetchAll<{ id: string; amount: number; payment_date: string }>(() =>
      db
        .from('income_entries')
        .select('id, amount, payment_date')
        .eq('payment_status', 'odendi')
        .gte('payment_date', firstMonth.toISOString())
        .order('payment_date')
        .order('id')
    ),
    fetchAll<{ id: string; amount: number; expense_date: string }>(() =>
      db.from('expenses').select('id, amount, expense_date').gte('expense_date', firstMonth.toISOString()).order('expense_date').order('id')
    )
  ])
  return {
    income: [...ledger, ...entries].map((row) => ({ date: row.payment_date, amount: Number(row.amount) || 0 })),
    expenses: expenses.map((row) => ({ id: row.id, date: row.expense_date, amount: Number(row.amount) || 0 }))
  }
}

/** Every salary expense ever (a handful a month): the pay-outs among them cut the money periods. */
export async function salaryRows() {
  const rows = await fetchAll<{ id: string; amount: number; expense_date: string }>(() =>
    db.from('expenses').select('id, amount, expense_date').eq('expense_type', 'maas').order('expense_date').order('id')
  )
  return rows.map((row) => ({ id: row.id, date: row.expense_date, amount: Number(row.amount) || 0 }))
}

// ---------------------------------------------------------------------------------------------
// Expenses

export function expensesBetween(from: Date, to: Date): Promise<Expense[]> {
  return fetchAll<Expense>(() =>
    db
      .from('expenses')
      .select('*')
      .gte('expense_date', from.toISOString())
      .lte('expense_date', to.toISOString())
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id')
  )
}

/** One expense as the database has it now (the phone opens an edit by its id). */
export async function getExpense(id: string): Promise<Expense | null> {
  return unwrap(await db.from('expenses').select('*').eq('id', id).maybeSingle())
}

export type ExpenseFields = Pick<Insert<'expenses'>, 'expense_type' | 'amount' | 'description' | 'expense_date' | 'payment_method' | 'notes' | 'recurring_expense_id'>

export async function addExpense(fields: ExpenseFields) {
  return unwrapRow(await db.from('expenses').insert(fields).select('id').single()).id
}

/** Zero changed rows means someone deleted it meanwhile (or access was lost). */
export async function updateExpense(id: string, fields: Update<'expenses'>) {
  const result = await db.from('expenses').update(fields).eq('id', id).select('id')
  if (result.error) throw result.error
  if (!result.data?.length) throw new Error('not_found')
}

export async function deleteExpense(id: string) {
  const result = await db.from('expenses').delete().eq('id', id).select('id')
  if (result.error) throw result.error
  return (result.data?.length ?? 0) > 0
}

// ---------------------------------------------------------------------------------------------
// Monthly expense templates (rent, salaries, bills)

export async function listRecurring(): Promise<RecurringExpense[]> {
  return unwrap(await db.from('recurring_expenses').select('*').order('day_of_month').order('title').order('id')) ?? []
}

export type RecurringFields = Pick<Insert<'recurring_expenses'>, 'title' | 'expense_type' | 'amount' | 'payment_method' | 'day_of_month' | 'notes' | 'is_active'>

export async function saveRecurring(id: string | null, fields: RecurringFields) {
  if (!id) return unwrapRow(await db.from('recurring_expenses').insert(fields).select('id').single()).id
  const result = await db.from('recurring_expenses').update(fields).eq('id', id).select('id')
  if (result.error) throw result.error
  if (!result.data?.length) throw new Error('not_found')
  return id
}

export async function deleteRecurring(id: string) {
  const result = await db.from('recurring_expenses').delete().eq('id', id).select('id')
  if (result.error) throw result.error
}

/** Which templates already produced an expense in [from, to] (so the month view can offer the rest). */
export async function recurringUsedBetween(from: Date, to: Date): Promise<Set<string>> {
  const rows =
    unwrap(
      await db
        .from('expenses')
        .select('recurring_expense_id')
        .not('recurring_expense_id', 'is', null)
        .gte('expense_date', from.toISOString())
        .lte('expense_date', to.toISOString())
    ) ?? []
  return new Set(rows.map((row) => row.recurring_expense_id as string))
}

// ---------------------------------------------------------------------------------------------
// Income outside the package flow

export type IncomeEntryFields = Pick<
  Insert<'income_entries'>,
  'kind' | 'registration_id' | 'category' | 'description' | 'amount' | 'payment_status' | 'payment_method' | 'payment_date' | 'due_date' | 'notes'
>

export async function addIncomeEntry(fields: IncomeEntryFields) {
  return unwrapRow(await db.from('income_entries').insert(fields).select('id').single()).id
}

export async function updateIncomeEntry(id: string, fields: Update<'income_entries'>) {
  const result = await db.from('income_entries').update(fields).eq('id', id).select('id')
  if (result.error) throw result.error
  if (!result.data?.length) throw new Error('not_found')
}

/** One income entry as the database has it now (the phone opens an edit by its id). */
export async function getIncomeEntry(id: string): Promise<IncomeEntry | null> {
  return unwrap(await db.from('income_entries').select('*').eq('id', id).maybeSingle())
}

export async function deleteIncomeEntry(id: string) {
  const result = await db.from('income_entries').delete().eq('id', id).select('id')
  if (result.error) throw result.error
  return (result.data?.length ?? 0) > 0
}

/** A child's extra fees and expected payments, newest first. */
export async function childIncomeEntries(registrationId: string): Promise<IncomeEntry[]> {
  return (
    unwrap(
      await db
        .from('income_entries')
        .select('*')
        .eq('registration_id', registrationId)
        .order('created_at', { ascending: false })
        .order('id')
    ) ?? []
  )
}
