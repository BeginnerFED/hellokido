import { SymbolView, type AndroidSymbol, type SFSymbol, type SymbolWeight } from 'expo-symbols'
import type { ColorValue } from 'react-native'

// SF Symbols on the iPhone; Material Symbols on the Android test phone
const ICONS = {
  add: ['plus', 'add'],
  archive: ['archivebox', 'archive'],
  bag: ['bag', 'shopping_bag'],
  bank: ['building.columns', 'account_balance'],
  bolt: ['bolt', 'bolt'],
  brush: ['paintbrush', 'brush'],
  cake: ['birthday.cake', 'cake'],
  calendar: ['calendar', 'calendar_month'],
  call: ['phone', 'call'],
  card: ['creditcard', 'credit_card'],
  chat: ['message', 'chat'],
  check: ['checkmark', 'check'],
  checkCircle: ['checkmark.circle.fill', 'check_circle'],
  chevronDown: ['chevron.down', 'expand_more'],
  chevronLeft: ['chevron.left', 'chevron_left'],
  chevronRight: ['chevron.right', 'chevron_right'],
  clock: ['clock', 'schedule'],
  close: ['xmark', 'close'],
  copy: ['doc.on.doc', 'content_copy'],
  cube: ['cube', 'deployed_code'],
  delete: ['trash', 'delete'],
  drop: ['drop', 'water_drop'],
  edit: ['pencil', 'edit'],
  ellipsis: ['ellipsis', 'more_horiz'],
  expense: ['arrow.up.right', 'north_east'],
  external: ['arrow.up.right.square', 'open_in_new'],
  flame: ['flame', 'local_fire_department'],
  group: ['person.2', 'group'],
  history: ['clock.arrow.circlepath', 'history'],
  house: ['house', 'home'],
  income: ['arrow.down.left', 'south_west'],
  info: ['info.circle', 'info'],
  kitchen: ['fork.knife', 'restaurant'],
  language: ['globe', 'language'],
  lock: ['lock', 'lock'],
  logout: ['rectangle.portrait.and.arrow.right', 'logout'],
  megaphone: ['megaphone', 'campaign'],
  money: ['turkishlirasign.circle', 'payments'],
  moon: ['circle.lefthalf.filled', 'dark_mode'],
  more: ['ellipsis.circle', 'more_horiz'],
  note: ['note.text', 'sticky_note_2'],
  party: ['party.popper', 'celebration'],
  offline: ['wifi.slash', 'wifi_off'],
  person: ['person', 'person'],
  personAdd: ['person.badge.plus', 'person_add'],
  receipt: ['list.bullet.rectangle.portrait', 'receipt_long'],
  refresh: ['arrow.clockwise', 'refresh'],
  search: ['magnifyingglass', 'search'],
  settings: ['gearshape', 'settings'],
  star: ['star', 'star'],
  starFill: ['star.fill', 'star'],
  sun: ['sun.max', 'sunny'],
  unarchive: ['tray.and.arrow.up', 'unarchive'],
  undo: ['arrow.uturn.backward', 'undo'],
  waitlist: ['hourglass', 'hourglass_empty'],
  wallet: ['turkishlirasign.circle', 'account_balance_wallet'],
  warning: ['exclamationmark.circle.fill', 'error'],
  wifi: ['wifi', 'wifi']
} satisfies Record<string, [SFSymbol, AndroidSymbol]>

export type IconName = keyof typeof ICONS

export function Icon({ name, size = 20, color, weight }: { name: IconName; size?: number; color: ColorValue; weight?: SymbolWeight }) {
  const [ios, android] = ICONS[name]
  return <SymbolView name={{ ios, android }} size={size} tintColor={color} weight={weight} />
}

/** The pair for places that take symbol names themselves (tab bar, header menus). */
export const symbolOf = (name: IconName) => ({ ios: ICONS[name][0], android: ICONS[name][1] })
