import { useLocalSearchParams } from 'expo-router'
import { CategorySheet } from '../features/settings/CategorySheet'

export default function CategoryRoute() {
  const { kind, code } = useLocalSearchParams<{ kind?: string; code?: string }>()
  return <CategorySheet kind={kind === 'income' ? 'income' : 'expense'} code={code || undefined} />
}
