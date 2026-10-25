import 'expo-sqlite/localStorage/install'

/** Small settings of this phone (language, appearance); nothing here is needed to work. */
export function readSetting(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeSetting(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage unavailable: the choice lasts until the app closes
  }
}
