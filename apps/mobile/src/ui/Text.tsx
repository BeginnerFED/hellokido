import { useState } from 'react'
import { Text as NativeText, type TextProps, type TextStyle } from 'react-native'
import { useColors, type Colors } from '../theme/colors'

// Close to the iPhone's own type sizes (system font); headings are set a little tighter
const VARIANTS = {
  title: { fontSize: 25, lineHeight: 30, fontWeight: '600', letterSpacing: -0.5 },
  section: { fontSize: 21, lineHeight: 25, fontWeight: '600', letterSpacing: -0.38 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400' },
  sub: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  foot: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' }
} satisfies Record<string, TextStyle>

/**
 * The phone's larger text sizes are followed up to this step. Past it, the words would no longer
 * fit the pills, chips and rows that hold them (the larger settings are still well read at 1.4).
 */
export const MAX_FONT_SCALE = 1.4

export type TextVariant = keyof typeof VARIANTS
export type TextTone = 'ink' | 'ink2' | 'ink3' | 'accentInk' | 'actionInk' | 'positiveInk' | 'negativeInk' | 'pinkInk' | 'onAccent'

type Props = TextProps & {
  variant?: TextVariant
  tone?: TextTone
  weight?: TextStyle['fontWeight']
  /** Numbers that line up in columns (times, counts, amounts). */
  tabular?: boolean
  align?: TextStyle['textAlign']
}

export function Text({ variant = 'body', tone = 'ink', weight, tabular, align, style, maxFontSizeMultiplier = MAX_FONT_SCALE, ...props }: Props) {
  const c = useColors()
  return (
    <NativeText
      {...props}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[
        VARIANTS[variant],
        { color: c[tone as keyof Colors] },
        weight !== undefined && { fontWeight: weight },
        tabular && { fontVariant: ['tabular-nums'] },
        align !== undefined && { textAlign: align },
        style
      ]}
    />
  )
}

/**
 * The dot between the parts of a line ("Twice a week · 24 Oct"). The space before it never breaks,
 * so a wrapped line never starts with the dot and the dot never stands on its own.
 */
export const DOT = '\u00a0· '

type Part = string | false | null | undefined

/** Words that stay on one line ("Card 5.850 ₺", "14 Oct – 1 Jan"): a line may break between them, never inside. */
export const together = (text: string) => text.replace(/ /g, '\u00a0')

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
