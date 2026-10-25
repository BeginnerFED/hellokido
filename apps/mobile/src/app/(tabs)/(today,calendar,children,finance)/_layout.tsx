import { Stack } from 'expo-router'
import { detailOptions, stackOptions } from '../../../lib/stack'
import { useI18n } from '../../../providers/I18n'
import { useColors } from '../../../theme/colors'

// Four tabs share these pages: each opens on its own first page and pushes children and lessons on top
export const unstable_settings = {
  today: { anchor: 'index' },
  calendar: { anchor: 'calendar' },
  children: { anchor: 'children' },
  finance: { anchor: 'finance' }
}

export default function SharedStack() {
  const c = useColors()
  const { t } = useI18n()
  return (
    <Stack screenOptions={stackOptions(c)}>
      <Stack.Screen name="index" options={{ title: t.today.title }} />
      <Stack.Screen name="calendar" options={{ title: t.shell.nav.calendar }} />
      <Stack.Screen name="children" options={{ title: t.shell.nav.children }} />
      <Stack.Screen name="finance" options={{ title: t.shell.nav.finance }} />
      <Stack.Screen name="child/[id]" options={detailOptions} />
      <Stack.Screen name="lesson/[id]" options={detailOptions} />
    </Stack>
  )
}
