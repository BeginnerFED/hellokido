import { addNetworkStateListener, getNetworkStateAsync, type NetworkState } from 'expo-network'
import { onlineManager } from '@tanstack/react-query'

// A phone that only knows it has Wi-Fi but no internet is not online yet (null means not checked yet)
const isOnline = (state: NetworkState) => state.isConnected !== false && state.isInternetReachable !== false

/**
 * Reads pause while the phone has no connection and go again once it is back, as on the web panel.
 * Called once at start-up.
 */
export function watchConnection() {
  onlineManager.setEventListener((setOnline) => {
    void getNetworkStateAsync()
      .then((state) => setOnline(isOnline(state)))
      .catch(() => undefined)
    const subscription = addNetworkStateListener((state) => setOnline(isOnline(state)))
    return () => subscription.remove()
  })
}
