import type { NativeStackNavigationOptions } from 'expo-router'
import type { Colors } from '../theme/colors'

/**
 * Every tab's stack: the title in the white bar with a hairline, over the warm canvas. Compact on
 * purpose: the iPhone's large title left an empty white band above the page (owner, 2026-10-25).
 */
export function stackOptions(c: Colors): NativeStackNavigationOptions {
  return {
    headerLargeTitleEnabled: false,
    headerShadowVisible: true,
    headerStyle: { backgroundColor: c.surface },
    headerTintColor: c.accentInk,
    headerTitleStyle: { color: c.ink },
    headerBackButtonDisplayMode: 'minimal',
    contentStyle: { backgroundColor: c.ground }
  }
}

/** A page pushed on top (a child, a lesson): a small title, the back arrow of the phone. */
export const detailOptions: NativeStackNavigationOptions = { headerLargeTitleEnabled: false, title: '' }
