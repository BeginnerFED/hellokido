import { flushSync } from 'react-dom'

/**
 * Applies a while-typing correction (capital first letters, digits only) without throwing the caret
 * to the end of the field: the corrected text is written at once and the caret goes back to where
 * the person was typing.
 */
export function keepCaret(
  input: HTMLInputElement | HTMLTextAreaElement | null,
  typed: string,
  transform: (text: string) => string,
  commit: (text: string) => void
) {
  const next = transform(typed)
  const caret = input?.selectionStart ?? null
  if (!input || next === typed || caret === null || document.activeElement !== input) {
    commit(next)
    return
  }
  const nextCaret = transform(typed.slice(0, caret)).length
  flushSync(() => commit(next))
  input.setSelectionRange(nextCaret, nextCaret)
}
