import { useLocalSearchParams } from 'expo-router'
import { MessageTemplateSheet } from '../features/settings/MessageTemplateSheet'

export default function MessageTemplateRoute() {
  const { id, kind } = useLocalSearchParams<{ id?: string; kind?: string }>()
  return <MessageTemplateSheet id={id || undefined} kind={kind || undefined} />
}
