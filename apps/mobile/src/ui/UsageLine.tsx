import { StyleSheet, View } from 'react-native'
import { remainingTone, type Usage } from '@hellokido/core/api'
import { beadsLabel, lessonTitle, remainingText } from '@hellokido/core/view'
import { useLabels } from '../data/queries'
import { useI18n } from '../providers/I18n'
import { Skeleton } from './Bits'
import { BeadString } from './signature'
import { Text } from './Text'

/** Beads with the remaining count next to them; free participation shows the word instead. */
export function UsageLine({ usage, size = 'sm' }: { usage: Usage | undefined; size?: 'sm' | 'md' }) {
  const i18n = useI18n()
  if (!usage) return <Skeleton height={12} width={120} radius={6} />
  const tone = remainingTone(usage)
  // Running low and running out both ask for a new package: the colour of things to act on, not of danger
  const ink = tone === 'out' || tone === 'low' ? 'actionInk' : 'ink3'
  return (
    <View style={styles.line}>
      <BeadString usage={usage} size={size} label={beadsLabel(i18n, usage)} />
      <Text variant="foot" weight="500" tone={usage.isFree ? 'ink3' : ink} tabular numberOfLines={1}>
        {remainingText(i18n, usage)}
      </Text>
    </View>
  )
}

/** "İngilizce", or the name of a special event. */
export function useLessonTitle() {
  const labels = useLabels()
  return (lesson: { event_type: string; custom_description: string | null }) => lessonTitle(labels, lesson)
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 9, rowGap: 3, minWidth: 0 }
})
