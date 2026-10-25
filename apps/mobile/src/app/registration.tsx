import { useLocalSearchParams } from 'expo-router'
import { RegistrationSheet } from '../features/children/RegistrationSheet'

export default function RegistrationRoute() {
  const params = useLocalSearchParams<{ id?: string; waitlistId?: string }>()
  return <RegistrationSheet id={params.id || undefined} waitlistId={params.waitlistId || undefined} />
}
