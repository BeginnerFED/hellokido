// The database client has to exist before any screen reads through the shared rules
import '../lib/supabase'
import { useEffect, useMemo } from 'react'
import { useFonts } from 'expo-font'
import { QueryClientProvider } from '@tanstack/react-query'
import { DarkTheme, DefaultTheme, SplashScreen, Stack, ThemeProvider as NavigationTheme } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { watchConnection } from '../lib/network'
import { queryClient } from '../lib/query'
import { AuthProvider, useAuth } from '../providers/Auth'
import { I18nProvider } from '../providers/I18n'
import { applySavedTheme, ThemeProvider, useScheme } from '../providers/Theme'
import { useColors } from '../theme/colors'
import { FONT_ASSETS, setFontsReady } from '../theme/fonts'
import { sheetOptions } from '../ui/Sheet'
import { ToastProvider } from '../ui/Toast'

applySavedTheme()
watchConnection()
void SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  // Geologica is part of the app (assets), so this is quick; the splash stays until it is in. If it
  // cannot be read the app goes on in the system font rather than staying on the splash.
  const [fontsLoaded, fontError] = useFonts(FONT_ASSETS)
  if (!fontsLoaded && !fontError) return null
  setFontsReady(fontsLoaded)
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <ThemeProvider>
            <AuthProvider>
              <ToastProvider>
                <Navigation />
              </ToastProvider>
            </AuthProvider>
          </ThemeProvider>
        </I18nProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  )
}

function Navigation() {
  const c = useColors()
  const scheme = useScheme()
  const { session, loading, isAdmin } = useAuth()

  // The splash stays until the stored session is read, so nobody sees the sign-in screen flash by
  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync()
  }, [loading])

  const theme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme
    return { ...base, colors: { ...base.colors, primary: c.accentInk, background: c.page, card: c.page, text: c.ink, border: c.line, notification: c.amber } }
  }, [c, scheme])

  if (loading) return null
  const signedIn = Boolean(session)
  const sheet = sheetOptions(c)

  return (
    <NavigationTheme value={theme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.page } }}>
        {/* While the admin check is still running the panel opens; the data itself is guarded by the database */}
        <Stack.Protected guard={signedIn && isAdmin !== false}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="payment" options={sheet} />
          <Stack.Screen name="registration" options={sheet} />
          <Stack.Screen name="extension-edit" options={sheet} />
          <Stack.Screen name="income" options={sheet} />
          <Stack.Screen name="expense" options={sheet} />
          <Stack.Screen name="recurring" options={sheet} />
          <Stack.Screen name="note" options={sheet} />
          <Stack.Screen name="waitlist-entry" options={sheet} />
          <Stack.Screen name="package" options={sheet} />
          <Stack.Screen name="category" options={sheet} />
          <Stack.Screen name="card-settings" options={sheet} />
          <Stack.Screen name="message-template" options={sheet} />
          <Stack.Screen name="workshop" options={sheet} />
          <Stack.Screen name="finance-period" options={sheet} />
          <Stack.Screen name="grant-access" options={sheet} />
          <Stack.Screen name="lesson-form" options={sheet} />
          <Stack.Screen name="lesson-children" options={sheet} />
          <Stack.Screen name="week-theme" options={sheet} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && isAdmin === false}>
          <Stack.Screen name="no-access" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" />
        </Stack.Protected>
      </Stack>
    </NavigationTheme>
  )
}
