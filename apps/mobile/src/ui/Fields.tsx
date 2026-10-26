import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react'
import { Platform, Pressable, StyleSheet, Switch, TextInput, View, type StyleProp, type TextInputInstance, type TextInputProps, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeIn, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated'
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import * as Haptics from 'expo-haptics'
import { addHours, startOfDay, startOfHour } from 'date-fns'
import { sanitizeAmountInput } from '@hellokido/core/rules/money.js'
import { useI18n } from '../providers/I18n'
import { tint, useColors } from '../theme/colors'
import { useScheme } from '../providers/Theme'
import { fontOf } from '../theme/fonts'
import { useActionMenu } from './ActionMenu'
import { Button, IconButton } from './Button'
import { Icon } from './Icon'
import { Card, GroupFooter, GroupTitle, useInCard } from './Screen'
import { DOT, MAX_FONT_SCALE, Text } from './Text'

/** The heading over a field or a group of choices that stands on its own (not a row of a card). */
export function FieldLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <View style={styles.labelRow}>
      <Text variant="sub" weight="600" tone="ink2">
        {children}
      </Text>
      {hint && (
        <Text variant="sub" tone="ink3">
          {hint}
        </Text>
      )}
    </View>
  )
}

export function FieldError({ children }: { children?: string }) {
  const c = useColors()
  if (!children) return null
  return (
    <Text variant="sub" accessibilityRole="alert" style={{ color: c.negativeInk }}>
      {children}
    </Text>
  )
}

/**
 * The frame every row field shares: inside a Card it is one of the card's rows, with its note under
 * the line; on its own it is a card of one row, with the note under the card, as Settings does.
 */
function Field({ title, hint, error, children }: { title?: string; hint?: string; error?: string; children: ReactNode }) {
  const inCard = useInCard()
  const notes =
    hint || error ? (
      <View style={inCard ? styles.notesInRow : styles.notesUnder}>
        <FieldError>{error}</FieldError>
        {hint && (
          <Text variant="sub" tone="ink3">
            {hint}
          </Text>
        )}
      </View>
    ) : null
  if (inCard) {
    return (
      <View>
        {children}
        {notes}
      </View>
    )
  }
  return (
    <View>
      {title && <GroupTitle>{title}</GroupTitle>}
      <Card>{children}</Card>
      {notes}
    </View>
  )
}

type TextFieldProps = Omit<TextInputProps, 'style'> & {
  /** At the left of the row, the input after it. Without one the input takes the row (a placeholder says what goes in). */
  label?: string
  hint?: string
  error?: string
  /** Something at the end of the row, such as the ₺ sign. */
  suffix?: string
  trailing?: ReactNode
  /** A box for longer text (a note) starts taller than the usual few lines. */
  minHeight?: number
  /** Bigger figures, for an amount that is the point of the form. */
  large?: boolean
}

/**
 * A row to type in: the label at the left and the words at the right, as in the phone's own forms.
 * A note (multiline) takes a row of its own under its label.
 */
export const TextField = forwardRef<TextInputInstance, TextFieldProps>(function TextField({ label, hint, error, suffix, trailing, multiline, minHeight, large, ...props }, ref) {
  const c = useColors()
  const inCard = useInCard()
  const input = useRef<TextInputInstance | null>(null)
  useImperativeHandle(ref, () => input.current as TextInputInstance, [])
  const inline = Boolean(label) && !multiline
  return (
    // A note on its own is headed by its label; inside a group the placeholder says what it is
    <Field title={multiline ? label : undefined} hint={hint} error={error}>
      {/* The whole row is the field: a tap on the label or on the ₺ still starts typing */}
      <Pressable onPress={() => props.editable !== false && input.current?.focus()} accessible={false} style={[styles.inputRow, multiline && styles.inputRowMultiline]}>
        {inline && (
          <Text variant="body" numberOfLines={2} style={[styles.inputLabel, error ? { color: c.negativeInk } : null]}>
            {label}
          </Text>
        )}
        <TextInput
          ref={input}
          underlineColorAndroid="transparent"
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          {...props}
          placeholder={props.placeholder ?? (multiline && inCard ? label : undefined)}
          multiline={multiline}
          accessibilityLabel={props.accessibilityLabel ?? label}
          placeholderTextColor={c.ink3}
          selectionColor={c.accent}
          style={[
            styles.input,
            fontOf(large ? '600' : '400'),
            inline && styles.inputEnd,
            large && styles.inputLarge,
            multiline && styles.inputMultiline,
            minHeight !== undefined && { minHeight },
            { color: c.ink }
          ]}
        />
        {suffix && (
          <Text variant="body" tone="ink2" weight={large ? '500' : undefined} style={large && styles.suffixLarge}>
            {suffix}
          </Text>
        )}
        {trailing}
      </Pressable>
    </Field>
  )
})

/** The search capsule: a grey fill with a magnifier and a way to clear it. */
export function SearchField({ value, onChange, placeholder, label, autoFocus }: { value: string; onChange: (text: string) => void; placeholder: string; label: string; autoFocus?: boolean }) {
  const c = useColors()
  const { t } = useI18n()
  return (
    <View style={[styles.search, { backgroundColor: c.felt }]}>
      <Icon name="search" size={19} color={c.ink3} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.ink3}
        selectionColor={c.accent}
        accessibilityLabel={label}
        autoFocus={autoFocus}
        autoCorrect={false}
        autoComplete="off"
        returnKeyType="search"
        clearButtonMode="while-editing"
        underlineColorAndroid="transparent"
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        style={[styles.searchInput, fontOf('400'), { color: c.ink }]}
      />
      {Platform.OS !== 'ios' && value !== '' && <IconButton icon="close" label={t.mobile.clearSearch} variant="plain" size={30} color={c.ink3} onPress={() => onChange('')} />}
    </View>
  )
}

/** Amounts as people type them here: 13.850 or 13.850,50; only digits, dots and commas go in. */
export function AmountField({ label, value, onChange, error, disabled }: { label: string; value: string; onChange: (text: string) => void; error?: string; disabled?: boolean }) {
  return (
    <TextField
      label={label}
      value={value}
      onChangeText={(text) => onChange(sanitizeAmountInput(text))}
      keyboardType="decimal-pad"
      inputMode="decimal"
      placeholder="0"
      suffix="₺"
      large
      error={error}
      editable={!disabled}
    />
  )
}

export type Option<T extends string> = { id: T; label: string; description?: string; leading?: ReactNode }

const TRACK_PAD = 3

/**
 * Two to four choices side by side: a pill track and a raised thumb with a soft lift that slides to
 * the choice. Inside a card it is a row under its label. `compact` is the small control of an
 * in-content header ([Gün | Ay]): felt, a little lower, as wide as it is given.
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
  compact,
  style
}: {
  label?: string
  options: Option<T>[]
  value: T | null
  onChange: (value: T) => void
  disabled?: boolean
  compact?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const c = useColors()
  const inCard = useInCard() && !compact
  const still = useReducedMotion()
  const [width, setWidth] = useState(0)
  const index = options.findIndex((option) => option.id === value)
  const segment = width > 0 ? (width - TRACK_PAD * 2) / options.length : 0
  const x = useSharedValue(0)
  // The piece is put in place without sliding the first time, then slides to each new choice
  const placed = useRef(false)
  useEffect(() => {
    if (index < 0 || segment === 0) return
    const target = index * segment
    x.set(still || !placed.current ? target : withTiming(target, { duration: 200, easing: Easing.out(Easing.cubic) }))
    placed.current = true
  }, [index, segment, still, x])
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }))

  const control = (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.segmented, compact && styles.segmentedCompact, { backgroundColor: compact ? c.felt : c.track }, disabled && { opacity: 0.5 }, style]}
    >
      {index >= 0 && segment > 0 && <Animated.View style={[styles.thumb, { width: segment, backgroundColor: c.raised, boxShadow: c.liftShadow }, slide]} />}
      {options.map((option) => {
        const on = option.id === value
        return (
          <Pressable
            key={option.id}
            disabled={disabled}
            onPress={() => {
              if (on) return
              void Haptics.selectionAsync()
              onChange(option.id)
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: on, disabled: Boolean(disabled) }}
            // The track is drawn thin; a segment still answers to a whole fingertip
            hitSlop={{ top: 8, bottom: 8 }}
            style={({ pressed }) => [styles.segment, compact && styles.segmentCompact, pressed && !on && { opacity: 0.55 }]}
          >
            {option.leading}
            <Text variant="label" tone={on ? 'ink' : 'ink2'} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.shrink}>
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
  if (inCard) {
    return (
      <View style={styles.segmentRow}>
        {label && <Text variant="body">{label}</Text>}
        {control}
      </View>
    )
  }
  return (
    <View>
      {label && <FieldLabel>{label}</FieldLabel>}
      {control}
    </View>
  )
}

type ChipProps = {
  label: string
  selected?: boolean
  onPress: () => void
  icon?: 'calendar'
  /** A piece of the panel's own material before the label, such as an age tablet. */
  leading?: ReactNode
  /** How many rows the filter leaves; nothing while that is not known yet. */
  count?: number
  /** The chip opens a list of choices. */
  menu?: boolean
  /** A filter that is on: pressing it takes it off. */
  removable?: boolean
  /** A 7pt status dot before the words (c.amber for what waits). */
  dot?: string
  accessibilityLabel?: string
}

/** Felt pills for the filters over a list (34 high), with a count; a chosen chip is sky felt with sky ink. */
export function Chip({ label, selected, onPress, icon, leading, count, menu, removable, dot, accessibilityLabel }: ChipProps) {
  const c = useColors()
  const ink = selected ? c.skyInk : c.ink
  const soft = selected ? c.skyInk : c.ink2
  return (
    <Pressable
      onPress={() => {
        // Choosing is felt, as with the segments; a chip that opens a list leaves that to the list
        if (!menu) void Haptics.selectionAsync()
        onPress()
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (count !== undefined ? `${label}, ${count}` : undefined)}
      accessibilityState={{ selected: Boolean(selected) }}
      hitSlop={{ top: 6, bottom: 6 }}
      style={({ pressed }) => [styles.chip, { backgroundColor: selected ? c.skyFelt : c.felt }, pressed && { opacity: 0.7 }]}
    >
      {dot && <View style={[styles.chipDot, { backgroundColor: dot }]} />}
      {icon && <Icon name={icon} size={15} color={soft} />}
      {leading}
      <Text weight="500" numberOfLines={1} style={[styles.shrink, styles.chipText, { color: ink }]}>
        {label}
      </Text>
      {count !== undefined && (
        <Text weight="600" tabular style={[styles.chipText, { color: soft }]}>
          {count}
        </Text>
      )}
      {menu && <Icon name="chevronDown" size={13} color={soft} weight="medium" />}
      {removable && <Icon name="close" size={12} color={soft} weight="medium" />}
    </Pressable>
  )
}

type MinuteInterval = 1 | 5 | 10 | 15 | 30

type PickerRowProps = {
  label: string
  mode: 'date' | 'time'
  value: Date | null
  onPick: (value: Date) => void
  /** Where an empty field opens: today, the first day allowed, or the usual time. */
  start: Date
  minimumDate?: Date | null
  maximumDate?: Date | null
  minuteInterval?: MinuteInterval
  /** An empty day offers today in one tap. */
  today?: boolean
  invalid?: boolean
}

/**
 * A label and the phone's own picker at the right: on the iPhone the compact pill that opens the
 * system calendar or clock, on Android a pill that opens Android's dialog. An empty field is never
 * filled in by itself; it shows "Choose" until the person picks.
 */
function PickerRow({ label, mode, value, onPick, start, minimumDate, maximumDate, minuteInterval, today, invalid }: PickerRowProps) {
  const c = useColors()
  const { t, tag, date } = useI18n()
  const dark = useScheme() === 'dark'
  const ios = Platform.OS === 'ios'
  // The iPhone's calendar for an empty day, open under the row
  const [open, setOpen] = useState(false)
  const shown = value ? (mode === 'date' ? date(value, { day: 'numeric', month: 'short', year: 'numeric' }) : date(value, { hour: '2-digit', minute: '2-digit' })) : t.common.choose
  const pick = (picked: Date) => onPick(mode === 'date' ? startOfDay(picked) : picked)
  const now = new Date()
  const todayFits = (!minimumDate || startOfDay(minimumDate) <= now) && (!maximumDate || maximumDate >= startOfDay(now))

  const choose = () => {
    if (!ios) {
      DateTimePickerAndroid.open({
        value: value ?? start,
        mode,
        // Every language of the app writes the time in 24 hours
        is24Hour: true,
        minuteInterval,
        minimumDate: minimumDate ?? undefined,
        maximumDate: maximumDate ?? undefined,
        onChange: (event, picked) => {
          if (event.type === 'set' && picked) pick(picked)
        }
      })
      return
    }
    // An empty time takes the usual start at this tap; its pill then turns to the iPhone's own clock
    if (mode === 'time') return pick(start)
    setOpen((current) => !current)
  }

  const native = ios && value !== null
  return (
    <View>
      <Pressable
        onPress={choose}
        disabled={native}
        accessibilityRole={native ? undefined : 'button'}
        accessibilityLabel={native ? undefined : `${label}: ${value ? shown : t.common.none}`}
        accessibilityState={native ? undefined : { expanded: ios && mode === 'date' ? open : undefined }}
        style={({ pressed }) => [styles.pickerRow, pressed && !native && { backgroundColor: c.pressed }]}
      >
        <Text variant="body" numberOfLines={2} style={[styles.flex, invalid ? { color: c.negativeInk } : null]}>
          {label}
        </Text>
        {today && value === null && todayFits && (
          <Button variant="plain" size="sm" onPress={() => pick(now)}>
            {t.common.today}
          </Button>
        )}
        {native ? (
          <DateTimePicker
            value={value}
            mode={mode}
            display="compact"
            locale={tag}
            accentColor={c.accent}
            themeVariant={dark ? 'dark' : 'light'}
            minuteInterval={minuteInterval}
            minimumDate={minimumDate ?? undefined}
            maximumDate={maximumDate ?? undefined}
            onChange={(event, picked) => {
              if (event.type === 'set' && picked) pick(picked)
            }}
            // The picker measures itself 10pt wider than its pill and draws the pill at its start;
            // pulled back by that much it ends where the row's words would
            style={styles.compact}
          />
        ) : (
          <View style={[styles.pill, { backgroundColor: open ? tint(c.accent, 0.14) : c.track }]}>
            <Text weight="500" tabular numberOfLines={1} style={{ color: open ? c.accentInk : value ? c.ink : c.ink3 }}>
              {shown}
            </Text>
          </View>
        )}
      </Pressable>
      {open && ios && mode === 'date' && (
        <InlineCalendar
          value={start}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onPick={(day) => {
            pick(day)
            setOpen(false)
          }}
        />
      )}
    </View>
  )
}

function InlineCalendar({ value, minimumDate, maximumDate, onPick }: { value: Date; minimumDate?: Date | null; maximumDate?: Date | null; onPick: (day: Date) => void }) {
  const c = useColors()
  const { tag } = useI18n()
  const dark = useScheme() === 'dark'
  const still = useReducedMotion()
  return (
    // The calendar has a width of its own; centred, it leaves no gap at one side of the card
    <Animated.View entering={still ? undefined : FadeIn.duration(180)} style={styles.calendar}>
      <DateTimePicker
        value={value}
        mode="date"
        display="inline"
        locale={tag}
        accentColor={c.accent}
        themeVariant={dark ? 'dark' : 'light'}
        minimumDate={minimumDate ?? undefined}
        maximumDate={maximumDate ?? undefined}
        onChange={(event, picked) => {
          if (event.type === 'set' && picked) onPick(startOfDay(picked))
        }}
      />
    </Animated.View>
  )
}

type DateFieldProps = {
  label: string
  value: Date | null
  onChange: (value: Date | null) => void
  /** An empty day offers "Today" in one tap: most payments are entered the day they come in. */
  shortcuts?: boolean
  minimumDate?: Date | null
  maximumDate?: Date | null
  error?: string
  hint?: string
}

/** A day as a row: "Date" at the left, the phone's date pill at the right. */
export function DateField({ label, value, onChange, shortcuts, minimumDate, maximumDate, error, hint }: DateFieldProps) {
  const today = startOfDay(new Date())
  return (
    <Field hint={hint} error={error}>
      <PickerRow
        label={label}
        mode="date"
        value={value}
        onPick={onChange}
        start={value ?? (minimumDate && minimumDate > today ? startOfDay(minimumDate) : today)}
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        today={shortcuts}
        invalid={Boolean(error)}
      />
    </Field>
  )
}

type TimeFieldProps = {
  label: string
  /** Only the hour and minute are read. */
  value: Date | null
  onChange: (value: Date) => void
  /** Steps of the minute wheel (15 for lessons). */
  minuteInterval?: MinuteInterval
  /** The time an empty field takes at the first tap; the next full hour unless given. */
  start?: Date
  error?: string
  hint?: string
}

/** A time of day as a row: "Time" at the left, the phone's clock pill at the right, 24 hours. */
export function TimeField({ label, value, onChange, minuteInterval, start, error, hint }: TimeFieldProps) {
  return (
    <Field hint={hint} error={error}>
      <PickerRow
        label={label}
        mode="time"
        value={value}
        onPick={onChange}
        start={value ?? start ?? addHours(startOfHour(new Date()), 1)}
        minuteInterval={minuteInterval}
        invalid={Boolean(error)}
      />
    </Field>
  )
}

type PeriodFieldProps = {
  label: string
  hint?: string
  startLabel: string
  endLabel: string
  start: Date | null
  end: Date | null
  onStart: (day: Date) => void
  onEnd: (day: Date) => void
  minimumDate?: Date | null
}

/** A span of days as the phone's calendar shows an event: a group of its own with the first and last day. */
export function PeriodField({ label, hint, startLabel, endLabel, start, end, onStart, onEnd, minimumDate }: PeriodFieldProps) {
  const today = startOfDay(new Date())
  // An empty day opens on today, or on the first day allowed
  const from = (min: Date | null | undefined) => (min && min > today ? startOfDay(min) : today)
  return (
    <View>
      <GroupTitle>{label}</GroupTitle>
      <Card>
        <PickerRow label={startLabel} mode="date" value={start} onPick={onStart} start={start ?? from(minimumDate)} minimumDate={minimumDate} />
        <PickerRow label={endLabel} mode="date" value={end} onPick={onEnd} start={end ?? from(start ?? minimumDate)} minimumDate={start ?? minimumDate} />
      </Card>
      {hint && <GroupFooter>{hint}</GroupFooter>}
    </View>
  )
}

/**
 * A choice from a list as a row: the label, the current choice in grey and the up-and-down arrows;
 * a tap opens the phone's action sheet with the current choice ticked.
 */
export function SelectField<T extends string>({ label, placeholder, options, value, onChange }: { label: string; placeholder: string; options: Option<T>[]; value: T | null; onChange: (value: T) => void }) {
  const c = useColors()
  const menu = useActionMenu()
  const current = options.find((option) => option.id === value)
  const choose = () =>
    menu.open(
      label,
      options.map((option) => ({
        // The system sheet shows one line of words per choice, so the detail joins the name
        label: option.description ? `${option.label}${DOT}${option.description}` : option.label,
        selected: option.id === value,
        onPress: () => {
          if (option.id === value) return
          void Haptics.selectionAsync()
          onChange(option.id)
        }
      }))
    )
  return (
    <Field hint={current?.description}>
      <Pressable
        onPress={choose}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? placeholder}`}
        style={({ pressed }) => [styles.pickerRow, pressed && { backgroundColor: c.pressed }]}
      >
        <Text variant="body" numberOfLines={2} style={styles.inputLabel}>
          {label}
        </Text>
        <View style={styles.selectValue}>
          {current?.leading}
          <Text variant="body" tone={current ? 'ink2' : 'ink3'} numberOfLines={1} style={styles.shrink}>
            {current?.label ?? placeholder}
          </Text>
          <Icon name="chevronUpDown" size={15} color={c.ink2} weight="regular" />
        </View>
      </Pressable>
      {menu.element}
    </Field>
  )
}

/** A count with minus and plus (extra lessons, the day of a monthly expense), as a row. */
export function Stepper({
  label,
  value,
  onChange,
  min = 0,
  max,
  decreaseLabel,
  increaseLabel
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max: number
  decreaseLabel: string
  increaseLabel: string
}) {
  const c = useColors()
  const step = (delta: number) => {
    const next = Math.min(Math.max(value + delta, min), max)
    if (next === value) return
    void Haptics.selectionAsync()
    onChange(next)
  }
  const button = (delta: number, icon: 'minus' | 'add', a11y: string, disabled: boolean) => (
    <Pressable
      onPress={() => step(delta)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      hitSlop={6}
      style={({ pressed }) => [styles.stepButton, { opacity: disabled ? 0.3 : pressed ? 0.55 : 1 }]}
    >
      <Icon name={icon} size={16} color={c.ink} weight="semibold" />
    </Pressable>
  )
  return (
    <Field>
      <View style={styles.pickerRow}>
        <Text variant="body" style={styles.flex}>
          {label}
        </Text>
        <View
          style={[styles.stepControl, { backgroundColor: c.track }]}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ now: value, min, max }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(event) => step(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
        >
          {button(-1, 'minus', decreaseLabel, value <= min)}
          <Text variant="headline" tabular style={styles.stepValue}>
            {value}
          </Text>
          {button(1, 'add', increaseLabel, value >= max)}
        </View>
      </View>
    </Field>
  )
}

/** An on/off setting with the phone's own green switch, and what it means under it. */
export function SwitchField({ label, hint, value, onChange, disabled }: { label: string; hint?: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  const c = useColors()
  return (
    <Field hint={hint}>
      <View style={styles.pickerRow}>
        <Text variant="body" style={styles.flex}>
          {label}
        </Text>
        <Switch
          value={value}
          onValueChange={onChange}
          disabled={disabled}
          accessibilityLabel={label}
          // Android's white knob would vanish on the iPhone's pale track, so its off track is darker
          trackColor={{ false: Platform.OS === 'android' ? c.lineStrong : c.track, true: c.toggle }}
          // The phone's own switches keep a white knob in both themes
          thumbColor="#ffffff"
          ios_backgroundColor={c.track}
        />
      </View>
    </Field>
  )
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 8, paddingHorizontal: 4 },
  notesInRow: { paddingHorizontal: 16, paddingBottom: 12, marginTop: -4, gap: 2 },
  notesUnder: { paddingHorizontal: 4, marginTop: 8, gap: 2 },
  inputRow: { minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  inputRowMultiline: { alignItems: 'flex-start' },
  inputLabel: { flexShrink: 0, maxWidth: '50%' },
  // No side padding: Android's own inset would start a placeholder-only row a few points right of the labels above it
  input: { flex: 1, minWidth: 0, fontSize: 16, minHeight: 56, paddingHorizontal: 0, paddingVertical: Platform.OS === 'android' ? 8 : 17 },
  inputEnd: { textAlign: 'right' },
  inputLarge: { fontSize: 22, fontVariant: ['tabular-nums'], letterSpacing: -0.4 },
  suffixLarge: { fontSize: 20, lineHeight: 25 },
  inputMultiline: { minHeight: 96, textAlignVertical: 'top', paddingTop: 16 },
  search: { height: 46, borderRadius: 23, paddingLeft: 16, paddingRight: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInput: { flex: 1, fontSize: 16, height: 46, paddingVertical: 0 },
  segmented: { flexDirection: 'row', borderRadius: 999, padding: TRACK_PAD, minHeight: 36 },
  segmentedCompact: { minHeight: 38 },
  // The chosen piece, drawn under the words: raised, with the soft lift of what sits on felt
  thumb: { position: 'absolute', top: TRACK_PAD, bottom: TRACK_PAD, left: TRACK_PAD, borderRadius: 999 },
  segment: { flex: 1, minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8 },
  segmentCompact: { minHeight: 32, paddingHorizontal: 12 },
  segmentRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  shrink: { flexShrink: 1 },
  // A chip never grows wider than its row; a long label ends in an ellipsis inside the capsule
  chip: { height: 34, maxWidth: '100%', borderRadius: 17, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 7 },
  chipText: { fontSize: 14, lineHeight: 18 },
  chipDot: { width: 7, height: 7, borderRadius: 4 },
  pickerRow: { minHeight: 56, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  pill: { minHeight: 36, borderRadius: 10, paddingHorizontal: 13, justifyContent: 'center' },
  compact: { marginRight: -10 },
  calendar: { alignItems: 'center', paddingHorizontal: 8, paddingBottom: 8 },
  flex: { flex: 1, minWidth: 0 },
  selectValue: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  stepControl: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, height: 36 },
  stepButton: { width: 44, height: 36, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 28, textAlign: 'center' }
})
