import { useCallback, useState } from 'react'

/**
 * Open state of a sheet that works on something (a child, a payment). The payload stays while the
 * sheet slides out, and every opening gets a new key so the form inside starts fresh.
 */
export function useSheet<T>() {
  const [state, setState] = useState<{ payload: T | null; isOpen: boolean; key: number }>({ payload: null, isOpen: false, key: 0 })
  const open = useCallback((payload: T) => setState((s) => ({ payload, isOpen: true, key: s.key + 1 })), [])
  const setOpen = useCallback((isOpen: boolean) => setState((s) => ({ ...s, isOpen })), [])
  return { ...state, open, setOpen }
}
