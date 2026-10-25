import { Platform } from 'react-native'
import { requireOptionalNativeModule } from 'expo'

// One notification at most, always under the same name, so a new plan replaces the old one
const ID = 'tomorrow-reminders'
const CHANNEL = 'reminders'
const HOUR = 18

type NotificationsModule = typeof import('expo-notifications')

// The native parts expo-notifications asks for as it loads; an Expo Go older than the package lacks some
const NATIVE = [
  'ExpoBackgroundNotificationTasksModule',
  'ExpoBadgeModule',
  'ExpoNotificationCategoriesModule',
  'ExpoNotificationChannelGroupManager',
  'ExpoNotificationChannelManager',
  'ExpoNotificationPermissionsModule',
  'ExpoNotificationPresenter',
  'ExpoNotificationScheduler',
  'ExpoNotificationsEmitter',
  'ExpoNotificationsHandlerModule',
  'ExpoPushTokenManager',
  'NotificationsServerRegistrationModule',
  ...(Platform.OS === 'android' ? ['ExpoTopicSubscriptionModule'] : [])
]

let loading: Promise<NotificationsModule | null> | null = null

/**
 * The notifications module, loaded on first use. A phone app without its native part (an older
 * Expo Go) cannot load it; the evening nudge is then simply left out instead of the app failing.
 */
function notifications() {
  if (NATIVE.some((name) => !requireOptionalNativeModule(name))) return Promise.resolve(null)
  loading ??= import('expo-notifications')
    .then((module) => {
      // With the app open the note still shows as a banner, quietly
      module.setNotificationHandler({
        handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false })
      })
      return module
    })
    .catch(() => null)
  return loading
}

let asked = false

async function allowed(module: NotificationsModule) {
  const current = await module.getPermissionsAsync()
  if (current.granted) return true
  // The phone asks once, the first time there is something to remind about; a "no" is respected
  if (asked || !current.canAskAgain) return false
  asked = true
  return (await module.requestPermissionsAsync()).granted
}

/**
 * The evening nudge: at 18:00, when some of tomorrow's families have not been reminded yet. It is
 * planned again whenever the count changes, so it always says the latest number, and it is taken
 * back once everyone was reminded or the evening has passed.
 */
export async function planEveningReminder({ now, unsent, channel, title, body }: { now: Date; unsent: number; channel: string; title: string; body: string }) {
  try {
    const module = await notifications()
    if (!module) return
    await module.cancelScheduledNotificationAsync(ID)
    const at = new Date(now)
    at.setHours(HOUR, 0, 0, 0)
    if (unsent === 0 || at.getTime() <= now.getTime()) return
    if (!(await allowed(module))) return
    if (Platform.OS === 'android') await module.setNotificationChannelAsync(CHANNEL, { name: channel, importance: module.AndroidImportance.DEFAULT })
    await module.scheduleNotificationAsync({
      identifier: ID,
      content: { title, body },
      trigger: { type: module.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL }
    })
  } catch {
    // A missed nudge is not worth an error on the screen
  }
}
