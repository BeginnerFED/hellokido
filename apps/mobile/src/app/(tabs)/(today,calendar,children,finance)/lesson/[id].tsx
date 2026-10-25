import { useLocalSearchParams } from 'expo-router'
import { LessonScreen } from '../../../../features/calendar/LessonScreen'

export default function LessonRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <LessonScreen id={id} />
}
