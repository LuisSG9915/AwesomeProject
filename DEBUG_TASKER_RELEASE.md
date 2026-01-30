# 🐛 Guía de Debug - Problema Tasker en Release

## 📋 Problema Identificado

En **modo debug** la validación funciona correctamente y Tasker NO se abre si ya está activo.
En **modo release** la validación falla y Tasker se abre siempre, incluso si ya está activo.

## 🔍 Causa Probable

**R8 (el ofuscador de Android)** está rompiendo la comunicación entre:
- `TaskerWakeUpModule` (envía el broadcast y espera respuesta)
- `TaskerResponseReceiver` (recibe la respuesta de Tasker)

El **listener estático** se está perdiendo en release debido a la ofuscación.

## ✅ Solución Aplicada

Se agregaron reglas ProGuard/R8 en `android/app/proguard-rules.pro` para proteger:
- El módulo `TaskerWakeUpModule`
- El receiver `TaskerResponseReceiver`
- La interfaz `ResponseListener`
- El campo estático `responseListener` (CRÍTICO)

## 🧪 Cómo Debugear

### Paso 1: Limpiar el proyecto

```bash
cd android
./gradlew clean
cd ..
```

### Paso 2: Generar nuevo APK Release

```bash
cd android
./gradlew assembleRelease
cd ..
```

El APK estará en: `android/app/build/outputs/apk/release/app-release.apk`

### Paso 3: Instalar el APK

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

### Paso 4: Capturar logs mientras usas la app

Abre una terminal y ejecuta:

```bash
adb logcat -s TaskerWakeUpModule:* TaskerResponseReceiver:* ReactNativeJS:* *:E
```

### Paso 5: Reproducir el problema

1. **Cierra completamente la app** (no solo minimizar)
2. **Abre la app** desde el launcher
3. **Observa los logs** en la terminal

## 📊 Logs Clave a Buscar

### ✅ Si la solución funcionó (ESPERADO):

```
TaskerWakeUpModule: ║    🚀 INICIALIZANDO TASKER WAKE UP MODULE          ║
TaskerResponseReceiver: ║    🔧 CONFIGURANDO RESPONSE LISTENER               ║
TaskerResponseReceiver: ✅ Listener estático configurado
TaskerResponseReceiver: 🔍 Verificación: responseListener = NOT NULL

[... cuando abres la app ...]

TaskerWakeUpModule: ║  📤 ENVIAR BROADCAST Y ESPERAR RESPUESTA           ║
TaskerResponseReceiver: ║       📥 RESPUESTA DE TASKER RECIBIDA              ║
TaskerResponseReceiver: 🔍 VERIFICANDO LISTENER ESTÁTICO...
TaskerResponseReceiver:    responseListener = NOT NULL ✅
TaskerResponseReceiver: 📢 Notificando al listener...
TaskerWakeUpModule: ║    ✅ TASKER RESPONDIÓ - ESTÁ ACTIVO               ║
TaskerWakeUpModule: ✅ Tasker respondió a tiempo - está ACTIVO
```

**Resultado:** Tasker NO se abre visualmente ✅

### ❌ Si el problema persiste (listener se perdió):

```
TaskerWakeUpModule: ║    🚀 INICIALIZANDO TASKER WAKE UP MODULE          ║
TaskerResponseReceiver: ║    🔧 CONFIGURANDO RESPONSE LISTENER               ║
TaskerResponseReceiver: ✅ Listener estático configurado
TaskerResponseReceiver: 🔍 Verificación: responseListener = NOT NULL

[... cuando abres la app ...]

TaskerWakeUpModule: ║  📤 ENVIAR BROADCAST Y ESPERAR RESPUESTA           ║
TaskerResponseReceiver: ║       📥 RESPUESTA DE TASKER RECIBIDA              ║
TaskerResponseReceiver: 🔍 VERIFICANDO LISTENER ESTÁTICO...
TaskerResponseReceiver:    responseListener = NULL ❌
TaskerResponseReceiver: ❌ NO SE PUEDE NOTIFICAR AL LISTENER:
TaskerResponseReceiver:    ❌ No hay listener registrado (responseListener == null)
TaskerResponseReceiver:    💡 Esto significa que el listener estático se perdió
TaskerWakeUpModule: ║  ⏱️ TIMEOUT - TASKER NO RESPONDIÓ                  ║
TaskerWakeUpModule: ☢️ Iniciando ACTIVACIÓN NUCLEAR...
TaskerWakeUpModule: 🚀 Abriendo Tasker para revivirlo...
```

**Resultado:** Tasker se abre visualmente ❌

## 🔧 Si el problema persiste

Si después de aplicar las reglas ProGuard el problema continúa, envíame:

1. **Los logs completos** desde que abres la app
2. **Confirma que viste** el log `🔧 CONFIGURANDO RESPONSE LISTENER`
3. **Confirma el estado** del `responseListener` (NULL o NOT NULL)

## 📝 Notas Adicionales

- Los logs ahora son **mucho más verbosos** para facilitar el debug
- Cada paso crítico tiene logs con emojis para fácil identificación
- El timeout es de **5 segundos** (5000ms)
- Si Tasker responde antes del timeout, NO se abrirá

## 🎯 Próximos Pasos

1. Genera el APK release con las nuevas reglas ProGuard
2. Instálalo en tu dispositivo
3. Captura los logs mientras abres la app
4. Envíame los logs completos para análisis
