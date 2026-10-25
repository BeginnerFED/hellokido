import { useSyncExternalStore } from 'react'
import { WifiSlashIcon } from '@phosphor-icons/react'
import { useI18n } from '../providers/I18n'

const subscribe = (notify: () => void) => {
  window.addEventListener('online', notify)
  window.addEventListener('offline', notify)
  return () => {
    window.removeEventListener('online', notify)
    window.removeEventListener('offline', notify)
  }
}

/** Stays while the device has no connection. Pages wait instead of failing and load again once it is back. */
export function OfflineNotice() {
  const { t } = useI18n()
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true)
  if (online) return null
  return (
    <div
      role="status"
      className="pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-panel border border-line bg-surface px-4 py-3 text-ink shadow-lift"
    >
      <WifiSlashIcon aria-hidden className="mt-px size-5 shrink-0 text-ink-2" />
      <p className="text-sm text-pretty">{t.shell.offline}</p>
    </div>
  )
}
