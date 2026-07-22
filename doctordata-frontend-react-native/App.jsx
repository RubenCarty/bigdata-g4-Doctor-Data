import { useEffect } from 'react'
import { registerRootComponent } from 'expo'
import { StatusBar } from 'expo-status-bar'
import { useFonts } from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider } from './src/context/AuthContext'
import AppNavigator from './src/navigation/AppNavigator'
import DebugBanner from './src/components/DebugBanner'
import LoadingScreen from './src/components/LoadingScreen'

SplashScreen.preventAutoHideAsync()

function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  )
}

function AppContent() {
  const [fontsLoaded, fontError] = useFonts({
    'Lato-Regular': require('./src/assets/fonts/Lato-Regular.ttf'),
    'Lato-Bold':    require('./src/assets/fonts/Lato-Bold.ttf'),
    'Quadon':       require('./src/assets/fonts/Quadon.otf'),
  })

  useEffect(() => {
    // El splash nativo se oculta en cuanto JS carga;
    // la pantalla de carga custom (LoadingScreen) toma el relevo mientras cargan las fuentes
    // y, después, mientras AuthContext verifica la sesión (ver AppNavigator.jsx).
    SplashScreen.hideAsync()
  }, [])

  if (!fontsLoaded && !fontError) {
    return (
      <>
        <DebugBanner />
        <LoadingScreen step="fonts" />
      </>
    )
  }

  if (fontError) {
    // No debería pasar con fuentes embebidas en el bundle, pero si pasa, mejor mostrar algo
    // que quedarse en un splash congelado sin ninguna pista de qué falló. Sin onRetry — no
    // hay nada que reintentar, es un recurso embebido en el propio APK.
    return (
      <>
        <DebugBanner />
        <LoadingScreen step="fonts" error="fonts" />
      </>
    )
  }

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <DebugBanner />
      <AppNavigator />
    </AuthProvider>
  )
}

// "main" en package.json apunta directo a este archivo en vez de al entry point estándar de
// Expo (node_modules/expo/AppEntry.js), así que ese registro hay que hacerlo acá a mano — sin
// esto, React Native nunca se entera de cuál es el componente raíz y el splash nativo se queda
// congelado para siempre, aunque el bundle de JS se haya entregado y evaluado correctamente.
registerRootComponent(App)
