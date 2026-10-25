import { useLocalSearchParams } from 'expo-router'
import { PackageSheet } from '../features/settings/PackageSheet'

export default function PackageRoute() {
  const { code } = useLocalSearchParams<{ code: string }>()
  return <PackageSheet code={code ?? ''} />
}
