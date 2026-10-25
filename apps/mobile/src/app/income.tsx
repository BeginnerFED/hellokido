import { useLocalSearchParams } from 'expo-router'
import { IncomeSheet } from '../features/payment/EditSheets'

export default function IncomeRoute() {
  const params = useLocalSearchParams<{ id?: string; collect?: string }>()
  return <IncomeSheet id={params.id || undefined} collect={params.collect === '1'} />
}
