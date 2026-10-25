import type { Catalog } from '../api'
import type { Locale, Messages } from '../i18n'

type Named = { code: string; name_tr: string; name_en: string; name_uk: string }

/** Names of codes: the catalog's own names first, the built-in labels while it loads. */
export function makeLabels(t: Messages, locale: Locale, catalog: Catalog | undefined) {
  const pick = (row: Named | undefined, fallback: Record<string, string>, code: string) => {
    if (row) return locale === 'tr' ? row.name_tr : locale === 'uk' ? row.name_uk : row.name_en
    return fallback[code] ?? code
  }
  const find = <T extends Named>(list: T[] | undefined, code: string) => list?.find((row) => row.code === code)
  return {
    packageName: (code: string | null | undefined) => (code ? pick(find(catalog?.packages, code), t.labels.packages, code) : ''),
    expenseCategory: (code: string | null | undefined) => (code ? pick(find(catalog?.expenseCategories, code), t.labels.expenseTypes, code) : ''),
    incomeCategory: (code: string | null | undefined) => (code ? pick(find(catalog?.incomeCategories, code), t.labels.incomeCategories, code) : ''),
    method: (code: string | null | undefined) => (code ? (t.labels.methods[code] ?? code) : ''),
    paymentStatus: (code: string | null | undefined) => (code ? (t.labels.paymentStatus[code] ?? code) : ''),
    attendance: (code: string | null | undefined) => (code ? (t.labels.attendance[code] ?? code) : ''),
    lessonType: (code: string | null | undefined) => (code ? (t.labels.lessonTypes[code] ?? code) : ''),
    ageGroup: (code: string | null | undefined) => (code ? (t.labels.ageGroups[code] ?? code) : '')
  }
}

export type Labels = ReturnType<typeof makeLabels>

/** "İngilizce", or the name of a special event. */
export const lessonTitle = (labels: Labels, lesson: { event_type: string; custom_description: string | null }) =>
  lesson.event_type === 'ozel' && lesson.custom_description ? lesson.custom_description : labels.lessonType(lesson.event_type)
