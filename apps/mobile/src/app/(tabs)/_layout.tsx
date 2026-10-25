import { Platform } from 'react-native'
import { NativeTabs } from 'expo-router/native-tabs'
import { useI18n } from '../../providers/I18n'
import { useColors } from '../../theme/colors'

// The app opens on Today; without this the router picks the group with the shortest name (More)
export const unstable_settings = { anchor: '(today)' }

const android = Platform.OS === 'android'

/**
 * The phone's own tab bar: the five places of the panel, each with its own stack of pages. On the
 * iPhone it is the system's floating glass bar, only tinted; Android's bar is drawn close to it:
 * the page's paper, ink words and a soft pill behind the chosen tab.
 */
export default function TabsLayout() {
  const c = useColors()
  const { t } = useI18n()
  return (
    <NativeTabs
      tintColor={c.tabTint}
      iconColor={android ? { default: c.ink2, selected: c.tabTint } : undefined}
      labelStyle={android ? { default: { color: c.ink2 }, selected: { color: c.tabTint } } : undefined}
      backgroundColor={android ? c.page : undefined}
      indicatorColor={android ? c.felt : undefined}
      // Every tab keeps its name on Android too; the iPhone always shows them
      labelVisibilityMode="labeled"
      minimizeBehavior="never"
      // Android's back from another tab returns to Today before it leaves the app
      backBehavior="initialRoute"
    >
      <NativeTabs.Trigger name="(today)">
        <NativeTabs.Trigger.Icon sf={{ default: 'sun.max', selected: 'sun.max.fill' }} md="sunny" />
        <NativeTabs.Trigger.Label>{t.shell.nav.today}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(calendar)">
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
        <NativeTabs.Trigger.Label>{t.shell.nav.calendar}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(children)">
        <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} md="group" />
        <NativeTabs.Trigger.Label>{t.shell.nav.children}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(finance)">
        <NativeTabs.Trigger.Icon sf={{ default: 'turkishlirasign.circle', selected: 'turkishlirasign.circle.fill' }} md="account_balance_wallet" />
        <NativeTabs.Trigger.Label>{t.shell.nav.finance}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(more)">
        <NativeTabs.Trigger.Icon sf={{ default: 'ellipsis.circle', selected: 'ellipsis.circle.fill' }} md="more_horiz" />
        <NativeTabs.Trigger.Label>{t.shell.nav.more}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
