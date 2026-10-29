import { useScheme } from '../providers/Theme'

/*
 * "Keçe pano" (felt board): a plain page (deep night blue in the dark, never black), matte felt
 * cards with no edge and no shadow, and the logo's three colours as the material of the lessons
 * (İngilizce sky, Duyusal sun, Özel pink). Every text pair passes AA on the surface it sits on.
 * The names in the second half are the older roles, kept so every screen reads the new material.
 */
const light = {
  // --- the board -------------------------------------------------------------------------------
  /** The screen, the header and the tab roots. */
  page: '#FFFFFF',
  /** A sheet's paper. */
  sheet: '#FFFFFF',
  /** Every neutral card, the search field, quiet buttons and chips. */
  felt: '#F1F4F7',
  /** The track of a segmented control or the attendance picker; a compact picker's pill; an empty bead. */
  track: '#E4E9EE',
  /** The same step as `track`, by the mock's name. */
  felt2: '#E4E9EE',
  /** A segment's thumb and a small button lifted off felt. */
  raised: '#FFFFFF',
  /** A tile set on felt: an avatar, a todo icon, a date tile (white here, a felt step up in the dark). */
  onFelt: '#FFFFFF',
  /** A felt row under the finger (felt darkened 4%). */
  pressed: '#E7EAED',
  /** Rules between rows inside a card, hour lines. */
  line: '#DFE5EA',
  ink: '#13202B',
  ink2: '#44525F',
  ink3: '#5D6A77',
  /** Never text: a planned bead's ring, an empty seat ring, a closed day. */
  mute: '#AEB8C1',
  /** Selection, links, today, chart "in". */
  accent: '#0086C6',
  /** Blue words: a phone number, the "Add" chip, the chosen tab. */
  accentInk: '#00679B',
  /** The one filled button of a screen, today's date circle. */
  fill: '#0077B3',
  onFill: '#FFFFFF',
  /** The chosen tab of the iPhone's own bar. */
  tabTint: '#00679B',
  /** Round buttons that float over the page (a drawing of the system's glass). */
  glass: 'rgba(255,255,255,0.86)',
  /** The shadow of what floats: round header buttons, a toast. */
  floatShadow: '0 8px 20px -10px rgba(16,40,60,0.30), 0 1px 3px rgba(16,40,60,0.10)',
  /** The shadow of what is lifted off felt: a segment's thumb, a small button. */
  liftShadow: '0 1px 2px rgba(16,40,60,0.14), 0 3px 8px -3px rgba(16,40,60,0.16)',

  // Lesson types: a whole card in the felt with words in the ink; the track and mid tone for its controls
  sky: '#0086C6',
  skyFelt: '#E0EFF9',
  skyInk: '#08466A',
  skyTrack: '#C9E2F3',
  sun: '#E9B200',
  sunFelt: '#FBEFC5',
  sunInk: '#634700',
  sunTrack: '#F2DD98',
  pink: '#DA5D87',
  pinkFelt: '#FAE3EB',
  pinkInk: '#872850',
  pinkTrack: '#F1C9D7',
  /** The time chip on the calendar's now-line, with its words. */
  nowChip: '#C2416F',
  onNowChip: '#FFFFFF',

  // Status: a 7pt dot and tinted words, never a filled block
  green: '#1E8A4C',
  greenInk: '#17703D',
  /** A tick drawn on green (a bead). */
  onGreen: '#FFFFFF',
  amber: '#E39A00',
  amberInk: '#8A4A00',
  /** A date tile whose day has passed with the job still open (amber 20% into white). */
  lateTile: '#F9EBCC',
  /** Money out. */
  out: '#E0752D',
  /** The cash part of the money bar. */
  cash: '#E9B200',

  // --- the older roles, on the new material ---------------------------------------------------
  ground: '#FFFFFF',
  surface: '#F1F4F7',
  surface2: '#FFFFFF',
  well: '#E4E9EE',
  line2: '#DFE5EA',
  lineStrong: '#C3CDD6',
  chevron: '#8F9AA5',
  toggle: '#0077B3',
  scrim: '#0A141E',
  accentLine: '#B5D9EE',
  accentWash: '#E0EFF9',
  accentWash2: '#C9E2F3',
  accentSolid: '#0077B3',
  onAccent: '#FFFFFF',
  action: '#E39A00',
  onAction: '#2B1D00',
  actionWash: '#FCF1D9',
  actionInk: '#8A4A00',
  actionLine: '#EFD59C',
  positive: '#1E8A4C',
  positiveInk: '#17703D',
  positiveWash: '#E3F4EA',
  positiveLine: '#B9E2C8',
  negative: '#D92D2D',
  negativeInk: '#B42318',
  negativeWash: '#FDECEC',
  negativeLine: '#F5C2C2',
  onNegative: '#FFFFFF',
  pinkWash: '#FAE3EB',
  pinkLine: '#F1C9D7',
  whatsapp: '#17703D',
  typeDuyusal: '#E9B200',
  typeIngilizce: '#0086C6',
  typeOzel: '#DA5D87',
  focus: '#0086C6',
  seriesIn: '#0086C6',
  seriesOut: '#E0752D',
  /** The deep fills behind a swipe's white words (AA in both themes). */
  swipeAccent: '#0077B3',
  swipePositive: '#1B7A43',
  swipeNegative: '#C92A2A'
}

export type Colors = typeof light

const dark: Colors = {
  page: '#0E151B',
  sheet: '#141C23',
  felt: '#18212A',
  track: '#222D37',
  felt2: '#222D37',
  // A thumb would sink into the dark track, so it is two steps lighter
  raised: '#33414E',
  onFelt: '#222D37',
  pressed: '#202A34',
  line: '#283440',
  ink: '#EDF2F6',
  ink2: '#B7C2CC',
  ink3: '#8F9BA7',
  mute: '#4E5B67',
  accent: '#3AA8E0',
  accentInk: '#8CCDF0',
  fill: '#0077B3',
  onFill: '#FFFFFF',
  tabTint: '#3AA8E0',
  glass: 'rgba(34,45,55,0.86)',
  floatShadow: '0 8px 20px -10px rgba(0,0,0,0.6), 0 1px 3px rgba(0,0,0,0.4)',
  liftShadow: '0 1px 2px rgba(0,0,0,0.35), 0 3px 8px -3px rgba(0,0,0,0.4)',

  sky: '#3AA8E0',
  skyFelt: '#10304A',
  skyInk: '#A9D8F5',
  skyTrack: '#1A4565',
  sun: '#E9B200',
  sunFelt: '#33290B',
  sunInk: '#F3D77E',
  sunTrack: '#4A3C12',
  pink: '#E57FA3',
  pinkFelt: '#371726',
  pinkInk: '#F2AECB',
  pinkTrack: '#522238',
  nowChip: '#E57FA3',
  onNowChip: '#2A0B17',

  green: '#3DBB72',
  greenInk: '#6FD39A',
  onGreen: '#0E151B',
  amber: '#F0B429',
  amberInk: '#F6C760',
  lateTile: '#3F3B2A',
  out: '#F08A45',
  cash: '#E9B200',

  ground: '#0E151B',
  surface: '#18212A',
  surface2: '#222D37',
  well: '#222D37',
  line2: '#283440',
  lineStrong: '#3A4855',
  chevron: '#6B7884',
  toggle: '#0077B3',
  scrim: '#000000',
  accentLine: '#1A4565',
  accentWash: '#10304A',
  accentWash2: '#1A4565',
  accentSolid: '#0077B3',
  onAccent: '#FFFFFF',
  action: '#F0B429',
  onAction: '#1C1003',
  actionWash: '#2E2410',
  actionInk: '#F6C760',
  actionLine: '#5A4413',
  positive: '#3DBB72',
  positiveInk: '#6FD39A',
  positiveWash: '#12301F',
  positiveLine: '#1F4A30',
  negative: '#E5484D',
  negativeInk: '#FCA5A5',
  negativeWash: '#3A1618',
  negativeLine: '#6B2222',
  onNegative: '#FFFFFF',
  pinkWash: '#371726',
  pinkLine: '#522238',
  whatsapp: '#6FD39A',
  typeDuyusal: '#E9B200',
  typeIngilizce: '#3AA8E0',
  typeOzel: '#E57FA3',
  focus: '#3AA8E0',
  seriesIn: '#3AA8E0',
  seriesOut: '#F08A45',
  swipeAccent: '#0077B3',
  swipePositive: '#1B7A43',
  swipeNegative: '#C92A2A'
}

export const palettes = { light, dark }

/** The three lesson types; anything else is drawn as a special event. */
export type LessonType = 'ingilizce' | 'duyusal' | 'ozel'

export const lessonTypeOf = (type: string | null | undefined): LessonType => (type === 'ingilizce' || type === 'duyusal' ? type : 'ozel')

/** A lesson type's material: the card's felt, its words, the track of its controls, its mid tone and a thumb on that track. */
export type TypeTone = { felt: string; ink: string; track: string; mid: string; thumb: string; dark: boolean }

// On a type card in the dark the thumb is the type's ink mixed 24% into its track
const DARK_THUMB: Record<LessonType, string> = { ingilizce: '#3C6888', duyusal: '#72612C', ozel: '#78445B' }

/** The felt, ink, track and mid tone of a lesson type in the current theme. */
export function typeTone(c: Colors, type: string | null | undefined): TypeTone {
  const kind = lessonTypeOf(type)
  const dark = c.page !== light.page
  const [felt, ink, track, mid] =
    kind === 'ingilizce' ? [c.skyFelt, c.skyInk, c.skyTrack, c.sky] : kind === 'duyusal' ? [c.sunFelt, c.sunInk, c.sunTrack, c.sun] : [c.pinkFelt, c.pinkInk, c.pinkTrack, c.pink]
  return { felt, ink, track, mid, thumb: dark ? DARK_THUMB[kind] : c.raised, dark }
}

/**
 * Hues callers once gave the tiles before settings rows (light, dark). Tiles are drawn in one quiet
 * grey now; the names stay so callers compile until they drop them.
 */
export const TILE_TONES = {
  blue: ['#0086C6', '#3AA8E0'],
  green: ['#1E8A4C', '#3DBB72'],
  orange: ['#E0752D', '#F08A45'],
  pink: ['#DA5D87', '#E57FA3'],
  gray: ['#5D6A77', '#8F9BA7'],
  teal: ['#30B0C7', '#40C8E0'],
  yellow: ['#E9B200', '#E9B200'],
  red: ['#D92D2D', '#E5484D']
} as const

export type TileTone = keyof typeof TILE_TONES

/** A palette colour seen through: "#0086c6" at 0.3 → "rgba(0,134,198,0.3)". */
export function tint(hex: string, alpha: number) {
  const value = Number.parseInt(hex.slice(1, 7), 16)
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`
}

export function useColors(): Colors {
  return useScheme() === 'dark' ? dark : light
}
