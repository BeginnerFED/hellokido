import type { Locale } from '../i18n'
import { foldForSearch } from '../rules/text.js'

export const MAX_SETTLEMENT_DAYS = 120

/** Whole days from 0 to 120: 0 means the bank credits a card payment the same day. */
export function parseDays(text: string) {
  const value = text.trim()
  if (!/^\d{1,3}$/.test(value)) return null
  const days = Number(value)
  return days <= MAX_SETTLEMENT_DAYS ? days : null
}

/**
 * A commission rate in percent. A rate never needs a thousands mark, so one comma or dot is
 * always the decimal one: "2,49", "2.49" and "%2,49" all read as 2.49. Empty means none.
 */
export function parseRate(text: string) {
  const value = text.replace(/[\s%]/g, '').replace(',', '.')
  if (!value) return 0
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(value)) return null
  return Number(value)
}

/** The rate as it is written in the language on screen (2,49 in Turkish and Ukrainian). */
export const rateText = (rate: number, locale: Locale) => (locale === 'en' ? String(rate) : String(rate).replace('.', ','))

export type Names = { tr: string; en: string; uk: string }
type Named = { name_tr: string; name_en: string; name_uk: string }

export const namesOf = (row: Named | null): Names => ({
  tr: row?.name_tr ?? '',
  en: row?.name_en ?? '',
  uk: row?.name_uk ?? ''
})

/** Names as they are saved: trimmed, and a language left empty gets the Turkish name (none may be blank). */
export function filledNames(names: Names) {
  const tr = names.tr.trim()
  return { name_tr: tr, name_en: names.en.trim() || tr, name_uk: names.uk.trim() || tr }
}

/** The name in the language on screen. */
export const localName = (row: Named, locale: Locale) => (locale === 'tr' ? row.name_tr : locale === 'uk' ? row.name_uk : row.name_en)

const CASE_TAGS: Record<keyof Names, string> = { tr: 'tr-TR', en: 'en-GB', uk: 'uk-UA' }

/** A capital first letter by the rules of the name's own language ("internet" stays "Internet" in English). */
export const capitalFirst = (text: string, lang: keyof Names) => (text ? text.charAt(0).toLocaleUpperCase(CASE_TAGS[lang]) + text.slice(1) : text)

export const sameName = (a: string, b: string) => foldForSearch(a) === foldForSearch(b)
