import { createContext, useContext } from 'react'

/** Tasks that can be started from anywhere: quick add, the command palette, page buttons. */
export type TaskKind = 'payment' | 'expense' | 'income' | 'registration' | 'lesson' | 'note' | 'waitlist'

/** `id` is new for every request, so the same task started twice opens a fresh form. */
export type TaskRequest = { kind: TaskKind; params?: Record<string, unknown>; id: number }

export type ActionsValue = {
  openQuickAdd: () => void
  openPalette: () => void
  startTask: (kind: TaskKind, params?: Record<string, unknown>) => void
}

export const ActionsContext = createContext<ActionsValue | null>(null)

export function useActions(): ActionsValue {
  const value = useContext(ActionsContext)
  if (!value) throw new Error('useActions must be used inside ActionsProvider')
  return value
}
