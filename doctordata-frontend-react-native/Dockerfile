# syntax=docker/dockerfile:1
#
# Genera el APK de Android sin necesitar el Android SDK localmente.
# Split en dos stages porque expo prebuild necesita Node 20 LTS,
# mientras que gradlew necesita el Android SDK.
#
# Para compilar y extraer el APK:
#   docker build --target export --output type=local,dest=./output .

#############
# prebuild: expo prebuild en Node 20 (evita incompatibilidad de plugins ESM)
#############
FROM node:20-slim AS prebuild
WORKDIR /app

RUN npm install -g pnpm@10.34.1

COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

COPY . .

# CI=1 reemplaza a --non-interactive (deprecado en Expo 53)
RUN CI=1 pnpm exec expo prebuild --platform android --no-install

#############
# build: Gradle assembleDebug con Android SDK
#############
FROM reactnativecommunity/react-native-android:latest AS build
WORKDIR /app

# El react{} block de android/app/build.gradle ejecuta `node` durante la fase de
# configuración de Gradle para resolver entryFile, reactNativeDir, hermesCommand y
# cliFile. Sin node en PATH, .execute().text devuelve "" y file("") lanza el error
# "Cannot convert '' to File". Se instala Node.js 20 LTS directamente en esta imagen.
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends curl ca-certificates && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/*

# Copiar todo el proyecto desde prebuild (android/ generado, node_modules, fuentes,
# app.json, babel.config, etc.). El bundler de Metro también necesita los fuentes JS
# durante assembleDebug para generar el bundle que va dentro del APK.
COPY --from=prebuild /app/ ./

# local.properties no lo genera expo prebuild; lo requiere el Android SDK del contenedor
RUN echo "sdk.dir=${ANDROID_HOME}" > android/local.properties

WORKDIR /app/android

# El React Native Gradle Plugin trata "debug" como variante "debuggable" por defecto, lo que
# SALTA el empaquetado del bundle de JS (asume un Metro corriendo en vivo) — sin esto, el APK
# queda sin ni una línea de JS adentro y la app no pasa nunca del splash nativo. Se resuelve
# con debuggableVariants = [] en android/app/build.gradle, inyectado vía el config plugin
# plugins/withDebugBundle.js (ese archivo se regenera en cada expo prebuild, así que no se
# puede simplemente editar a mano). El viejo "BUNDLE_IN_DEBUG=true" en gradle.properties que
# vivía acá nunca tuvo efecto — no aparece en ningún lado del build.gradle generado.

RUN ./gradlew assembleDebug --no-daemon

#############
# export: imagen Alpine mínima con el APK listo para extraer
# Uso: docker build --target export -t dd-apk .
#      docker create --name dd-tmp dd-apk && docker cp dd-tmp:/app-debug.apk ./output/ && docker rm dd-tmp
#############
FROM alpine:3 AS export
COPY --from=build /app/android/app/build/outputs/apk/debug/app-debug.apk /app-debug.apk
