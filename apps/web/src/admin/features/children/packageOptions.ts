import { useMemo } from 'react'
import { PACKAGE_LESSON_TOTALS } from '@hellokido/core/rules/lessonUsage.js'
import { useCatalog, useLabels } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import type { Option } from '../../ui/Choice'
import { FREE } from './rules'

// Order of the packages while the catalog loads (the catalog's sort order wins once it is here)
const FALLBACK_CODES = [
  'tek-seferlik',
  'hafta-1',
  'hafta-2',
  'hafta-3',
  'hafta-4',
  '3ay-hafta-1',
  '3ay-hafta-2',
  '3ay-yarim-hafta-1',
  '3ay-yarim-hafta-2',
  FREE
]

/** Package choices with their lesson count; hidden packages stay available for the row that uses one. */
export function usePackageOptions({ includeFree, current }: { includeFree: boolean; current?: string | null }) {
  const { t, plural } = useI18n()
  const labels = useLabels()
  const catalog = useCatalog().data
  return useMemo(() => {
    const rows = catalog?.packages.length
      ? catalog.packages.filter((row) => row.is_active || row.code === current).map((row) => ({ code: row.code, lessons: row.lessons }))
      : FALLBACK_CODES.map((code) => ({ code, lessons: (PACKAGE_LESSON_TOTALS as Record<string, number>)[code] ?? null }))
    return rows
      .filter((row) => includeFree || row.code !== FREE)
      .map(
        (row): Option => ({
          id: row.code,
          label: labels.packageName(row.code),
          description: row.code === FREE ? t.children.form.noQuota : row.lessons ? plural(t.children.form.lessons, row.lessons) : undefined
        })
      )
  }, [catalog, current, includeFree, labels, plural, t])
}

/** The package's usual price, if one is set in the catalog. */
export function usePackagePrice(code: string | null) {
  const catalog = useCatalog().data
  if (!code) return null
  const price = catalog?.packages.find((row) => row.code === code)?.default_price
  return price == null ? null : Number(price)
}
