import { useLocalSearchParams } from 'expo-router'
import { ExpenseSheet } from '../features/expense/ExpenseSheet'

export default function ExpenseRoute() {
  const params = useLocalSearchParams<{ id?: string; templateId?: string; day?: string }>()
  return <ExpenseSheet params={{ id: params.id || undefined, templateId: params.templateId || undefined, day: params.day || undefined }} />
}
