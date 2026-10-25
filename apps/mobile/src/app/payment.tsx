import { useLocalSearchParams } from 'expo-router'
import { PaymentSheet, type PaymentChoice } from '../features/payment/PaymentSheet'

const CHOICES: PaymentChoice[] = ['renew', 'instalment', 'collect', 'fee']

export default function PaymentRoute() {
  const params = useLocalSearchParams<{ registrationId?: string; choice?: string; entryId?: string }>()
  const choice = CHOICES.find((item) => item === params.choice)
  return <PaymentSheet params={{ registrationId: params.registrationId || undefined, choice, entryId: params.entryId || undefined }} />
}
