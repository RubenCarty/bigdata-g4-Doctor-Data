const { withAppBuildGradle } = require('expo/config-plugins')

// El React Native Gradle Plugin trata "debug" como variante "debuggable" por defecto, lo que
// significa que SALTA el empaquetado del bundle de JS (asume que vas a conectarte a un
// servidor Metro corriendo en vivo durante el desarrollo). Para esta app no hay servidor Metro
// — el APK debug se genera una sola vez con Docker y se instala tal cual en el celular de QA,
// así que necesita el bundle embebido igual que un build de producción. El propio
// android/app/build.gradle generado por expo prebuild ya trae el comentario que explica esto
// (react { ... debuggableVariants = [...] ... }) — pero ese archivo se regenera desde cero en
// cada prebuild, así que hay que parchearlo con un config plugin en vez de editarlo a mano.
module.exports = function withDebugBundle(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.contents.includes('debuggableVariants = []')) {
      return config
    }
    config.modResults.contents = config.modResults.contents.replace(
      /react\s*\{/,
      'react {\n    debuggableVariants = []'
    )
    return config
  })
}
