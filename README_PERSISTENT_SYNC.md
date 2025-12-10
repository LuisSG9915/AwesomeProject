# Sincronización Persistente (Pantalla Apagada)

## Descripción

Se implementó un servicio de sincronización **persistente** que funciona:

- ✅ Con pantalla apagada
- ✅ En segundo plano
- ✅ Incluso después de minimizar la app
- ✅ Reinicia automáticamente después de reiniciar el dispositivo

## ⚠️ Advertencia sobre Batería

Este servicio usa un **Foreground Service** de Android que mantiene la app activa continuamente.
**Esto consume más batería** que la sincronización normal.

El cliente fue informado y aceptó este comportamiento.

## Arquitectura

### Servicios Implementados

1. **PersistentSyncService** (`services/PersistentSyncService.ts`)

   - Servicio principal usando `react-native-background-actions`
   - Crea un Foreground Service con notificación visible
   - Sincroniza cada 1 minuto (configurable)
   - No puede ser matado por Android por ahorro de batería

2. **BackgroundSyncService** (`services/BackgroundSyncService.ts`)

   - Servicio de respaldo usando `react-native-background-fetch`
   - Se ejecuta cada ~15 minutos (mínimo permitido por Android)
   - Actúa como fallback si el Foreground Service se detiene

3. **HeadlessTask** (`index.js`)
   - Tarea que se ejecuta cuando la app está completamente cerrada
   - Respaldo adicional para sincronización

### Flujo de Sincronización

```
App Inicia
    │
    ├─► PersistentSyncService.start() ──► Foreground Service (1 min)
    │
    └─► BackgroundSyncService.start() ──► BackgroundFetch (~15 min)
```

## Configuración Android

### Permisos Agregados (`AndroidManifest.xml`)

```xml
<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS"/>
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM"/>
<uses-permission android:name="android.permission.USE_EXACT_ALARM"/>
```

### Optimización de Batería

Para mejor funcionamiento, el usuario debe:

1. Ir a Configuración > Batería > [App] > No optimizada
2. O cuando active la sincronización persistente, seguir las instrucciones del diálogo

## UI - Panel de Control

El `SyncStatusPanel` ahora muestra:

- Toggle para activar/desactivar sincronización persistente
- Estado actual de sincronización
- Última y próxima sincronización
- Contador de sincronizaciones

## Dependencias Agregadas

```json
{
  "react-native-background-actions": "^X.X.X"
}
```

## Uso Programático

```typescript
import PersistentSyncService from './services/PersistentSyncService';

// Iniciar sincronización persistente
await PersistentSyncService.start();

// Detener
await PersistentSyncService.stop();

// Verificar si está corriendo
const isRunning = PersistentSyncService.isRunning();

// Configurar intervalo (en minutos)
PersistentSyncService.setInterval(5); // cada 5 minutos

// Sincronización manual
await PersistentSyncService.syncNow();

// Suscribirse a cambios de estado
const unsubscribe = PersistentSyncService.subscribe(state => {
  console.log('Estado:', state.status);
  console.log('Última sync:', state.lastSyncTime);
});
```

## Notas Técnicas

1. El intervalo mínimo de `react-native-background-fetch` es 15 minutos en Android
2. `react-native-background-actions` usa Foreground Service que no tiene límite de intervalo
3. La notificación del Foreground Service es requerida por Android y no se puede ocultar
4. El servicio sobrevive al cierre de la app pero no a un Force Stop manual

## Rebuild Necesario

Después de estos cambios, es necesario hacer un rebuild completo:

```bash
cd android
./gradlew clean
cd ..
npx react-native run-android
```
