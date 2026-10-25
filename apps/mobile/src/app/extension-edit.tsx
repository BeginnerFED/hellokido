import { useLocalSearchParams } from 'expo-router'
import { ExtensionEditSheet } from '../features/payment/EditSheets'

export default function ExtensionEditRoute() {
  const { registrationId } = useLocalSearchParams<{ registrationId: string }>()
  return <ExtensionEditSheet registrationId={registrationId} />
}
