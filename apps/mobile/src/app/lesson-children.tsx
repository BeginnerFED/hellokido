import { useLocalSearchParams } from 'expo-router'
import { LessonChildrenSheet } from '../features/calendar/LessonChildrenSheet'

export default function LessonChildrenRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <LessonChildrenSheet id={id} />
}
