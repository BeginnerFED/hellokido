import { useLocalSearchParams } from 'expo-router'
import { NoteSheet } from '../features/notes/NoteSheet'

export default function NoteRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  return <NoteSheet id={id || undefined} />
}
