import { useColorScheme } from 'react-native'

// The phone's palette after the approved design (DESIGN.md): a warm grey canvas, white cards with
// a hairline, neutral inks and the HelloKido blue. Outlined chips use the `*Line` borders.
const light = {
  ground: '#f5f5f3',
  rail: '#ffffff',
  surface: '#ffffff',
  surface2: '#f6f5f2',
  /** A grey band across a card: the head of a group of rows. */
  band: '#faf9f7',
  well: '#f6f5f2',
  /** The chosen piece lifted off a well, such as the selected segment. */
  raised: '#ffffff',
  line: '#e6e4df',
  /** The rule between rows inside a card, a step lighter than its edge. */
  line2: '#efede8',
  lineStrong: '#d3d0c8',
  track: '#efede8',
  ink: '#1c1b18',
  ink2: '#5c5850',
  ink3: '#6f6a61',
  accent: '#0086c6',
  accentInk: '#00679b',
  accentLine: '#c0dcec',
  accentWash: '#edf5fa',
  accentWash2: '#e3f1f9',
  accentSolid: '#0077b3',
  onAccent: '#ffffff',
  action: '#e3a300',
  onAction: '#2b1d00',
  actionWash: '#fdf8ea',
  actionInk: '#8a5a00',
  actionLine: '#ecd9a6',
  positive: '#22a55a',
  positiveInk: '#1d7f46',
  positiveWash: '#ecf6f0',
  positiveLine: '#bfe1cc',
  negative: '#dc2626',
  negativeInk: '#b91c1c',
  negativeWash: '#fef2f2',
  negativeLine: '#f5c2c2',
  onNegative: '#ffffff',
  pink: '#db5a8a',
  pinkInk: '#a3365f',
  pinkWash: '#fdf1f5',
  pinkLine: '#f2c4d5',
  whatsapp: '#1d7f46',
  typeDuyusal: '#e0a100',
  typeIngilizce: '#0086c6',
  typeOzel: '#db5a8a',
  focus: '#0086c6',
  seriesIn: '#0086c6',
  seriesOut: '#e0752d'
}

export type Colors = typeof light

const dark: Colors = {
  ground: '#0a0a0a',
  rail: '#111111',
  surface: '#161616',
  surface2: '#1c1c1c',
  band: '#1a1a1a',
  well: '#1c1c1c',
  // A surface would sink into the dark well, so the chosen piece is lighter instead
  raised: '#2e2e2e',
  line: '#2a2a2a',
  line2: '#232323',
  lineStrong: '#3a3a3a',
  track: '#2a2a2a',
  ink: '#fafafa',
  ink2: '#d4d4d4',
  ink3: '#a3a3a3',
  accent: '#38a8e0',
  accentInk: '#7cc6ec',
  accentLine: '#1f4e6b',
  accentWash: '#0b2231',
  accentWash2: '#10304a',
  accentSolid: '#0077b3',
  onAccent: '#ffffff',
  action: '#f5a623',
  onAction: '#1c1003',
  actionWash: '#2a1d05',
  actionInk: '#fcd27a',
  actionLine: '#6b4a10',
  positive: '#34c172',
  positiveInk: '#7ddca4',
  positiveWash: '#0c2416',
  positiveLine: '#1d5634',
  negative: '#ef4444',
  negativeInk: '#fca5a5',
  negativeWash: '#2c1010',
  negativeLine: '#6b2222',
  onNegative: '#ffffff',
  pink: '#ec7fa6',
  pinkInk: '#f6afc8',
  pinkWash: '#2b1019',
  pinkLine: '#6b2a43',
  whatsapp: '#34c172',
  typeDuyusal: '#f0b429',
  typeIngilizce: '#38a8e0',
  typeOzel: '#ec7fa6',
  focus: '#38a8e0',
  seriesIn: '#38a8e0',
  seriesOut: '#e9864a'
}

export const palettes = { light, dark }

/** A palette colour seen through: "#0086c6" at 0.3 → "rgba(0,134,198,0.3)". */
export function tint(hex: string, alpha: number) {
  const value = Number.parseInt(hex.slice(1), 16)
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`
}

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light
}
