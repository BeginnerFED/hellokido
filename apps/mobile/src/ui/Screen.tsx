import { Children, Fragment, isValidElement, useCallback, useState, type ReactNode, type Ref } from 'react'
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ScrollViewInstance,
  type StyleProp,
  type ViewStyle
} from 'react-native'
import { useColors } from '../theme/colors'
import { Icon } from './Icon'
import { OfflineNotice } from './OfflineNotice'
import { Text } from './Text'

/** Pull to refresh that spins only for the person's own pull, not for every background read. */
export function usePullRefresh(refresh: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false)
  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await refresh()
    } finally {
      setRefreshing(false)
    }
  }, [refresh])
  return { refreshing, onRefresh }
}

type ScreenProps = {
  children: ReactNode
  onRefresh?: () => Promise<unknown>
  scrollRef?: Ref<ScrollViewInstance>
  /** Space between the sections; the title bar above is the system's own. */
  gap?: number
}

/** A tab's page: scrolls under the title bar, with pull to refresh when it has data to read again. */
export function Screen({ children, onRefresh, scrollRef, gap = 30 }: ScreenProps) {
  const c = useColors()
  const pull = usePullRefresh(onRefresh ?? (async () => undefined))
  return (
    <ScrollView
      ref={scrollRef}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag"
      style={{ backgroundColor: c.ground }}
      contentContainerStyle={[styles.content, { gap }]}
      refreshControl={
        onRefresh ? (
          // Android draws its spinner on a disc of its own, which stays white in the dark theme unless told
          <RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={c.ink3} colors={[c.accent]} progressBackgroundColor={c.surface} />
        ) : undefined
      }
    >
      <OfflineNotice />
      {children}
    </ScrollView>
  )
}

type SectionProps = {
  title?: ReactNode
  /** A count or short note at the right of the title. */
  aside?: ReactNode
  /** A line under the title. */
  description?: string
  children?: ReactNode
  onLayout?: (event: LayoutChangeEvent) => void
  style?: StyleProp<ViewStyle>
}

export function Section({ title, aside, description, children, onLayout, style }: SectionProps) {
  return (
    <View onLayout={onLayout} style={style}>
      {title !== undefined && (
        <View style={styles.sectionHead}>
          <View accessibilityRole="header" style={styles.sectionTitle}>
            {typeof title === 'string' ? <Text variant="section">{title}</Text> : title}
          </View>
          {aside !== undefined && (typeof aside === 'string' || typeof aside === 'number' ? (
            <Text variant="sub" tone="ink3" tabular>
              {aside}
            </Text>
          ) : (
            aside
          ))}
        </View>
      )}
      {description && (
        <Text variant="foot" tone="ink2" style={styles.description}>
          {description}
        </Text>
      )}
      {children}
    </View>
  )
}

/** A white card with a hairline edge; the rows inside are divided by lighter rules that start after their tiles. */
export function Card({ children, inset = 16, style }: { children: ReactNode; inset?: number; style?: StyleProp<ViewStyle> }) {
  const c = useColors()
  const items = Children.toArray(children).filter((child) => isValidElement(child) || typeof child === 'string')
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }, style]}>
      {items.map((child, index) => (
        <Fragment key={isValidElement(child) && child.key != null ? child.key : index}>
          {index > 0 && <View style={[styles.separator, { marginLeft: inset, backgroundColor: c.line2 }]} />}
          {child}
        </Fragment>
      ))}
    </View>
  )
}

type RowProps = {
  leading?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  trailing?: ReactNode
  onPress?: () => void
  chevron?: boolean
  accessibilityLabel?: string
  /** Rows that hold more than one line of controls set their own padding. */
  style?: StyleProp<ViewStyle>
}

/** One line of a card: a peg or icon, the words, and what can be done with it. */
export function Row({ leading, title, subtitle, trailing, onPress, chevron, accessibilityLabel, style }: RowProps) {
  const c = useColors()
  const body = (
    <>
      {leading}
      <View style={styles.rowText}>
        {typeof title === 'string' ? (
          <Text variant="body" numberOfLines={1}>
            {title}
          </Text>
        ) : (
          title
        )}
        {subtitle !== undefined &&
          (typeof subtitle === 'string' ? (
            <Text variant="foot" tone="ink3" numberOfLines={2}>
              {subtitle}
            </Text>
          ) : (
            subtitle
          ))}
      </View>
      {trailing}
      {chevron && <Icon name="chevronRight" size={13} color={c.ink3} weight="semibold" />}
    </>
  )
  if (!onPress) return <View style={[styles.row, style]}>{body}</View>
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.pressed }, style]}
    >
      {body}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 40 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 10, paddingHorizontal: 4 },
  sectionTitle: { flex: 1, minWidth: 0 },
  description: { marginTop: -4, marginBottom: 10, paddingHorizontal: 4 },
  card: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  separator: { height: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 56 },
  rowText: { flex: 1, minWidth: 0, gap: 1 }
})
