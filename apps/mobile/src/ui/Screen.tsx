import { Children, createContext, Fragment, isValidElement, useCallback, useContext, useState, type ReactNode, type Ref } from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
  type StyleProp,
  type ViewStyle
} from 'react-native'
import { Stack } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { typeTone, useColors, type TileTone } from '../theme/colors'
import { IconButton } from './Button'
import { Icon, type IconName } from './Icon'
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
  /** Space between the sections (22, the room a section head asks above it). */
  gap?: number
  /**
   * A tab root's own title (30pt, in the page). With it the system bar is hidden and the screen
   * draws its header: the title, one line under it and round buttons at the right.
   */
  title?: string
  subtitle?: ReactNode
  /** Round buttons at the right of the title (`RoundButton`), or a small segmented control. */
  actions?: ReactNode
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
}

/**
 * A page: plain paper that scrolls, with pull to refresh when it has data to read again. A tab
 * root passes `title` and draws its header in the page; a pushed page keeps the system bar.
 */
export function Screen({ children, onRefresh, scrollRef, gap = 22, title, subtitle, actions, onScroll }: ScreenProps) {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const pull = usePullRefresh(onRefresh ?? (async () => undefined))
  const own = title !== undefined
  // The iPhone keeps the page under the status bar by itself; Android's page starts at the very top
  const top = own && Platform.OS === 'android' ? insets.top : 0
  return (
    <View style={[styles.flex, { backgroundColor: c.page }]}>
      {own && <Stack.Screen options={{ headerShown: false }} />}
      <ScrollView
        ref={scrollRef}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        // A button pressed while the keyboard is up (a search's clear) works on the first tap
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={onScroll ? 32 : undefined}
        style={{ backgroundColor: c.page }}
        contentContainerStyle={[styles.content, { paddingTop: own ? top : 16 }]}
        refreshControl={
          onRefresh ? (
            // Android draws its spinner on a disc of its own, which stays white in the dark theme unless told
            <RefreshControl
              refreshing={pull.refreshing}
              onRefresh={pull.onRefresh}
              tintColor={c.ink3}
              colors={[c.accent]}
              progressBackgroundColor={c.raised}
              progressViewOffset={top}
            />
          ) : undefined
        }
      >
        {own && <ScreenHeader title={title} subtitle={subtitle} actions={actions} />}
        <View style={{ gap }}>
          <OfflineNotice />
          {children}
        </View>
      </ScrollView>
      {/* What scrolls up passes under the status bar on plain paper, not under the clock */}
      {own && <View pointerEvents="none" style={[styles.statusCover, { height: insets.top, backgroundColor: c.page }]} />}
    </View>
  )
}

/** A tab root's header in the page: the title (30pt), one line under it, round buttons at the right. */
export function ScreenHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerWords}>
        <Text variant="title" accessibilityRole="header" numberOfLines={2}>
          {title}
        </Text>
        {subtitle !== undefined &&
          subtitle !== null &&
          (typeof subtitle === 'string' ? (
            <Text tone="ink2" numberOfLines={2} style={styles.headerSub}>
              {subtitle}
            </Text>
          ) : (
            subtitle
          ))}
      </View>
      {actions !== undefined && <View style={styles.headerActions}>{actions}</View>}
    </View>
  )
}

/** The 44pt round button of an in-content header ("+"), floating over the page. */
export function RoundButton({ icon, label, onPress, disabled }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  return <IconButton icon={icon} label={label} onPress={onPress} disabled={disabled} variant="glass" size={44} />
}

type SectionProps = {
  title?: ReactNode
  /** A count or short note at the right of the title, in muted words. */
  aside?: ReactNode
  /** A line under the title. */
  description?: string
  children?: ReactNode
  onLayout?: (event: LayoutChangeEvent) => void
  style?: StyleProp<ViewStyle>
}

/** A part of a content page: its head (20pt, a muted count at the right), then its card. */
export function Section({ title, aside, description, children, onLayout, style }: SectionProps) {
  return (
    <View onLayout={onLayout} style={style}>
      {title !== undefined && <SectionHead title={title} aside={aside} />}
      {description && (
        <Text variant="sub" tone="ink2" style={styles.description}>
          {description}
        </Text>
      )}
      {children}
    </View>
  )
}

/** A section's head on its own: the title at the left, a count or note at the right on the same baseline. */
export function SectionHead({ title, aside }: { title: ReactNode; aside?: ReactNode }) {
  return (
    <View style={styles.sectionHead}>
      <View accessibilityRole="header" style={styles.sectionTitle}>
        {typeof title === 'string' ? <Text variant="section">{title}</Text> : title}
      </View>
      {aside !== undefined &&
        aside !== null &&
        (typeof aside === 'string' || typeof aside === 'number' ? (
          <Text tone="ink3" tabular style={styles.aside}>
            {aside}
          </Text>
        ) : (
          aside
        ))}
    </View>
  )
}

// Fields read this to draw themselves as one row of the card they are in, or as a card of their own
const InCard = createContext(false)

/** True inside a Card: a field is then one of its rows, not a card of its own. */
export const useInCard = () => useContext(InCard)

/** Where the rule under a row starts. Rules now run across the card's content, as on the felt board. */
export const TILE_INSET = 16

type CardProps = {
  children: ReactNode
  /** Where the rules between the rows start (16, the content's edge). */
  inset?: number
  style?: StyleProp<ViewStyle>
  /** A lesson's own card: the felt of its type ('ingilizce', 'duyusal', 'ozel'). */
  type?: string
  /** A card of content rather than rows: 18pt all round. */
  padded?: boolean
}

/**
 * A felt card: filled, with no edge and no shadow, 26pt round. Its rows are divided by 1px rules
 * across the content. A card never holds another card.
 */
export function Card({ children, inset = 16, style, type, padded }: CardProps) {
  const c = useColors()
  const items = Children.toArray(children).filter((child) => isValidElement(child) || typeof child === 'string')
  const background = type ? typeTone(c, type).felt : c.felt
  return (
    <InCard.Provider value>
      <View style={[styles.card, padded ? styles.padded : styles.rows, { backgroundColor: background }, style]}>
        {items.map((child, index) => (
          <Fragment key={isValidElement(child) && child.key != null ? child.key : index}>
            {index > 0 && !padded && <View style={[styles.separator, { marginLeft: inset, backgroundColor: c.line }]} />}
            {child}
          </Fragment>
        ))}
      </View>
    </InCard.Provider>
  )
}

type FormGroupProps = {
  /** Over the card, in the small words of a group label. */
  title?: ReactNode
  /** Under the card: what the rows mean or why a button waits. */
  footer?: ReactNode
  children: ReactNode
  inset?: number
  style?: StyleProp<ViewStyle>
}

/** A group of a form or a settings page: a small heading, the rows in one card, a note under it. */
export function FormGroup({ title, footer, children, inset, style }: FormGroupProps) {
  return (
    <View style={style}>
      {title !== undefined && <GroupTitle>{title}</GroupTitle>}
      <Card inset={inset}>{children}</Card>
      {footer !== undefined && footer !== null && footer !== false && <GroupFooter>{footer}</GroupFooter>}
    </View>
  )
}

/** The label over a group (13.5, sentence case, as capitals break the Turkish İ and ı). */
export function GroupTitle({ children }: { children: ReactNode }) {
  return (
    <View accessibilityRole="header" style={styles.groupTitle}>
      {typeof children === 'string' ? (
        <Text variant="sub" weight="600" tone="ink2">
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  )
}

export function GroupFooter({ children }: { children: ReactNode }) {
  return (
    <View style={styles.groupFooter}>
      {typeof children === 'string' ? (
        <Text variant="sub" tone="ink3">
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  )
}

/**
 * The icon before a row: a line icon in a quiet circle set on the felt, the same for every row.
 * With `alert` a small amber dot at its corner says the job is overdue.
 */
export function IconTile({ icon, alert, size = 32 }: { icon: IconName; /** No longer drawn; kept so callers still compile. */ tone?: TileTone; alert?: boolean; size?: number }) {
  const c = useColors()
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.tile, { width: size, height: size, borderRadius: size / 2, backgroundColor: c.onFelt }]}
    >
      <Icon name={icon} size={Math.round(size * 0.5)} color={c.ink2} weight="regular" />
      {alert && <View style={[styles.tileDot, { backgroundColor: c.amber, borderColor: c.felt }]} />}
    </View>
  )
}

type RowProps = {
  leading?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  /** What the row is set to, in grey before the arrow ("3", "Monthly"). */
  value?: ReactNode
  trailing?: ReactNode
  onPress?: () => void
  /** Only where the row opens a picker or a page; content rows are a target as a whole. */
  chevron?: boolean
  accessibilityLabel?: string
  /** Rows that hold more than one line of controls set their own padding. */
  style?: StyleProp<ViewStyle>
}

/** One line of a card: an avatar or tile, a title (16) and its sub-line (13.5), what it is set to, and a trailing button. */
export function Row({ leading, title, subtitle, value, trailing, onPress, chevron, accessibilityLabel, style }: RowProps) {
  const c = useColors()
  const body = (
    <>
      {leading}
      <View style={styles.rowText}>
        {typeof title === 'string' ? (
          <Text weight={subtitle !== undefined ? '500' : '400'} numberOfLines={1}>
            {title}
          </Text>
        ) : (
          title
        )}
        {subtitle !== undefined &&
          (typeof subtitle === 'string' ? (
            <Text variant="sub" tone="ink3" numberOfLines={2}>
              {subtitle}
            </Text>
          ) : (
            subtitle
          ))}
      </View>
      {value !== undefined &&
        (typeof value === 'string' || typeof value === 'number' ? (
          <Text tone="ink2" tabular numberOfLines={1} style={styles.value}>
            {value}
          </Text>
        ) : (
          value
        ))}
      {trailing}
      {chevron && <Icon name="chevronRight" size={14} color={c.ink3} weight="medium" />}
    </>
  )
  const height = { minHeight: subtitle !== undefined ? 62 : 54 }
  if (!onPress) return <View style={[styles.row, height, style]}>{body}</View>
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.row, height, pressed && { backgroundColor: c.pressed }, style]}
    >
      {body}
    </Pressable>
  )
}

type ActionRowProps = {
  label: string
  onPress: () => void
  /** An icon before the words, in their colour. */
  icon?: IconName
  /** Red words: the row removes something. */
  destructive?: boolean
  disabled?: boolean
  /** How wide the icon's place is, so the words start where the names above do (an IconTile 32, an avatar 40). */
  lead?: number
  /** Where the words start in a card whose rows begin further in, for a row without an icon. */
  inset?: number
  accessibilityLabel?: string
}

/**
 * A row that does something to its card's list rather than open a page ("Add category", "Show all",
 * "Delete lesson"): tinted words, as in the phone's own lists.
 */
export function ActionRow({ label, onPress, icon, destructive, disabled, lead = 24, inset = 16, accessibilityLabel }: ActionRowProps) {
  const c = useColors()
  const ink = destructive ? c.negativeInk : c.accentInk
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => [styles.actionRow, { paddingLeft: inset }, pressed && { backgroundColor: c.pressed }, disabled && styles.dim]}
    >
      {icon && (
        <View style={[styles.actionIcon, { width: lead }]}>
          <Icon name={icon} size={19} color={ink} />
        </View>
      )}
      <Text weight="500" numberOfLines={2} style={[styles.actionLabel, { color: ink }]}>
        {label}
      </Text>
    </Pressable>
  )
}

/**
 * A button that is a felt card of its own, its words in the middle ("Delete lesson", "Sign out"):
 * red when it removes something, blue for anything else.
 */
export function CardButton({ label, onPress, destructive, icon, disabled, busy }: { label: string; onPress: () => void; destructive?: boolean; icon?: IconName; disabled?: boolean; busy?: boolean }) {
  const c = useColors()
  const ink = destructive ? c.negativeInk : c.accentInk
  const inactive = Boolean(busy || disabled)
  return (
    <Card>
      <Pressable
        onPress={onPress}
        disabled={inactive}
        accessibilityRole="button"
        accessibilityState={{ disabled: inactive, busy: Boolean(busy) }}
        style={({ pressed }) => [styles.cardButton, pressed && { backgroundColor: c.pressed }, disabled && !busy && styles.dim]}
      >
        {/* The words keep their place under the spinner, so the button never changes size */}
        <View style={[styles.cardButtonBody, busy && styles.hidden]}>
          {icon && <Icon name={icon} size={17} color={ink} />}
          <Text weight="500" numberOfLines={1} style={[styles.shrink, { color: ink }]}>
            {label}
          </Text>
        </View>
        {busy && <ActivityIndicator color={ink} style={StyleSheet.absoluteFill} />}
      </Pressable>
    </Card>
  )
}

/** What a card holds when it holds nothing, in the place of its rows. */
export function QuietRow({ children }: { children: string }) {
  return (
    <Text variant="sub" tone="ink2" style={styles.quiet}>
      {children}
    </Text>
  )
}

/** A section that holds nothing: one quiet line in a card, so the page keeps its rhythm of cards. */
export function QuietCard({ children }: { children: string }) {
  return (
    <Card>
      <QuietRow>{children}</QuietRow>
    </Card>
  )
}

/** The room over a page's first group of rows (More, Settings). */
export const FIRST_GROUP = { marginTop: 14 }

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  statusCover: { position: 'absolute', top: 0, left: 0, right: 0 },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, paddingTop: 10, paddingBottom: 16, paddingHorizontal: 4 },
  headerWords: { flex: 1, minWidth: 0 },
  headerSub: { fontSize: 15, lineHeight: 20, marginTop: 3 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 4 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 10, paddingHorizontal: 4 },
  sectionTitle: { flex: 1, minWidth: 0 },
  aside: { fontSize: 14, lineHeight: 18 },
  description: { marginTop: -4, marginBottom: 10, paddingHorizontal: 4 },
  card: { borderRadius: 26, overflow: 'hidden' },
  rows: { paddingVertical: 4 },
  padded: { padding: 18 },
  separator: { height: 1, marginRight: 16 },
  groupTitle: { paddingHorizontal: 4, marginBottom: 8 },
  groupFooter: { paddingHorizontal: 4, marginTop: 8 },
  tile: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  tileDot: { position: 'absolute', top: -1, right: -1, width: 11, height: 11, borderRadius: 6, borderWidth: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 11 },
  rowText: { flex: 1, minWidth: 0, gap: 1 },
  value: { flexShrink: 1, maxWidth: '55%' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingRight: 16, paddingVertical: 12, minHeight: 50 },
  actionIcon: { alignItems: 'center' },
  actionLabel: { flex: 1, minWidth: 0 },
  cardButton: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'center' },
  cardButtonBody: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  shrink: { flexShrink: 1 },
  quiet: { paddingHorizontal: 16, paddingVertical: 12 },
  dim: { opacity: 0.4 },
  hidden: { opacity: 0 }
})
