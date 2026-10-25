import { useLocalSearchParams } from 'expo-router'
import { ChildDetailScreen } from '../../../../features/children/ChildDetailScreen'

export default function ChildRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <ChildDetailScreen id={id} />
}
