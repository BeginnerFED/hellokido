import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Pressable, StyleSheet, View, type AccessibilityActionEvent, type AccessibilityActionInfo } from 'react-native'
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable'
import Animated, { ReduceMotion, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import * as Haptics from 'expo-haptics'
import { useColors, type Colors } from '../theme/colors'
import type { MenuItem } from './ActionMenu'
import { Icon, type IconName } from './Icon'
import { Text } from './Text'

export type SwipeTone = 'accent' | 'positive' | 'negative'

/**
 * Something a row can do without opening its page. Every action is in the long-press menu and in
 * VoiceOver's actions; one with a `swipe` colour is also a button behind the row.
 */
export type RowAction = {
  key: string
  label: string
  icon: IconName
  onPress: () => void
  destructive?: boolean
  /** Shown on a swipe to the left in this colour; the last of these also runs on a full swipe. */
  swipe?: SwipeTone
  /** A shorter word under the swipe button's icon when the menu's is long. */
  short?: string
}

/** What the row's own Pressable takes: its tap, its long press and its actions for VoiceOver. */
export type RowPress = {
  onPress: () => void
  onLongPress?: () => void
  delayLongPress: number
  accessibilityActions?: AccessibilityActionInfo[]
  onAccessibilityAction?: (event: AccessibilityActionEvent) => void
}

type Props = {
  actions: RowAction[]
  /** The screen's action sheet (`useActionMenu().open`); without it a long press does nothing. */
  openMenu?: (title: string | undefined, items: MenuItem[]) => void
  menuTitle?: string
  onPress: () => void
  children: (press: RowPress) => ReactNode
}

const BUTTON = 78
// A little quicker than the system's half second: the menu is the shortcut, not a hidden feature
const LONG_PRESS = 450
/** Haptic and full swipe: well past the buttons, or most of the row on a wide one. */
const FULL_PAST = 64
const FULL_SHARE = 0.62
/** How long after letting go a full-swipe mark still counts: on a quick swipe it arrives just after. */
const LATE_MARK = 250

/** How far the row must be pulled for a full swipe. */
const fullAt = (buttons: number, rowWidth: number) => {
  'worklet'
  return Math.max(buttons * BUTTON + FULL_PAST, rowWidth * FULL_SHARE)
}

// One row open at a time across the app, as in the phone's own lists
let openRow: SwipeableMethods | null = null

/** Closes the row whose buttons are showing; a list calls this when it starts to scroll. */
export function closeSwipedRow() {
  openRow?.close()
  openRow = null
}

// Deep fills in both themes, so the white words on them stay readable
const fill = (c: Colors, tone: SwipeTone) => (tone === 'positive' ? c.swipePositive : tone === 'negative' ? c.swipeNegative : c.swipeAccent)

/**
 * A list row with the phone's shortcuts: swipe left for one or two buttons (a full swipe runs the
 * last), hold for a menu of everything the row offers. The row's own tap still opens its page, so
 * nothing new has to be learnt. Rows with no swipe button only get the menu.
 */
export function SwipeRow({ actions, openMenu, menuTitle, onPress, children }: Props) {
  const c = useColors()
  const self = useRef<SwipeableMethods>(null)
  const [open, setOpen] = useState(false)
  const dragging = useRef(false)
  const armed = useRef(false)
  // A touch that dragged the row, or only closed another row's buttons, is not also a tap on it
  const swallow = useRef(false)
  const expand = useSharedValue(0)
  const rowWidth = useSharedValue(0)
  const swipes = actions.filter((action) => action.swipe)
  // The row's offset, handed over by the buttons: where the finger let go decides a full swipe
  const offset = useRef<SharedValue<number> | null>(null)
  // When the finger last let go of a row that opened rather than ran its last button
  const releasedAt = useRef(0)
  // The last button as of this render, for a mark that arrives after the finger is up
  const fullAction = useRef<RowAction | undefined>(undefined)
  useEffect(() => {
    fullAction.current = swipes[swipes.length - 1]
  })

  const press: RowPress = {
    onPress: () => {
      if (swallow.current) {
        swallow.current = false
        return
      }
      onPress()
    },
    onLongPress:
      openMenu && actions.length > 0
        ? () => {
            // Android keeps timing the hold while the row is dragged; a drag is never a hold
            if (dragging.current || swallow.current) return
            closeSwipedRow()
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            openMenu(
              menuTitle,
              actions.map((action) => ({ label: action.label, icon: action.icon, destructive: action.destructive, onPress: action.onPress }))
            )
          }
        : undefined,
    delayLongPress: LONG_PRESS,
    accessibilityActions: actions.length > 0 ? actions.map((action) => ({ name: action.key, label: action.label })) : undefined,
    onAccessibilityAction: actions.length > 0 ? (event) => actions.find((action) => action.key === event.nativeEvent.actionName)?.onPress() : undefined
  }

  const runFull = useCallback(() => {
    self.current?.close()
    fullAction.current?.onPress()
  }, [])

  // Past the full-swipe mark the last button takes the whole row, with a tick each way
  const onBeyond = useCallback(
    (beyond: boolean) => {
      // A quick swipe passes the mark as the finger lets go, and the mark is told only after the
      // release: the row is then already opening, so it runs its last button instead
      if (beyond && !dragging.current && Date.now() - releasedAt.current < LATE_MARK) {
        releasedAt.current = 0
        expand.set(withTiming(1, { duration: 180, reduceMotion: ReduceMotion.System }))
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        runFull()
        return
      }
      if (!dragging.current || armed.current === beyond) return
      armed.current = beyond
      expand.set(withTiming(beyond ? 1 : 0, { duration: 180, reduceMotion: ReduceMotion.System }))
      void Haptics.impactAsync(beyond ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light)
    },
    [expand, runFull]
  )

  const startDrag = () => {
    dragging.current = true
    // The row moves with the finger, so Android still counts the drag as a tap on it when let go
    swallow.current = true
    if (openRow && openRow !== self.current) closeSwipedRow()
  }

  // Called on letting go (and on closing from code, when nothing was being dragged)
  const settle = (opening: boolean) => {
    const released = dragging.current
    dragging.current = false
    // Past the mark while dragging, or still past it now (read straight from the UI thread). The row
    // springs back toward its buttons the moment the finger lifts, so the offset alone can miss it;
    // a mark that comes after this is handled by onBeyond.
    const full = released && (armed.current || (offset.current !== null && -offset.current.get() > fullAt(swipes.length, rowWidth.get())))
    if (released) {
      armed.current = false
      if (!full) expand.set(0)
    }
    if (full) {
      runFull()
      return
    }
    if (released && opening) releasedAt.current = Date.now()
    if (opening) openRow = self.current
  }

  const runButton = (action: RowAction) => {
    self.current?.close()
    action.onPress()
  }

  const body = children(press)
  if (swipes.length === 0) return <>{body}</>

  return (
    <View
      onTouchStart={() => {
        swallow.current = openRow !== null && openRow !== self.current
        if (swallow.current) closeSwipedRow()
      }}
      onLayout={(event) => {
        rowWidth.set(event.nativeEvent.layout.width)
      }}
    >
      <ReanimatedSwipeable
        ref={self}
        // Only trailing buttons: a closed row ignores a drag to the right, so the screen's own back
        // swipe from the left edge is never taken; an open one can be pushed shut
        dragOffsetFromLeft={open ? 10 : 2000}
        childrenContainerStyle={{ backgroundColor: c.felt }}
        renderRightActions={(_progress, translation) => (
          <Buttons items={swipes} translation={translation} expand={expand} rowWidth={rowWidth} offset={offset} onBeyond={onBeyond} onRun={runButton} />
        )}
        onSwipeableOpenStartDrag={startDrag}
        onSwipeableCloseStartDrag={startDrag}
        onSwipeableWillOpen={() => settle(true)}
        onSwipeableWillClose={() => settle(false)}
        onSwipeableOpen={() => setOpen(true)}
        onSwipeableClose={() => {
          setOpen(false)
          expand.set(0)
          if (openRow === self.current) openRow = null
        }}
      >
        {body}
      </ReanimatedSwipeable>
    </View>
  )
}

type ButtonsProps = {
  items: RowAction[]
  translation: SharedValue<number>
  expand: SharedValue<number>
  rowWidth: SharedValue<number>
  offset: RefObject<SharedValue<number> | null>
  onBeyond: (beyond: boolean) => void
  onRun: (action: RowAction) => void
}

/**
 * The buttons behind the row. They fill exactly the gap the row leaves as it moves, sharing it
 * evenly, so they seem to come out from under it; past the full-swipe mark the last one takes it all.
 */
function Buttons({ items, translation, expand, rowWidth, offset, onBeyond, onRun }: ButtonsProps) {
  const c = useColors()
  const width = items.length * BUTTON
  const count = items.length

  useEffect(() => {
    offset.current = translation
  }, [offset, translation])
  useAnimatedReaction(
    () => -translation.get() > fullAt(count, rowWidth.get()),
    (beyond, before) => {
      if (before !== null && beyond !== before) scheduleOnRN(onBeyond, beyond)
    }
  )
  const strip = useAnimatedStyle(() => ({ width: Math.max(0, -translation.get()) }))

  return (
    // Reached through the row's menu and VoiceOver's actions; the hidden copies are left out
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.actions, { width }]}>
      <Animated.View style={[styles.strip, strip]}>
        {items.map((item, index) => (
          <SwipeButton key={item.key} item={item} last={index === items.length - 1} expand={expand} color={fill(c, item.swipe ?? 'accent')} ink={c.onAccent} onPress={() => onRun(item)} />
        ))}
      </Animated.View>
    </View>
  )
}

function SwipeButton({ item, last, expand, color, ink, onPress }: { item: RowAction; last: boolean; expand: SharedValue<number>; color: string; ink: string; onPress: () => void }) {
  const share = useAnimatedStyle(() => ({ flexGrow: last ? 1 : 1 - expand.get() }))
  return (
    <Animated.View style={[styles.button, { backgroundColor: color }, share]}>
      {/* The last button's words stay by the row's edge as it grows, as on the phone */}
      <Pressable onPress={onPress} style={[styles.press, last && styles.pressLast]}>
        {({ pressed }) => (
          <View style={[styles.face, pressed && styles.pressed]}>
            <Icon name={item.icon} size={22} color={ink} weight="medium" />
            <Text variant="foot" weight="600" align="center" numberOfLines={2} style={{ color: ink }}>
              {item.short ?? item.label}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  // At the row's right edge, as wide as the buttons at rest; the strip inside may grow past it
  actions: { overflow: 'visible' },
  strip: { position: 'absolute', top: 0, bottom: 0, right: 0, flexDirection: 'row' },
  button: { flexBasis: 0, overflow: 'hidden' },
  press: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pressLast: { alignItems: 'flex-start' },
  face: { width: BUTTON, alignItems: 'center', gap: 4, paddingHorizontal: 6 },
  pressed: { opacity: 0.6 }
})
