import type { TextStyle } from 'react-native'

/**
 * Geologica (SIL Open Font License, assets/fonts/OFL.txt): four static faces. Each is loaded under
 * its PostScript name, which is also how the iPhone finds it, and each weight is a family of its
 * own, as neither phone can make a weight for a custom family by itself.
 */
export const FONT_ASSETS = {
  'Geologica-Regular': require('../../assets/fonts/Geologica-Regular.ttf'),
  'Geologica-Medium': require('../../assets/fonts/Geologica-Medium.ttf'),
  'Geologica-SemiBold': require('../../assets/fonts/Geologica-SemiBold.ttf'),
  'Geologica-Bold': require('../../assets/fonts/Geologica-Bold.ttf')
}

// Set once by the root layout before the first screen is drawn; false keeps the system font
let ready = false

export function setFontsReady(value: boolean) {
  ready = value
}

export const fontsReady = () => ready

type Weight = TextStyle['fontWeight']

/** The face for a weight: 400 and less Regular, 500 Medium, 600 SemiBold, 700 and more Bold. */
export function familyFor(weight: Weight): string {
  const value = weight === 'bold' ? 700 : weight === 'normal' || weight === undefined ? 400 : Number(weight)
  if (value >= 700) return 'Geologica-Bold'
  if (value >= 600) return 'Geologica-SemiBold'
  if (value >= 500) return 'Geologica-Medium'
  return 'Geologica-Regular'
}

/**
 * The type of a weight for styles the Text component does not draw (inputs, header titles): the
 * Geologica face once it is loaded, the system font at that weight otherwise.
 */
export function fontOf(weight: Weight = '400'): Pick<TextStyle, 'fontFamily' | 'fontWeight'> {
  return ready ? { fontFamily: familyFor(weight) } : { fontWeight: weight }
}
