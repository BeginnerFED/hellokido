import type { NativeStackNavigationOptions } from 'expo-router'
import type { Colors } from '../theme/colors'

/** Every tab's stack: the phone's large title on a white header with a hairline, over the warm canvas. */
export function stackOptions(c: Colors): NativeStackNavigationOptions {
  return {
    headerLargeTitleEnabled: true,
    headerShadowVisible: true,
    headerLargeTitleShadowVisible: true,
    headerStyle: { backgroundColor: c.surface },
    headerLargeStyle: { backgroundColor: c.surface },
    headerTintColor: c.accentInk,
    headerTitleStyle: { color: c.ink },
    headerLargeTitleStyle: { color: c.ink },
    headerBackButtonDisplayMode: 'minimal',
    contentStyle: { backgroundColor: c.ground }
  }
}

/** A page pushed on top (a child, a lesson): a small title, the back arrow of the phone. */
export const detailOptions: NativeStackNavigationOptions = { headerLargeTitleEnabled: false, title: '' }
