import { tr as trDate, enGB as enDate, uk as ukDate } from 'date-fns/locale'
import type { Locale as DateLocale } from 'date-fns'
import type { Plural } from './types'
import { groups } from './messages'

export type { Plural } from './types'

export type Locale = 'tr' | 'en' | 'uk'
export const LOCALES: Locale[] = ['tr', 'en', 'uk']

type Groups = typeof groups
export type Messages = { [G in keyof Groups]: Groups[G]['tr'] }

const build = (locale: Locale) =>
  Object.fromEntries(Object.entries(groups).map(([name, group]) => [name, group[locale]])) as Messages

export const messages: Record<Locale, Messages> = { tr: build('tr'), en: build('en'), uk: build('uk') }

export const LOCALE_TAGS: Record<Locale, string> = { tr: 'tr-TR', en: 'en-GB', uk: 'uk-UA' }
export const DATE_LOCALES: Record<Locale, DateLocale> = { tr: trDate, en: enDate, uk: ukDate }
export const LANGUAGE_NAMES: Record<Locale, string> = { tr: 'Türkçe', en: 'English', uk: 'Українська' }

export const isLocale = (value: unknown): value is Locale => value === 'tr' || value === 'en' || value === 'uk'

/** Replaces {name} placeholders. */
export function fmt(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => (key in vars ? String(vars[key]) : `{${key}}`))
}

const pluralRules = new Map<Locale, Intl.PluralRules>()

// The phone app's JavaScript engine may come without Intl.PluralRules. These are the CLDR rules of
// the three interface languages for whole numbers; anything else takes "other", as CLDR does.
function pluralCategory(locale: Locale, count: number): keyof Plural {
  if (typeof Intl !== 'undefined' && typeof Intl.PluralRules === 'function') {
    let rules = pluralRules.get(locale)
    if (!rules) {
      rules = new Intl.PluralRules(LOCALE_TAGS[locale])
      pluralRules.set(locale, rules)
    }
    return rules.select(count) as keyof Plural
  }
  const n = Math.abs(count)
  if (!Number.isInteger(n)) return 'other'
  if (locale !== 'uk') return n === 1 ? 'one' : 'other'
  const last = n % 10
  const lastTwo = n % 100
  if (last === 1 && lastTwo !== 11) return 'one'
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return 'few'
  return 'many'
}

/** Picks the plural form for `count` and fills {count} and the other placeholders. */
export function plural(locale: Locale, forms: Plural, count: number, vars: Record<string, string | number> = {}): string {
  const template = forms[pluralCategory(locale, count)] ?? forms.other
  return fmt(template, { count, ...vars })
}

/** Turkish-aware upper/lower case for the active language. */
export const upper = (locale: Locale, text: string) => text.toLocaleUpperCase(LOCALE_TAGS[locale])
export const lower = (locale: Locale, text: string) => text.toLocaleLowerCase(LOCALE_TAGS[locale])
