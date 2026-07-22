import { SafeAreaView } from 'react-native-safe-area-context'

// El header del native-stack ya respeta el notch/status bar arriba; lo que falta en Android es
// el margen inferior contra la barra de gestos/botones del sistema, que ninguna pantalla tenía
// en cuenta (contenido quedaba tapado por la barra de navegación de Android).
export default function Screen({ children, style }) {
  return (
    <SafeAreaView edges={['bottom']} style={[{ flex: 1 }, style]}>
      {children}
    </SafeAreaView>
  )
}
