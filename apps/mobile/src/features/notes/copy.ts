import { useCallback } from 'react'
import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'
import { copyable } from '@hellokido/core/view'

/** Puts a note on the clipboard for a message; says whether it worked, the caller tells the person. */
export function useCopyNote() {
  return useCallback(async (note: { title: string; content: string | null }) => {
    try {
      await Clipboard.setStringAsync(copyable(note))
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      return true
    } catch {
      return false
    }
  }, [])
}
