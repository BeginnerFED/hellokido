import { useLocalSearchParams } from 'expo-router'
import { WaitlistSheet } from '../features/waitlist/WaitlistSheet'

export default function WaitlistEntryRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  return <WaitlistSheet id={id || undefined} />
}
