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

export function Text({ variant = 'body', tone = 'ink', weight, tabular, align, style, ...props }: Props) {
  const c = useColors()
  return (
    <NativeText
      {...props}
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
