import { NOTE_COLORS } from '../api'

export const PLAIN_NOTE = '#ffffff'

/** A stored colour the screen knows; anything else is shown plain, as the old screen did. */
export function noteColor(value: string | null | undefined) {
  return value && (NOTE_COLORS as readonly string[]).includes(value) && value !== PLAIN_NOTE ? value : null
}

/** What gets pasted into a message: the text, or the title of a note that has none. */
export const copyable = (note: { title: string; content: string | null }) => note.content?.trim() || note.title.trim()
