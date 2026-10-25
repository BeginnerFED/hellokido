import { useLocalSearchParams } from 'expo-router'
import { RecurringSheet } from '../features/finance/RecurringSheet'

export default function RecurringRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  return <RecurringSheet id={id || undefined} />
}
