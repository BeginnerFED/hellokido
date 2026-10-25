import { db, unwrap, type Row } from './db'
import { clampStartDay } from '../view/period'
import { readEveningReminder, readWorkshop, type EveningReminder, type WorkshopInfo } from './reminders'

export type PackageType = Row<'package_types'>
export type ExpenseCategory = Row<'expense_categories'>
export type IncomeCategory = Row<'income_categories'>

export type Catalog = {
  packages: PackageType[]
  expenseCategories: ExpenseCategory[]
  incomeCategories: IncomeCategory[]
  settings: { cardSettlementDays: number; cardCommissionRate: number; moneyPeriodStartDay: number; workshop: WorkshopInfo; eveningReminder: EveningReminder }
}

const numberSetting = (rows: { key: string; value: unknown }[], key: string, fallback: number) => {
  const value = Number(rows.find((row) => row.key === key)?.value)
  return Number.isFinite(value) ? value : fallback
}

/** Packages, categories and settings: small lists every screen needs, read together. */
export async function loadCatalog(): Promise<Catalog> {
  const [packages, expenseCategories, incomeCategories, settings] = await Promise.all([
    db.from('package_types').select('*').order('sort_order').order('code'),
    db.from('expense_categories').select('*').order('sort_order').order('code'),
    db.from('income_categories').select('*').order('sort_order').order('code'),
    db.from('app_settings').select('key, value')
  ])
  const settingRows = unwrap(settings) ?? []
  return {
    packages: unwrap(packages) ?? [],
    expenseCategories: unwrap(expenseCategories) ?? [],
    incomeCategories: unwrap(incomeCategories) ?? [],
    settings: {
      cardSettlementDays: numberSetting(settingRows, 'card_settlement_days', 30),
      cardCommissionRate: numberSetting(settingRows, 'card_commission_rate', 0),
      // Missing until the money period migration runs: calendar months, as before
      moneyPeriodStartDay: clampStartDay(numberSetting(settingRows, 'money_period_start_day', 1)),
      workshop: readWorkshop(settingRows.find((row) => row.key === 'workshop')?.value),
      eveningReminder: readEveningReminder(settingRows.find((row) => row.key === 'evening_reminder')?.value)
    }
  }
}

export async function updateSetting(key: 'card_settlement_days' | 'card_commission_rate' | 'money_period_start_day', value: number) {
  const result = await db.from('app_settings').update({ value }).eq('key', key).select('id')
  if (result.error) throw result.error
  if (!result.data?.length) throw new Error('not_found')
}

export async function updatePackageType(code: string, changes: Partial<Pick<PackageType, 'default_price' | 'is_active' | 'name_tr' | 'name_en' | 'name_uk' | 'sort_order'>>) {
  const result = await db.from('package_types').update(changes).eq('code', code).select('id')
  if (result.error) throw result.error
  if (!result.data?.length) throw new Error('not_found')
}

type CategoryTable = 'expense_categories' | 'income_categories'
type CategoryFields = Pick<ExpenseCategory, 'name_tr' | 'name_en' | 'name_uk'> & Partial<Pick<ExpenseCategory, 'sort_order' | 'is_active'>>

/** Makes a stable code from the Turkish name: "Muhasebe Ücreti" gives "muhasebe-ucreti". */
export function codeFromName(name: string) {
  const map: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', İ: 'i', ö: 'o', ş: 's', ü: 'u' }
  return name
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıİöşü]/g, (ch) => map[ch] ?? ch)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export async function addCategory(table: CategoryTable, fields: CategoryFields) {
  const base = codeFromName(fields.name_tr) || 'kategori'
  // A clash only needs a suffix; codes never change once rows use them
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = attempt === 0 ? base : `${base.slice(0, 37)}-${attempt + 1}`
    const result = await db.from(table).insert({ ...fields, code }).select('code').single()
    if (!result.error) return result.data.code
    if ((result.error as { code?: string }).code !== '23505') throw result.error
  }
  throw new Error('code_taken')
}

export async function updateCategory(table: CategoryTable, code: string, changes: Partial<CategoryFields>) {
  const result = await db.from(table).update(changes).eq('code', code).select('id')
  if (result.error) throw result.error
  if (!result.data?.length) throw new Error('not_found')
}

/** Deleting only works for own categories that no row uses; otherwise they are hidden instead. */
export async function deleteCategory(table: CategoryTable, code: string) {
  const result = await db.from(table).delete().eq('code', code).select('id')
  if (result.error) throw result.error
  return (result.data?.length ?? 0) > 0
}
