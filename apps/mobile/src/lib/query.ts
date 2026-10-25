import { AppState } from 'react-native'
import { focusManager, QueryClient } from '@tanstack/react-query'

// Coming back to the app counts as focus: stale lists read again, as on the web
focusManager.setEventListener((setFocused) => {
  const subscription = AppState.addEventListener('change', (state) => setFocused(state === 'active'))
  return () => subscription.remove()
})

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // The database client already retries a dropped read (1, 2 and 4 s)
      retry: false
    }
  }
})
