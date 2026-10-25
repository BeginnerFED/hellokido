import type { NativeStackNavigationOptions } from 'expo-router'
import type { Colors } from '../theme/colors'
import { fontOf } from '../theme/fonts'

/**
 * Every tab's stack: a bar of the same paper as the page, with no rule under it, so the page reads
 * as one sheet. A tab root hides it and draws its own title in the page (Screen `title`); the bar
 * stays for the pages pushed on top. Compact on purpose: the iPhone's large title left an empty
 * band above the page (owner, 2026-10-25).
 */
export function stackOptions(c: Colors): NativeStackNavigationOptions {
  return {
    headerLargeTitleEnabled: false,
    headerShadowVisible: false,
    headerStyle: { backgroundColor: c.page },
    headerTintColor: c.accentInk,
    headerTitleStyle: { color: c.ink, ...fontOf('600') },
    headerBackButtonDisplayMode: 'minimal',
    contentStyle: { backgroundColor: c.page }
  }
}

/** A page pushed on top (a child, a lesson): a small title, the back arrow of the phone. */
export const detailOptions: NativeStackNavigationOptions = { headerLargeTitleEnabled: false, title: '' }
