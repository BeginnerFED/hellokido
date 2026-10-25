import { useState } from 'react'
import { Text as NativeText, StyleSheet, type TextProps, type TextStyle } from 'react-native'
import { familyFor, fontsReady } from '../theme/fonts'
import { useColors, type Colors } from '../theme/colors'

// Geologica, set big and confident for times and money; letter spacing is in points (em × size)
const VARIANTS = {
  /** Today's hero time ("10:00–11:30"). */
  hero: { fontSize: 36, lineHeight: 40, fontWeight: '600', letterSpacing: -1.1 },
  /** The money to share on Finance. */
  money: { fontSize: 46, lineHeight: 50, fontWeight: '600', letterSpacing: -1.6 },
  /** A child's lessons left. */
  bigCount: { fontSize: 48, lineHeight: 50, fontWeight: '600', letterSpacing: -1.7 },
  /** The in-content title of a tab root. */
  title: { fontSize: 30, lineHeight: 36, fontWeight: '600', letterSpacing: -0.75 },
  /** A time, a count or an amount in a tile or a list's right column. */
  figure: { fontSize: 22, lineHeight: 26, fontWeight: '600', letterSpacing: -0.45 },
  /** A section head ("Seni bekleyenler"). */
  section: { fontSize: 20, lineHeight: 26, fontWeight: '600', letterSpacing: -0.3 },
  /** A lesson type line, a sheet title, a period name. */
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 21, fontWeight: '400' },
  /** Kept for the screens that still ask for it: the body size. */
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400' },
  /** Sub-lines under a row's title. */
  sub: { fontSize: 13.5, lineHeight: 18, fontWeight: '400' },
  /** Segments, chips, marks, small buttons. */
  label: { fontSize: 13.5, lineHeight: 17, fontWeight: '500' },
  /** Weekdays, legends, hour labels, notes under a group. */
  foot: { fontSize: 12.5, lineHeight: 16, fontWeight: '400' },
  /** Nothing is set under 11pt. */
  caption: { fontSize: 11.5, lineHeight: 15, fontWeight: '400' }
} satisfies Record<string, TextStyle>

/**
 * The phone's larger text sizes are followed up to this step. Past it, the words would no longer
 * fit the pills, chips and rows that hold them (the larger settings are still well read at 1.4).
 */
export const MAX_FONT_SCALE = 1.4

export type TextVariant = keyof typeof VARIANTS
export type TextTone =
  | 'ink'
  | 'ink2'
  | 'ink3'
  | 'accentInk'
  | 'actionInk'
  | 'positiveInk'
  | 'negativeInk'
  | 'pinkInk'
  | 'onAccent'
  | 'onFill'
  | 'greenInk'
  | 'amberInk'
  | 'skyInk'
  | 'sunInk'

type Props = TextProps & {
  variant?: TextVariant
  tone?: TextTone
  weight?: TextStyle['fontWeight']
  /** Numbers that line up in columns (times, counts, amounts). */
  tabular?: boolean
  align?: TextStyle['textAlign']
}

/**
 * Text in Geologica: the weight asked for (by the variant, `weight` or a style) picks the face, as
 * each weight is a family of its own. Until the font is there, or if it never loads, the system font.
 */
export function Text({ variant = 'body', tone = 'ink', weight, tabular, align, style, maxFontSizeMultiplier = MAX_FONT_SCALE, ...props }: Props) {
  const c = useColors()
  const flat = StyleSheet.flatten([
    VARIANTS[variant],
    { color: c[tone as keyof Colors] },
    weight !== undefined && { fontWeight: weight },
    tabular && { fontVariant: ['tabular-nums'] as TextStyle['fontVariant'] },
    align !== undefined && { textAlign: align },
    style
  ]) as TextStyle
  const face: TextStyle = fontsReady() && !flat.fontFamily ? { ...flat, fontFamily: familyFor(flat.fontWeight), fontWeight: undefined } : flat
  return <NativeText {...props} maxFontSizeMultiplier={maxFontSizeMultiplier} style={face} />
}

/**
 * The dot between the parts of a line ("Twice a week · 24 Oct"). The space before it never breaks,
 * so a wrapped line never starts with the dot and the dot never stands on its own.
 */
export const DOT = ' · '

type Part = string | false | null | undefined

/** Words that stay on one line ("Card 5.850 ₺", "14 Oct – 1 Jan"): a line may break between them, never inside. */
export const together = (text: string) => text.replace(/ /g, ' ')

/** The parts of a line joined by the dot; empty parts are left out. */
export const dots = (...parts: Part[]) => parts.filter(Boolean).join(DOT)

/**
 * A sub-line of parts joined by the dot ("3 months · 14 Oct – 1 Jan"). When they do not fit one
 * line, each part takes a line of its own instead of wrapping around a dot.
 */
export function DotLine({ parts, numberOfLines, ...props }: Omit<Props, 'children'> & { parts: Part[] }) {
  const shown = parts.filter((part): part is string => Boolean(part))
  const joined = shown.join(DOT)
  // Kept for the text it was measured on, so other parts are measured afresh
  const [split, setSplit] = useState<string | null>(null)
  const apart = split === joined && shown.length > 1
  return (
    <Text
      {...props}
      numberOfLines={apart && numberOfLines ? Math.max(numberOfLines, shown.length) : numberOfLines}
      onTextLayout={
        apart
          ? undefined
          : (event) => {
              if (event.nativeEvent.lines.length > 1) setSplit(joined)
            }
      }
    >
      {apart ? shown.join('\n') : joined}
    </Text>
  )
}
