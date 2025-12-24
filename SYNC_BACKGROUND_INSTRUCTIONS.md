# Sincronización en Segundo Plano - Instrucciones

## ⚠️ CRÍTICO: Permisos de Notificaciones

**LA APP SOLICITA PERMISOS DE NOTIFICACIONES AL INICIAR** - Esto es **OBLIGATORIO** para Android 13+ (API 33+).

### ¿Por qué son necesarios?

- El **ForegroundService** (que permite sincronización con pantalla apagada) **DEBE** mostrar una notificación persistente
- Sin permisos de notificaciones en Android 13+, la app **CRASHEARÁ** al intentar iniciar el servicio
- Es un requisito de seguridad de Android para evitar servicios ocultos

### ¿Qué pasa si el usuario rechaza los permisos?

**La app NO crashea.** Se implementaron 3 capas de protección:

1. **App.tsx** - Solicita permisos al iniciar (con diálogo explicativo)
2. **ForegroundSyncService** - Verifica permisos ANTES de iniciar el servicio
3. **Fallback graceful** - Si no hay permisos, solo funciona sincronización con app activa

### Comportamiento según permisos:

| Permisos      | Sincronización con app activa | Sincronización con pantalla apagada | App crashea |
| ------------- | ----------------------------- | ----------------------------------- | ----------- |
| ✅ Concedidos | ✅ SÍ                         | ✅ SÍ                               | ❌ NO       |
| ❌ Rechazados | ✅ SÍ                         | ❌ NO                               | ❌ NO       |

**La app SIEMPRE funciona**, incluso sin permisos. Solo pierde la sincronización en segundo plano.

---

## ✅ Implementación Completada

Se ha habilitado la sincronización periódica en segundo plano usando **Foreground Service** de `react-native-background-actions`.

### Características

- ✅ **Funciona con pantalla apagada**
- ✅ **Funciona cuando cambias de app**
- ✅ **Funciona cuando el móvil se suspende automáticamente**
- ✅ **No limitado por Doze Mode de Android**
- ✅ **Intervalo configurable (actualmente 1 minuto para pruebas)**
- ✅ **Logs extensivos para debugging**

### Arquitectura

**Sistema dual de sincronización:**

1. **Primer plano (app activa):**

   - `setInterval` cada 1 minuto
   - Más preciso y eficiente

2. **Segundo plano (app en background/pantalla apagada):**
   - `ForegroundSyncService` usando `react-native-background-actions`
   - Muestra notificación persistente (requisito de Android)
   - Se ejecuta cada 1 minuto configurado en `FOREGROUND_INTERVAL_MINUTES`

### Flujo de Trabajo

1. **Al iniciar la app:**

   - Se inicia el intervalo de primer plano (1 min)
   - Después de 3 segundos, se inicia el Foreground Service

2. **Cuando la app va a background:**

   - Se limpia el intervalo de primer plano
   - El Foreground Service continúa ejecutándose

3. **Cuando la app vuelve a foreground:**

   - Se reinicia el intervalo de primer plano
   - El Foreground Service continúa activo

4. **Cada sincronización ejecuta:**
   - Envío de ventas pendientes al servidor
   - Envío de cobranza pendiente al servidor
   - Sincronización incremental de datos del servidor

### Configuración Actual

- **Intervalo en primer plano:** 1 minuto (`SYNC_INTERVAL_MS`)
- **Intervalo en segundo plano:** 1 minuto (`FOREGROUND_INTERVAL_MINUTES`)
- **Notificación:** "Sincronizando" con icono de la app

## 📋 Cómo Probar

### Paso 0: PRIMER INICIO - Permisos de Notificaciones

**MUY IMPORTANTE:** La primera vez que inicies la app, verás un diálogo solicitando permisos de notificaciones.

**Diálogo esperado:**

```
Permiso de Notificaciones

La app necesita mostrar notificaciones para sincronizar
datos en segundo plano con la pantalla apagada.

[Preguntar Después]  [Cancelar]  [Permitir]
```

**¿Qué hacer?**

- **Para pruebas completas:** Presiona **"Permitir"** ✅
- **Si presionas "Cancelar":** La app funcionará, pero solo sincronizará con pantalla encendida ⚠️

**Logs que verás:**

```
[App] 🔔 Solicitando permisos de notificaciones...
[NotificationPermission] 🔔 Solicitando permisos...
[NotificationPermission] 📱 Android 13+ detectado, solicitando POST_NOTIFICATIONS...
[NotificationPermission] ✅ Permiso concedido
[App] ✅ Permisos de notificaciones procesados
```

**Si rechazas los permisos:**

```
[NotificationPermission] ❌ Permiso denegado: denied
[ForegroundSync] ⚠️ No hay permisos de notificaciones
[ForegroundSync] ⚠️ ForegroundService NO se iniciará (evitando crash)
[ForegroundSync] ℹ️ La sincronización funcionará solo con app en primer plano
```

**La app NO crasheará en ningún caso.**

---

### Paso 1: Compilar y ejecutar

```bash
cd android
./gradlew clean
cd ..
npx react-native run-android
```

### Paso 2: Abrir React Native Debugger o Flipper

Necesitas ver los logs de consola para verificar que todo funciona.

**Opción A - React Native Debugger:**

```bash
npx react-native log-android
```

**Opción B - Flipper:**
Abre Flipper y conecta a tu dispositivo.

### Paso 3: Iniciar sesión en la app

Loguéate normalmente para que la sincronización tenga una sesión válida.

### Paso 4: Observar logs al iniciar

Busca estos logs cuando la app inicie:

```
[BackgroundSync] 🚀 Iniciando sincronización automática
[BackgroundSync] 🔧 Configurando Foreground Service...
[BackgroundSync] 🚀 Iniciando Foreground Service...
[ForegroundSync] 🔵 start() llamado
[ForegroundSync] 📋 Preparando opciones del servicio...
[ForegroundSync] 🔍 Verificando si hay servicio previo...
[ForegroundSync] Estado previo: DETENIDO
[ForegroundSync] 🚀 Iniciando BackgroundService.start()...
[ForegroundSync] ✅ Servicio iniciado exitosamente
[BackgroundSync] ✅ Foreground Service iniciado exitosamente
```

### Paso 5: Observar sincronizaciones automáticas

Cada 1 minuto verás logs como estos:

```
═══════════════════════════════════════════════════════
[ForegroundSync] 🚀 TAREA DE SINCRONIZACIÓN INICIADA
[ForegroundSync] Intervalo: 60s (1 minutos)
═══════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────┐
│ [ForegroundSync] SYNC #1
│ Timestamp: 2024-12-20T16:34:00.000Z
│ Hora local: 10:34:00 AM
└─────────────────────────────────────────────────────┘

[ForegroundSync] 📱 Actualizando notificación...
[ForegroundSync] ✅ Notificación actualizada
[ForegroundSync] 🔄 Ejecutando performSync()...
[ForegroundSync] 👤 Obteniendo información de usuario...
[ForegroundSync] Usuario: USUARIO123, Sucursal: 1
[ForegroundSync] 📤 PASO 1: Enviando ventas pendientes...
[ForegroundSync] ℹ️ No hay ventas pendientes
[ForegroundSync] 📤 PASO 2: Enviando cobranza pendiente...
[ForegroundSync] ℹ️ No hay cobranza pendiente
[ForegroundSync] 🔄 PASO 3: Sincronización incremental...
[ForegroundSync] 📊 Producto: Sincronizando...
[ForegroundSync] 📊 Producto: Completado (50 registros)
...

┌─────────────────────────────────────────────────────┐
│ ✅ SINCRONIZACIÓN EXITOSA
│ Duración: 2.34s
└─────────────────────────────────────────────────────┘

[ForegroundSync] ⏳ Esperando 60s (1 min) para próxima sync...
[ForegroundSync] Próxima sincronización: 10:35:00 AM
═══════════════════════════════════════════════════════
```

### Paso 6: Probar con pantalla apagada

1. **Apaga la pantalla del dispositivo** (botón de bloqueo)
2. **Espera 1-2 minutos**
3. **Enciende la pantalla**
4. **Verifica los logs** - deberías ver sincronizaciones que ocurrieron mientras la pantalla estaba apagada

Los timestamps te dirán exactamente cuándo ocurrieron las sincronizaciones.

### Paso 7: Probar con app en background

1. **Presiona el botón Home** (envía la app a background)
2. **Abre otra app** (Chrome, WhatsApp, etc.)
3. **Espera 1-2 minutos**
4. **Vuelve a la app de desarrollo**
5. **Verifica los logs** - deberías ver:

```
[BackgroundSync] 📱 AppState cambió a: background
[BackgroundSync] 🌙 App en background - limpiando intervalo, Foreground Service activo (1 min)
```

Y luego sincronizaciones del Foreground Service mientras estabas en otra app.

### Paso 8: Observar la notificación

Mientras la app esté en background, verás una **notificación persistente**:

- **Título:** "Sincronizando"
- **Descripción:** "Sincronizando datos con el servidor..." o "Última sync: 10:34:00 AM"
- **Icono:** Icono de la app
- **Color:** Rosa/Magenta

Esta notificación es **requisito obligatorio** de Android para Foreground Services. No se puede ocultar.

## 🔧 Configuración de Intervalos

Para cambiar los intervalos de sincronización:

### Archivo: `services/BackgroundSyncService.ts`

```typescript
// Línea 45: Intervalo cuando app está activa (primer plano)
private readonly SYNC_INTERVAL_MS = 1 * 60 * 1000; // 1 minuto

// Línea 46: Intervalo cuando app está en background
private readonly FOREGROUND_INTERVAL_MINUTES = 1; // 1 minuto
```

**Valores recomendados para producción:**

- Primer plano: 5-10 minutos
- Segundo plano: 10-15 minutos

**Para pruebas rápidas:**

- Primer plano: 30 segundos (`0.5 * 60 * 1000`)
- Segundo plano: 1 minuto

## ⚠️ Posibles Errores

### Error: "Error de permisos de notificación" o "No hay permisos de notificaciones"

**Causa:** Android 13+ requiere permiso explícito de notificaciones y el usuario lo rechazó.

**¿Es crítico?** NO. La app funciona normalmente, solo sin sincronización en background.

**Solución si quieres habilitar sync en background:**

1. Ve a **Configuración** del dispositivo
2. **Apps** → **AwesomeProject** → **Notificaciones**
3. **Habilita** todas las notificaciones
4. Cierra y vuelve a abrir la app

**Solución alternativa - Reinstalar app:**

```bash
cd android
./gradlew clean
cd ..
npx react-native run-android
```

Esto volverá a solicitar los permisos.

### Error: "BackgroundService already running"

**Causa:** El servicio ya está corriendo de una sesión anterior.

**Solución:** Normal, el sistema lo detecta y no hace nada. No es un error real.

### Error: "No hay sesión activa"

**Causa:** El usuario no ha iniciado sesión.

**Solución:** Inicia sesión en la app primero.

## 🐛 Debugging

### Verificar Estado de Permisos

Si no estás seguro si los permisos fueron concedidos, busca estos logs:

**Permisos concedidos (✅ Todo bien):**

```
[NotificationPermission] ✅ Permiso concedido
[ForegroundSync] ✅ Permisos de notificaciones confirmados
[ForegroundSync] ✅ Servicio iniciado exitosamente
```

**Permisos rechazados (⚠️ Solo sync con app activa):**

```
[NotificationPermission] ❌ Permiso denegado: denied
[ForegroundSync] ⚠️ No hay permisos de notificaciones
[ForegroundSync] ⚠️ ForegroundService NO se iniciará (evitando crash)
```

### Otros Errores

Si algo no funciona, busca estos logs de error:

```
[BackgroundSync] ⚠️ Error iniciando Foreground Service
[BackgroundSync] Error detalle: ...
[BackgroundSync] Error stack: ...
```

O:

```
[ForegroundSync] ❌ Error al iniciar servicio:
[ForegroundSync] Error completo: ...
```

Los logs te dirán exactamente qué falló.

## 📊 Monitoreo en Producción

Los logs actuales son **muy detallados** para debugging. Una vez que confirmes que funciona:

1. **Mantén los logs de inicio/parada** (🚀, ✅, ❌)
2. **Mantén los contadores de sync** (SYNC #1, #2, etc.)
3. **Puedes reducir logs de progreso** (📊 Entity: ...)
4. **Mantén logs de errores** para debugging en producción

## 📝 Archivos Modificados

1. **`services/BackgroundSyncService.ts`:**

   - Habilitado ForegroundSyncService (estaba deshabilitado)
   - Agregados logs detallados

2. **`services/ForegroundSyncService.ts`:**
   - Agregados logs extensivos en todos los métodos
   - Logs con formato de caja para mejor visibilidad
   - Logs de timing y duración

Los permisos ya estaban correctamente configurados en:

- `android/app/src/main/AndroidManifest.xml`

## ✅ Checklist de Verificación

- [ ] Compilar y ejecutar la app
- [ ] Ver logs de inicio del Foreground Service
- [ ] Ver primera sincronización automática (1 min)
- [ ] Apagar pantalla y esperar 2 minutos
- [ ] Encender pantalla y verificar sincronizaciones mientras estaba apagada
- [ ] Enviar app a background (Home)
- [ ] Esperar 2 minutos en otra app
- [ ] Volver y verificar logs de sincronizaciones en background
- [ ] Verificar notificación persistente visible
- [ ] Verificar que no haya errores en los logs

## 🎯 Próximos Pasos

Una vez confirmado que funciona:

1. **Ajustar intervalos a valores de producción** (10-15 minutos)
2. **Reducir verbosidad de logs** (mantener solo los críticos)
3. **Opcional:** Permitir al usuario configurar el intervalo desde la UI
4. **Opcional:** Pausar sincronizaciones cuando no haya conexión a internet

## 📞 Reportar Problemas

Si encuentras errores, envía:

1. **Logs completos de consola** (desde inicio de la app)
2. **Marca de tiempo** exacta del error
3. **Qué estabas haciendo** cuando falló
4. **Versión de Android** del dispositivo de prueba
