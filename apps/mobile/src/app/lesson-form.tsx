import { useLocalSearchParams } from 'expo-router'
import { LessonFormSheet } from '../features/calendar/LessonFormSheet'

export default function LessonFormRoute() {
  const params = useLocalSearchParams<{ id?: string; day?: string; copy?: string }>()
  return <LessonFormSheet params={{ id: params.id || undefined, day: params.day || undefined, copy: params.copy === '1' }} />
}
