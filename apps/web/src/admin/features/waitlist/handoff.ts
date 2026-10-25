import { useCallback } from 'react'
import { deleteWaitlistEntry, restoreWaitlistEntry, type WaitlistEntry } from '@hellokido/core/api'
import { useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useToast } from '../../providers/Toasts'

/**
 * After a family from the waitlist is registered, their entry goes: they no longer wait. The toast
 * can bring the entry back as it was, in case the wrong one was taken off.
 */
export function useTakeOffWaitlist() {
  const { t, fmt } = useI18n()
  const toast = useToast()
  const refresh = useRefresh()

  return useCallback(
    async (entry: WaitlistEntry) => {
      const name = entry.student_name
      const restore = async () => {
        try {
          await restoreWaitlistEntry(entry)
          toast({ tone: 'success', title: fmt(t.waitlist.restored, { name }) })
        } catch {
          toast({ tone: 'error', title: t.waitlist.undoFailed })
        } finally {
          void refresh.waitlist()
        }
      }
      try {
        await deleteWaitlistEntry(entry.id)
        toast({
          tone: 'success',
          title: fmt(t.waitlist.registered, { name }),
          body: t.waitlist.registeredBody,
          action: { label: t.common.undo, onAction: () => void restore() }
        })
      } catch {
        toast({ tone: 'warning', title: t.waitlist.removeFailed })
      } finally {
        void refresh.waitlist()
      }
    },
    [t, fmt, toast, refresh]
  )
}
