import { Platform } from 'react-native'
import { requireOptionalNativeModule } from 'expo'
import Constants from 'expo-constants'
import { router } from 'expo-router'
import { registerPushDevice, unregisterPushDevice } from '@hellokido/core/api'

// The Android channel the server's notifications arrive on (the push message names it)
const CHANNEL = 'reminders'
// The 18:00 note the app used to plan itself; a phone updated over the air may still hold one
const OLD_LOCAL_REMINDER = 'tomorrow-reminders'

type NotificationsModule = typeof import('expo-notifications')

// The native parts expo-notifications asks for as it loads; an Expo Go older than the package lacks some
const NATIVE = [
  'ExpoBackgroundNotificationTasksModule',
  'ExpoBadgeModule',
  'ExpoNotificationCategoriesModule',
  'ExpoNotificationPermissionsModule',
  'ExpoNotificationPresenter',
  'ExpoNotificationScheduler',
  'ExpoNotificationsEmitter',
  'ExpoNotificationsHandlerModule',
  'ExpoPushTokenManager',
  'NotificationsServerRegistrationModule',
  // Channels and topics exist only on Android; asking for them on the iPhone left it never signed up
  ...(Platform.OS === 'android' ? ['ExpoNotificationChannelGroupManager', 'ExpoNotificationChannelManager', 'ExpoTopicSubscriptionModule'] : [])
]

let loading: Promise<NotificationsModule | null> | null = null

/**
 * The notifications module, loaded on first use. A phone app without its native part (an older
 * Expo Go) cannot load it; the evening reminder is then simply left out instead of the app failing.
 */
function notifications() {
  if (NATIVE.some((name) => !requireOptionalNativeModule(name))) return Promise.resolve(null)
  loading ??= import('expo-notifications')
    .then((module) => {
      // With the app open the note still shows as a banner, quietly
      module.setNotificationHandler({
        handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false })
      })
      // Tapping the note opens Today, where tomorrow's reminders are sent in order
      module.addNotificationResponseReceivedListener((response) => {
        const url = response.notification.request.content.data?.url
        if (typeof url === 'string') router.navigate(url as never)
      })
      return module
    })
    .catch(() => null)
  return loading
}

let registered: string | null = null

/**
 * Signs this phone up for the evening reminder the server sends (Settings › Messages). Asks for
 * permission the first time; a "no" is respected and nothing is registered.
 */
export async function registerForReminders({ locale, channel }: { locale: string; channel: string }) {
  try {
    const module = await notifications()
    if (!module) return
    await module.cancelScheduledNotificationAsync(OLD_LOCAL_REMINDER).catch(() => {})
    const current = await module.getPermissionsAsync()
    const granted = current.granted || (current.canAskAgain && (await module.requestPermissionsAsync()).granted)
    if (!granted) return
    if (Platform.OS === 'android') await module.setNotificationChannelAsync(CHANNEL, { name: channel, importance: module.AndroidImportance.DEFAULT })
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined
    const { data: token } = await module.getExpoPushTokenAsync(projectId ? { projectId } : undefined)
    await registerPushDevice(token, locale, Platform.OS === 'ios' ? 'ios' : 'android')
    registered = token
  } catch {
    // No reminder on this phone is not worth an error on the screen; the next start tries again
  }
}

/** Takes this phone off the list before signing out; never holds the sign-out up for long. */
export async function forgetThisPhone() {
  const token = registered
  if (!token) return
  registered = null
  await Promise.race([unregisterPushDevice(token).catch(() => {}), new Promise((resolve) => setTimeout(resolve, 3000))])
}
