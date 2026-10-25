import type { Registration } from '../api'

export type UsageRow = Pick<Registration, 'id' | 'package_type' | 'package_start_date' | 'package_end_date' | 'extra_lessons'>

/** Short fingerprint of the fields usage is computed from, so a changed package reads again. */
export function usageFingerprint(rows: UsageRow[]) {
  let hash = 5381
  for (const row of rows) {
    const text = `${row.id}|${row.package_type}|${row.package_start_date}|${row.package_end_date}|${row.extra_lessons};`
    for (let i = 0; i < text.length; i += 1) hash = (hash * 33) ^ text.charCodeAt(i)
  }
  return `${rows.length}:${(hash >>> 0).toString(36)}`
}
