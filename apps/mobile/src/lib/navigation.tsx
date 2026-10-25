import { useCallback } from 'react'
import { Platform } from 'react-native'
import { router, useSegments, type Href } from 'expo-router'
import type { NativeStackNavigationOptions } from 'expo-router'
import type { Colors } from '../theme/colors'
import { IconButton } from '../ui/Button'
import { symbolOf, type IconName } from '../ui/Icon'
import type { MenuItem } from '../ui/ActionMenu'

/** The tab the person is in, so a child or lesson opens on top of it and back returns there. */
function useTab(): '(today)' | '(calendar)' | '(children)' | '(finance)' {
  const segments = useSegments() as string[]
  const tab = segments[1]
  return tab === '(calendar)' || tab === '(children)' || tab === '(finance)' ? tab : '(today)'
}

export function useOpenChild() {
  const tab = useTab()
  return useCallback((id: string) => router.push(`/(tabs)/${tab}/child/${id}` as Href), [tab])
}

export function useOpenLesson() {
  const tab = useTab()
  return useCallback((id: string) => router.push(`/(tabs)/${tab}/lesson/${id}` as Href), [tab])
}

const openSheet = (pathname: string, params: Record<string, string | undefined> = {}) =>
  router.push({ pathname, params: Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined)) } as Href)

/** The task sheets, with what they need to know to open on the right step. */
export const tasks = {
  payment: (params: { registrationId?: string; choice?: 'collect' | 'renew' | 'instalment' | 'fee'; entryId?: string } = {}) => openSheet('/payment', params),
  /** A new child, or the details of one (`id`); `waitlistId` starts from a family on the waitlist. */
  registration: (params: { id?: string; waitlistId?: string } = {}) => openSheet('/registration', params),
  /** Corrects the latest package payment of a child. */
  extensionEdit: (registrationId: string) => openSheet('/extension-edit', { registrationId }),
  /** An income entry to correct (`id`; `collect` when expected money came in), or new income of the workshop. */
  income: ({ id, collect }: { id?: string; collect?: boolean } = {}) => openSheet('/income', { id, collect: collect ? '1' : undefined }),
  expense: (params: { id?: string; templateId?: string; day?: string } = {}) => openSheet('/expense', params),
  /** A monthly expense to set up, or one to change (`id`). */
  recurring: (id?: string) => openSheet('/recurring', { id }),
  note: (id?: string) => openSheet('/note', { id }),
  waitlist: (id?: string) => openSheet('/waitlist-entry', { id }),
  /** The price and names of a package. */
  packageType: (code: string) => openSheet('/package', { code }),
  /** An expense or income category to rename or hide (`code`), or a new one. */
  category: (kind: 'expense' | 'income', code?: string) => openSheet('/category', { kind, code }),
  cardSettings: () => openSheet('/card-settings'),
  grantAccess: () => openSheet('/grant-access'),
  /** A new lesson on a day ('yyyy-MM-dd'), the day and kind of one (`id`), or a copy of it (`copy`). */
  lesson: ({ id, day, copy }: { id?: string; day?: string; copy?: boolean } = {}) => openSheet('/lesson-form', { id, day, copy: copy ? '1' : undefined }),
  /** Children to add to a lesson. */
  lessonChildren: (id: string) => openSheet('/lesson-children', { id }),
  /** The theme of the week starting on this Monday ('yyyy-MM-dd'). */
  weekTheme: (week: string) => openSheet('/week-theme', { week })
}

/**
 * A button in the navigation bar that opens a menu ("+" by default): the iPhone's own menu under
 * the button; on Android the action sheet passed in.
 */
export function headerMenu(
  c: Colors,
  label: string,
  items: MenuItem[],
  openOnAndroid: (items: MenuItem[]) => void,
  icon: IconName = 'add'
): NativeStackNavigationOptions {
  if (Platform.OS === 'ios') {
    return {
      unstable_headerRightItems: () => [
        {
          type: 'menu',
          label,
          icon: { type: 'sfSymbol', name: symbolOf(icon).ios },
          menu: {
            items: items.map((item) => ({
              type: 'action' as const,
              label: item.label,
              icon: item.icon ? { type: 'sfSymbol' as const, name: symbolOf(item.icon).ios } : undefined,
              destructive: item.destructive,
              onPress: item.onPress
            }))
          }
        }
      ]
    }
  }
  return { headerRight: () => <IconButton icon={icon} label={label} variant="plain" size={40} color={c.accentInk} onPress={() => openOnAndroid(items)} /> }
}

export function headerButton(c: Colors, label: string, icon: IconName, onPress: () => void): NativeStackNavigationOptions {
  if (Platform.OS === 'ios') {
    return { unstable_headerRightItems: () => [{ type: 'button', label, icon: { type: 'sfSymbol', name: symbolOf(icon).ios }, onPress }] }
  }
  return { headerRight: () => <IconButton icon={icon} label={label} variant="plain" size={40} color={c.accentInk} onPress={onPress} /> }
}
