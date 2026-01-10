# Configuración de Sincronización para Samsung S25 Ultra

## ⚠️ Problema Conocido

Samsung One UI tiene optimizaciones de batería muy agresivas que pueden matar servicios en background después de un período de inactividad (típicamente 5+ horas).

## 🔧 Configuración Obligatoria en Samsung

### 1. Excluir la App de Optimización de Batería

1. **Configuración** → **Batería y cuidado del dispositivo** → **Batería**
2. **Límites de uso en segundo plano** → **Apps que nunca se suspenden**
3. Agregar **AwesomeProject** a la lista

### 2. Excluir la App de "Sleeping Apps"

1. **Configuración** → **Batería y cuidado del dispositivo** → **Batería**
2. **Límites de uso en segundo plano**
3. Verificar que **AwesomeProject** NO esté en:
   - Apps en suspensión
   - Apps en suspensión profunda

### 3. Excluir de Optimización Adaptiva

1. **Configuración** → **Batería y cuidado del dispositivo**
2. **Cuidado del dispositivo** → ⋮ (tres puntos) → **Automatización**
3. Desactivar **Optimización diaria automática** (o excluir la app)

### 4. Configurar Tasker Correctamente

En Tasker, asegúrate de:

1. **Tasker** tiene los mismos permisos de batería que la app
2. El perfil de sincronización usa **Broadcast Intent**:
   - Action: `com.awesomeproject.SYNC_DATOS`
   - Package: `com.awesomeproject`

### 5. Verificar Permisos de Notificaciones

1. **Configuración** → **Apps** → **AwesomeProject**
2. **Notificaciones** → Habilitar todas

## 🔍 Cómo Verificar que Funciona

### Ver Logs en Tiempo Real

Conecta el móvil por USB y ejecuta:

```bash
adb logcat | grep -E "(TaskerSync|TaskerBroadcast|TaskerHeadless)"
```

### Logs Esperados al Ejecutar Tasker

```
TaskerBroadcastReceiver: ═══════════════════════════════════════════════════════
TaskerBroadcastReceiver: 📡 BROADCAST #1 RECIBIDO - 10:30:00
TaskerBroadcastReceiver: 📋 Action: com.awesomeproject.SYNC_DATOS
TaskerBroadcastReceiver: 📱 Android API: 35
TaskerBroadcastReceiver: ═══════════════════════════════════════════════════════
TaskerBroadcastReceiver: 🔒 Adquiriendo wake lock...
TaskerBroadcastReceiver: ✅ Wake lock adquirido exitosamente
TaskerBroadcastReceiver: 🚀 Iniciando servicio en foreground (Android 35)
TaskerBroadcastReceiver: ✅ Servicio iniciado correctamente
TaskerHeadlessService: ═══════════════════════════════════════════════════════
TaskerHeadlessService: 🚀 SERVICIO CREADO - 10:30:00
TaskerHeadlessService: ═══════════════════════════════════════════════════════
TaskerHeadlessService: 🔒 WakeLock adicional adquirido (120s)
TaskerHeadlessService: ✅ Notificación foreground iniciada exitosamente
```

### Verificar Última Sincronización

En los logs de React Native verás:

```
[TaskerSync] ⏰ Última sincronización exitosa: hace X minutos
```

## 🚨 Si las Sincronizaciones se Detienen

### Paso 1: Verificar Logs de Tasker

En Tasker:

1. **Menú** → **Más** → **Registro de ejecución**
2. Verificar que las tareas se ejecutaron

### Paso 2: Verificar Logs del Sistema

```bash
adb logcat | grep -E "(TaskerSync|TaskerBroadcast|TaskerHeadless)" | tail -100
```

adb logcat | findstr "TaskerSync TaskerBroadcast TaskerHeadless"

### Paso 3: Verificar Mutex Huérfano

Si ves este log:

```
[TaskerSync] 🚨 Mutex huérfano detectado (edad: XXXs) - Liberando automáticamente
```

El sistema detectó un crash anterior y se auto-recuperó.

### Paso 4: Reiniciar la App

Si nada funciona:

1. Forzar cierre de la app
2. Volver a abrir
3. Esperar a que Tasker dispare la siguiente sincronización

## 📊 Arquitectura de Respaldo

El sistema tiene 3 capas de sincronización:

| Capa | Mecanismo             | Intervalo              | Funciona con pantalla apagada |
| ---- | --------------------- | ---------------------- | ----------------------------- |
| 1    | Tasker + HeadlessJS   | Configurable en Tasker | ✅ Sí                         |
| 2    | ForegroundSyncService | 1 minuto               | ✅ Sí                         |
| 3    | BackgroundFetch       | ~15 minutos            | ✅ Sí (respaldo)              |

Si Tasker falla, ForegroundSyncService toma el control automáticamente.

## 🔄 Qué Hacer Después de Reiniciar el Móvil

1. **Abrir la app** al menos una vez después de reiniciar
2. Verificar que Tasker esté ejecutándose
3. Esperar a la primera sincronización

El sistema tiene un `BootReceiver` que debería reiniciar los servicios automáticamente, pero Samsung puede bloquearlo.

## 📝 Cambios Recientes (Enero 2026)

1. **Mutex persistente**: Ahora se usa AsyncStorage para detectar crashes
2. **WakeLock adicional**: El HeadlessService adquiere un WakeLock extra para Samsung
3. **ForegroundSyncService habilitado**: Ahora funciona como respaldo automático
4. **Logs mejorados**: Más información para debugging

## 🆘 Soporte

Si después de seguir todos estos pasos las sincronizaciones siguen fallando:

1. Exportar logs: `adb logcat -d > logs.txt`
2. Verificar hora de última sincronización exitosa
3. Reportar el problema con los logs
