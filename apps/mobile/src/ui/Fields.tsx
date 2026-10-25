import { forwardRef, useImperativeHandle, useRef, useState, type ReactNode } from 'react'
import { Platform, Pressable, StyleSheet, Switch, TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native'
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated'
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import * as Haptics from 'expo-haptics'
import { addDays, isSameDay, startOfDay } from 'date-fns'
import { sanitizeAmountInput } from '@hellokido/core/rules/money.js'
import { useI18n } from '../providers/I18n'
import { useColors } from '../theme/colors'
import { IconButton } from './Button'
import { Icon } from './Icon'
import { MAX_FONT_SCALE, Text } from './Text'

export function FieldLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <View style={styles.labelRow}>
      <Text variant="foot" weight="600" tone="ink2">
        {children}
      </Text>
      {hint && (
        <Text variant="foot" tone="ink3">
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
    <Text variant="foot" accessibilityRole="alert" style={{ color: c.negativeInk, marginTop: 6 }}>
      {children}
    </Text>
  )
}

type TextFieldProps = Omit<TextInputProps, 'style'> & {
  label?: string
  hint?: string
  error?: string
  /** Something at the end of the box, such as the ₺ sign. */
  suffix?: string
  trailing?: ReactNode
  /** A box for longer text (a note) starts taller than the usual few lines. */
  minHeight?: number
}

export const TextField = forwardRef<TextInputInstance, TextFieldProps>(function TextField({ label, hint, error, suffix, trailing, multiline, minHeight, ...props }, ref) {
  const c = useColors()
  const [focused, setFocused] = useState(false)
  const input = useRef<TextInputInstance | null>(null)
  useImperativeHandle(ref, () => input.current as TextInputInstance, [])
  return (
    <View>
      {label && <FieldLabel hint={hint}>{label}</FieldLabel>}
      {/* The whole box is the field: a tap beside the words or on the ₺ still starts typing */}
      <Pressable
        onPress={() => props.editable !== false && input.current?.focus()}
        accessible={false}
        style={[
          styles.box,
          multiline && styles.boxMultiline,
          { backgroundColor: c.surface, borderColor: error ? c.negative : focused ? c.focus : c.line }
        ]}
      >
        <TextInput
          ref={input}
          underlineColorAndroid="transparent"
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          {...props}
          multiline={multiline}
          accessibilityLabel={props.accessibilityLabel ?? label}
          placeholderTextColor={c.ink3}
          selectionColor={c.accent}
          onFocus={(event) => {
            setFocused(true)
            props.onFocus?.(event)
          }}
          onBlur={(event) => {
            setFocused(false)
            props.onBlur?.(event)
          }}
          style={[styles.input, multiline && styles.inputMultiline, minHeight !== undefined && { minHeight }, { color: c.ink }]}
        />
        {suffix && (
          <Text variant="body" tone="ink3">
            {suffix}
          </Text>
        )}
        {trailing}
      </Pressable>
      <FieldError>{error}</FieldError>
    </View>
  )
})

/** The search pill: a light well with a magnifier and a way to clear it. */
export function SearchField({ value, onChange, placeholder, label, autoFocus }: { value: string; onChange: (text: string) => void; placeholder: string; label: string; autoFocus?: boolean }) {
  const c = useColors()
  const { t } = useI18n()
  return (
    <View style={[styles.search, { backgroundColor: c.surface2, borderColor: c.line }]}>
      <Icon name="search" size={17} color={c.ink3} />
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
        style={[styles.searchInput, { color: c.ink }]}
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
      error={error}
      editable={!disabled}
    />
  )
}

export type Option<T extends string> = { id: T; label: string; description?: string; leading?: ReactNode }

/** Two to four choices side by side, like the phone's own segmented control. */
export function Segmented<T extends string>({ label, options, value, onChange, disabled }: { label?: string; options: Option<T>[]; value: T | null; onChange: (value: T) => void; disabled?: boolean }) {
  const c = useColors()
  return (
    <View>
      {label && <FieldLabel>{label}</FieldLabel>}
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.segmented, { backgroundColor: c.well, borderColor: c.line }]}>
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
              // The track's own edge counts too, so a segment takes a whole fingertip
              hitSlop={{ top: 4, bottom: 4 }}
              style={({ pressed }) => [styles.segment, on && [styles.segmentOn, { backgroundColor: c.raised, borderColor: c.line }], pressed && !on && { opacity: 0.6 }]}
            >
              {option.leading}
              <Text variant="sub" weight={on ? '600' : '500'} tone={on ? 'ink' : 'ink2'} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.shrink}>
                {option.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
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
  accessibilityLabel?: string
}

/** Small round choices that wrap: shortcuts and filters. */
export function Chip({ label, selected, onPress, icon, leading, count, menu, removable, accessibilityLabel }: ChipProps) {
  const c = useColors()
  const ink = selected ? c.accentInk : c.ink
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
      hitSlop={{ top: 5, bottom: 5 }}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: selected ? c.accentWash : c.surface, borderColor: selected ? c.accentLine : c.line },
        pressed && { opacity: 0.7 }
      ]}
    >
      {icon && <Icon name={icon} size={15} color={selected ? c.accentInk : c.ink2} />}
      {leading}
      <Text variant="sub" weight="500" numberOfLines={1} style={[styles.shrink, { color: ink }]}>
        {label}
      </Text>
      {count !== undefined && (
        <Text variant="foot" weight="600" tabular style={{ color: selected ? c.accentInk : c.ink3 }}>
          {count}
        </Text>
      )}
      {menu && <Icon name="chevronDown" size={11} color={selected ? c.accentInk : c.ink2} weight="bold" />}
      {removable && <Icon name="close" size={11} color={selected ? c.accentInk : c.ink2} weight="bold" />}
    </Pressable>
  )
}

type DateFieldProps = {
  label: string
  value: Date | null
  onChange: (value: Date | null) => void
  /** "Today" and "Yesterday" first: most payments are entered the day they come in. */
  shortcuts?: boolean
  minimumDate?: Date | null
  maximumDate?: Date | null
  error?: string
  hint?: string
}

type Limits = { minimumDate?: Date | null; maximumDate?: Date | null }

/** Android's own date dialog; the iPhone shows InlineCalendar in place instead. */
function openAndroidCalendar(value: Date | null, { minimumDate, maximumDate }: Limits, onPick: (day: Date) => void) {
  DateTimePickerAndroid.open({
    value: value ?? startOfDay(new Date()),
    mode: 'date',
    minimumDate: minimumDate ?? undefined,
    maximumDate: maximumDate ?? undefined,
    onChange: (event, picked) => {
      if (event.type === 'set' && picked) onPick(startOfDay(picked))
    }
  })
}

function InlineCalendar({ value, minimumDate, maximumDate, onPick }: Limits & { value: Date | null; onPick: (day: Date) => void }) {
  const c = useColors()
  const still = useReducedMotion()
  return (
    <Animated.View entering={still ? undefined : FadeIn.duration(180)} style={[styles.calendar, { backgroundColor: c.surface, borderColor: c.line }]}>
      <DateTimePicker
        value={value ?? startOfDay(new Date())}
        mode="date"
        display="inline"
        accentColor={c.accent}
        minimumDate={minimumDate ?? undefined}
        maximumDate={maximumDate ?? undefined}
        onChange={(event, picked) => {
          if (event.type === 'set' && picked) onPick(startOfDay(picked))
        }}
      />
    </Animated.View>
  )
}

/**
 * A day, never filled in by itself. The iPhone shows its calendar inline under the field; Android
 * opens its own dialog.
 */
export function DateField({ label, value, onChange, shortcuts, minimumDate, maximumDate, error, hint }: DateFieldProps) {
  const c = useColors()
  const { t, date } = useI18n()
  const [open, setOpen] = useState(false)
  const today = startOfDay(new Date())
  const yesterday = addDays(today, -1)
  const isToday = Boolean(value && isSameDay(value, today))
  const isYesterday = Boolean(value && isSameDay(value, yesterday))
  const other = Boolean(value && !isToday && !isYesterday)

  const pick = (next: Date | null) => {
    onChange(next ? startOfDay(next) : null)
  }

  const openCalendar = () => {
    if (Platform.OS === 'android') openAndroidCalendar(value, { minimumDate, maximumDate }, pick)
    else setOpen((current) => !current)
  }

  const longDate = (day: Date) => date(day, { weekday: 'short', day: 'numeric', month: 'long', year: day.getFullYear() === today.getFullYear() ? undefined : 'numeric' })

  return (
    <View>
      <FieldLabel hint={hint}>{label}</FieldLabel>
      {shortcuts ? (
        <View style={styles.chips}>
          <Chip label={t.common.today} selected={isToday} onPress={() => pick(today)} />
          <Chip label={t.common.yesterday} selected={isYesterday} onPress={() => pick(yesterday)} />
          <Chip label={other && value ? longDate(value) : t.common.date} icon="calendar" selected={other} onPress={openCalendar} />
        </View>
      ) : (
        <Pressable
          onPress={openCalendar}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${value ? longDate(value) : t.common.none}`}
          style={({ pressed }) => [styles.box, { backgroundColor: c.surface, borderColor: error ? c.negative : open ? c.focus : c.line }, pressed && { opacity: 0.7 }]}
        >
          <Icon name="calendar" size={18} color={c.ink3} />
          <Text variant="body" tone={value ? 'ink' : 'ink3'} style={styles.flex} numberOfLines={1}>
            {value ? longDate(value) : t.common.date}
          </Text>
          <Icon name={open ? 'chevronDown' : 'chevronRight'} size={13} color={c.ink3} weight="semibold" />
        </Pressable>
      )}
      {open && Platform.OS === 'ios' && (
        <InlineCalendar
          value={value}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onPick={(day) => {
            pick(day)
            setOpen(false)
          }}
        />
      )}
      <FieldError>{error}</FieldError>
    </View>
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
  /** A shortcut under the card, such as keeping the current period. */
  footer?: ReactNode
}

/** A package period as the phone's calendar shows an event: first and last day in one card. */
export function PeriodField({ label, hint, startLabel, endLabel, start, end, onStart, onEnd, minimumDate, footer }: PeriodFieldProps) {
  const c = useColors()
  const { t, date } = useI18n()
  const [open, setOpen] = useState<'start' | 'end' | null>(null)
  const short = (day: Date) => date(day, { day: 'numeric', month: 'short', year: 'numeric' })

  const row = (which: 'start' | 'end', rowLabel: string, value: Date | null, min: Date | null | undefined, onPick: (day: Date) => void) => {
    const isOpen = open === which
    // An empty day opens the calendar on today (or the first day allowed), never fills it in
    const today = startOfDay(new Date())
    const openAt = value ?? (min && min > today ? min : today)
    const show = () => {
      if (Platform.OS === 'android') openAndroidCalendar(openAt, { minimumDate: min }, onPick)
      else setOpen(isOpen ? null : which)
    }
    return (
      <View>
        <View style={styles.periodRow}>
          <Text variant="body" style={styles.flex} numberOfLines={1}>
            {rowLabel}
          </Text>
          <Pressable
            onPress={show}
            accessibilityRole="button"
            accessibilityLabel={`${rowLabel}: ${value ? short(value) : t.common.date}`}
            accessibilityState={{ expanded: isOpen }}
            hitSlop={6}
            style={({ pressed }) => [styles.datePill, { backgroundColor: isOpen ? c.accentWash2 : c.well }, pressed && { opacity: 0.7 }]}
          >
            <Text variant="body" tabular style={{ color: isOpen ? c.accentInk : value ? c.ink : c.ink3 }}>
              {value ? short(value) : t.common.date}
            </Text>
          </Pressable>
        </View>
        {isOpen && Platform.OS === 'ios' && (
          <InlineCalendar
            value={openAt}
            minimumDate={min}
            onPick={(day) => {
              onPick(day)
              setOpen(null)
            }}
          />
        )}
      </View>
    )
  }

  return (
    <View>
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <View style={[styles.periodCard, { backgroundColor: c.surface, borderColor: c.line }]}>
        {row('start', startLabel, start, minimumDate, onStart)}
        <View style={[styles.separator, { backgroundColor: c.line }]} />
        {row('end', endLabel, end, start ?? minimumDate, onEnd)}
      </View>
      {footer && <View style={styles.periodFooter}>{footer}</View>}
    </View>
  )
}

/** A choice from a short list, opened in place: one row closed, the whole list open. */
export function SelectField<T extends string>({ label, placeholder, options, value, onChange }: { label: string; placeholder: string; options: Option<T>[]; value: T | null; onChange: (value: T) => void }) {
  const c = useColors()
  const [open, setOpen] = useState(value === null)
  const current = options.find((option) => option.id === value)
  return (
    <View>
      <FieldLabel>{label}</FieldLabel>
      <View style={[styles.select, { backgroundColor: c.surface, borderColor: c.line }]}>
        {!open ? (
          <Pressable
            onPress={() => setOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${current?.label ?? placeholder}`}
            accessibilityState={{ expanded: false }}
            style={({ pressed }) => [styles.option, pressed && { backgroundColor: c.pressed }]}
          >
            <View style={styles.flex}>
              <Text variant="body" tone={current ? 'ink' : 'ink3'} numberOfLines={1}>
                {current?.label ?? placeholder}
              </Text>
              {current?.description && (
                <Text variant="foot" tone="ink3">
                  {current.description}
                </Text>
              )}
            </View>
            <Icon name="chevronDown" size={13} color={c.ink3} weight="semibold" />
          </Pressable>
        ) : (
          options.map((option, index) => {
            const on = option.id === value
            return (
              <View key={option.id}>
                {index > 0 && <View style={[styles.separator, { backgroundColor: c.line }]} />}
                <Pressable
                  onPress={() => {
                    void Haptics.selectionAsync()
                    onChange(option.id)
                    setOpen(false)
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  style={({ pressed }) => [styles.option, pressed && { backgroundColor: c.pressed }]}
                >
                  <View style={styles.flex}>
                    <Text variant="body" weight={on ? '600' : '400'} numberOfLines={1}>
                      {option.label}
                    </Text>
                    {option.description && (
                      <Text variant="foot" tone="ink3">
                        {option.description}
                      </Text>
                    )}
                  </View>
                  {on && <Icon name="check" size={16} color={c.accentInk} weight="bold" />}
                </Pressable>
              </View>
            )
          })
        )}
      </View>
    </View>
  )
}

/** A count with minus and plus (extra lessons, the day of a monthly expense). */
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
      hitSlop={4}
      style={({ pressed }) => [styles.stepButton, { opacity: disabled ? 0.35 : pressed ? 0.6 : 1 }]}
    >
      <Icon name={icon} size={17} color={c.accentInk} weight="semibold" />
    </Pressable>
  )
  return (
    <View style={[styles.stepper, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Text variant="body" style={styles.flex}>
        {label}
      </Text>
      <View
        style={[styles.stepControl, { backgroundColor: c.well }]}
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
  )
}

/** An on/off setting with the phone's own switch, and what it means under it. */
export function SwitchField({ label, hint, value, onChange, disabled }: { label: string; hint?: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  const c = useColors()
  return (
    <View style={[styles.switchBox, { backgroundColor: c.surface, borderColor: c.line }]}>
      <View style={styles.switchRow}>
        <Text variant="body" style={styles.flex}>
          {label}
        </Text>
        <Switch
          value={value}
          onValueChange={onChange}
          disabled={disabled}
          accessibilityLabel={label}
          trackColor={{ false: c.lineStrong, true: c.accentSolid }}
          // The phone's own switches keep a white knob in both themes
          thumbColor="#ffffff"
          ios_backgroundColor={c.lineStrong}
        />
      </View>
      {hint && (
        <Text variant="foot" tone="ink3">
          {hint}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 7, paddingHorizontal: 2 },
  box: { minHeight: 50, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  boxMultiline: { alignItems: 'flex-start', paddingVertical: 4 },
  input: { flex: 1, fontSize: 17, minHeight: 48, paddingVertical: Platform.OS === 'android' ? 8 : 12 },
  inputMultiline: { minHeight: 84, textAlignVertical: 'top', paddingTop: 10 },
  search: { height: 46, borderRadius: 23, borderWidth: 1, paddingLeft: 15, paddingRight: 6, flexDirection: 'row', alignItems: 'center', gap: 9 },
  searchInput: { flex: 1, fontSize: 16, height: 44, paddingVertical: 0 },
  segmented: { flexDirection: 'row', borderRadius: 999, borderWidth: 1, padding: 3, gap: 2 },
  segment: { flex: 1, height: 38, borderRadius: 999, borderWidth: 1, borderColor: 'transparent', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 6 },
  shrink: { flexShrink: 1 },
  segmentOn: { shadowColor: '#000000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // A chip never grows wider than its row; a long label ends in an ellipsis inside the pill
  chip: { height: 38, maxWidth: '100%', borderRadius: 19, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  calendar: { marginTop: 10, borderRadius: 18, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 4 },
  periodCard: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  periodRow: { minHeight: 52, paddingLeft: 16, paddingRight: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  datePill: { height: 34, borderRadius: 8, paddingHorizontal: 11, justifyContent: 'center' },
  periodFooter: { flexDirection: 'row', marginTop: 10 },
  flex: { flex: 1, minWidth: 0 },
  select: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  option: { minHeight: 50, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  stepper: { borderRadius: 18, borderWidth: 1, paddingLeft: 16, paddingRight: 8, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchBox: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10, gap: 6 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 36 },
  stepControl: { flexDirection: 'row', alignItems: 'center', borderRadius: 11, height: 40 },
  stepButton: { width: 44, height: 40, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 30, textAlign: 'center' }
})
