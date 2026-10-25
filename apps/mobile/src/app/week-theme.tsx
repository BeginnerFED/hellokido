import { useLocalSearchParams } from 'expo-router'
import { WeekThemeSheet } from '../features/calendar/WeekThemeSheet'

export default function WeekThemeRoute() {
  const { week } = useLocalSearchParams<{ week: string }>()
  return <WeekThemeSheet week={week} />
}
