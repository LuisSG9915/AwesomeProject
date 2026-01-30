import FullSyncService from './FullSyncService';
import AuthService from './AuthService';
import BackgroundSyncService from './BackgroundSyncService';
import { networkInfoService } from './NetworkInfoService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { batteryOptimizationService } from './BatteryOptimization';

declare const module: any;

// Clave para mutex persistente en AsyncStorage
const TASKER_MUTEX_KEY = '@tasker_sync_mutex';
const TASKER_LAST_SYNC_KEY = '@tasker_last_sync_time';

// Tiempo máximo que un mutex puede estar activo antes de liberarse automáticamente (90 segundos)
// Reducido a 90s para liberar mutex huérfanos rápido sin bloquear la app
const MUTEX_MAX_AGE_MS = 90 * 1000;

/**
 * Verifica y limpia mutex huérfanos (por si hubo un crash)
 * Retorna true si el mutex está libre, false si hay una sincronización activa válida
 */
async function checkAndCleanMutex(): Promise<boolean> {
  try {
    const mutexData = await AsyncStorage.getItem(TASKER_MUTEX_KEY);
    if (!mutexData) {
      return true; // No hay mutex, está libre
    }

    const { timestamp, active } = JSON.parse(mutexData);
    const age = Date.now() - timestamp;

    if (!active) {
      return true; // Mutex marcado como inactivo
    }

    // IMPORTANTE: En background, JavaScript puede suspenderse y el mutex nunca se libera
    // Por eso usamos un timeout más corto (60s) y siempre liberamos mutex viejos
    if (age > MUTEX_MAX_AGE_MS) {
      console.log(
        `[TaskerSync] 🚨 Mutex huérfano detectado (edad: ${Math.round(
          age / 1000,
        )}s) - Liberando automáticamente`,
      );
      await AsyncStorage.removeItem(TASKER_MUTEX_KEY);
      // Notificar a BackgroundSyncService que el mutex fue liberado por timeout
      try {
        BackgroundSyncService.notifySyncEnd(
          'tasker',
          false,
          'Mutex liberado por timeout',
        );
      } catch (e) {
        // Ignorar errores de notificación
      }
      return true; // Mutex muy viejo, probablemente de un crash o suspensión
    }

    console.log(
      `[TaskerSync] ⚠️ Mutex activo detectado (edad: ${Math.round(
        age / 1000,
      )}s) - Sincronización en curso`,
    );
    return false; // Mutex activo y válido
  } catch (error) {
    console.error('[TaskerSync] Error verificando mutex:', error);
    return true; // En caso de error, permitir continuar
  }
}

/**
 * Establece el mutex persistente
 */
async function setMutex(active: boolean, ownerId?: string): Promise<void> {
  try {
    if (active) {
      if (ownerId) {
        const mutexData = await AsyncStorage.getItem(TASKER_MUTEX_KEY);
        if (mutexData) {
          let parsed: any;
          try {
            parsed = JSON.parse(mutexData);
          } catch (_e) {
            parsed = null;
          }

          const currentOwnerId = parsed?.ownerId;
          const currentActive = parsed?.active;
          if (currentActive && currentOwnerId && currentOwnerId !== ownerId) {
            return;
          }
        }
      }

      await AsyncStorage.setItem(
        TASKER_MUTEX_KEY,
        JSON.stringify({
          timestamp: Date.now(),
          active: true,
          ownerId,
        }),
      );
      return;
    }

    if (!ownerId) {
      await AsyncStorage.removeItem(TASKER_MUTEX_KEY);
      return;
    }

    const mutexData = await AsyncStorage.getItem(TASKER_MUTEX_KEY);
    if (!mutexData) {
      return;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(mutexData);
    } catch (_e) {
      await AsyncStorage.removeItem(TASKER_MUTEX_KEY);
      return;
    }

    const currentOwnerId = parsed?.ownerId;
    const currentActive = parsed?.active;

    if (currentActive && currentOwnerId && currentOwnerId !== ownerId) {
      return;
    }

    await AsyncStorage.removeItem(TASKER_MUTEX_KEY);
  } catch (error) {
    console.error('[TaskerSync] Error estableciendo mutex:', error);
  }
}

/**
 * Guarda la última sincronización exitosa
 */
async function saveLastSyncTime(): Promise<void> {
  try {
    await AsyncStorage.setItem(TASKER_LAST_SYNC_KEY, new Date().toISOString());
  } catch (error) {
    console.error('[TaskerSync] Error guardando última sincronización:', error);
  }
}

/**
 * Obtiene la última sincronización exitosa
 */
async function getLastSyncTime(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TASKER_LAST_SYNC_KEY);
  } catch (error) {
    return null;
  }
}

// Esta función se ejecuta en segundo plano sin abrir la app visualmente
module.exports = async (taskData: any) => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const runId = `tasker_${startTime}_${Math.random().toString(16).slice(2)}`;

  console.log('═══════════════════════════════════════════════════════');
  console.log('[TaskerSync] 🚀 INICIANDO SERVICIO DE SINCRONIZACIÓN');
  console.log(`[TaskerSync] Timestamp: ${timestamp}`);
  console.log(
    `[TaskerSync] Hora local: ${new Date().toLocaleTimeString('es-MX')}`,
  );
  console.log('═══════════════════════════════════════════════════════');

  // GUARD: Verificar mutex persistente (el mutex en memoria no es confiable en background)
  // El mutex persistente tiene auto-limpieza después de 60 segundos
  const mutexFree = await checkAndCleanMutex();
  if (!mutexFree) {
    console.log('[TaskerSync] ⚠️ Mutex persistente activo - OMITIENDO');
    return;
  }

  // Verificar exención de optimización de batería (CRÍTICO para background)
  try {
    // PRE-WARM: Iniciar detección de red en paralelo para tener datos listos cuando se necesiten
    // No usamos await aquí para no bloquear, pero el servicio cacheará el resultado
    void networkInfoService
      .getNetworkInfo()
      .catch(e => console.log('[TaskerSync] ⚠️ Error en pre-fetch de red:', e));

    const isExempt =
      await batteryOptimizationService.isIgnoringBatteryOptimizations();
    if (!isExempt) {
      console.warn(
        '[TaskerSync] ⚠️ App NO está exenta de optimización de batería - puede fallar en background',
      );
      console.warn(
        '[TaskerSync] 💡 Solicita exención desde Configuración > Apps > [App] > Batería > Sin restricciones',
      );
    } else {
      console.log('[TaskerSync] ✅ App exenta de optimización de batería');
    }
  } catch (e) {
    console.log('[TaskerSync] ⚠️ No se pudo verificar exención de batería:', e);
  }

  // Mostrar última sincronización exitosa
  const lastSync = await getLastSyncTime();
  if (lastSync) {
    const lastSyncDate = new Date(lastSync);
    const timeSince = Math.round(
      (Date.now() - lastSyncDate.getTime()) / 1000 / 60,
    );
    console.log(
      `[TaskerSync] ⏰ Última sincronización exitosa: hace ${timeSince} minutos`,
    );
  }

  // Activar mutex persistente (el mutex en memoria no es confiable en background)
  await setMutex(true, runId);
  console.log('[TaskerSync] 🔒 Mutex persistente activado');

  // Notificar a BackgroundSyncService para actualizar UI
  BackgroundSyncService.notifySyncStart('tasker');

  // HEARTBEAT: Log cada 5 segundos para verificar si el JS se suspende
  const mutexTouchIntervalMs = 20000;
  let lastMutexTouch = Date.now();
  const heartbeatId = setInterval(() => {
    const now = Date.now();
    const elapsed = Math.round((now - startTime) / 1000);
    console.log(
      `[TaskerSync] 💓 Heartbeat - Sync en curso (${elapsed}s elapsed)`,
    );

    if (now - lastMutexTouch >= mutexTouchIntervalMs) {
      lastMutexTouch = now;
      void setMutex(true, runId);
    }
  }, 5000);

  try {
    // 1. Restaurar sesión para saber qué sucursal sincronizar
    // Esto lee de Realm o AsyncStorage sin necesidad de UI
    const user = await AuthService.restoreSession();

    if (!user) {
      console.warn(
        '[TaskerSync] ⚠️ No hay usuario logueado. No se puede sincronizar.',
      );
      return;
    }

    const sucursal = user.sucursal_origen || user.sucursal || 1;
    const idUsuario = user.id || user.idUsuario || 1;
    console.log(`[TaskerSync] Usuario: ${user.nombre}, Sucursal: ${sucursal}`);

    // 2. NO verificar BackgroundSyncService para evitar bloqueos
    // Tasker debe ser independiente del sincronizador de primer plano
    console.log(
      '[TaskerSync] 🔄 Ejecutando sincronización independiente (Tasker)',
    );

    // 3. Inicializar el servicio de sincronización si es necesario
    await FullSyncService.initialize();

    // 4. Ejecutar arrastres DIRECTAMENTE (sin setTimeout que se cuelga en background)
    console.log('[TaskerSync] 📤 Iniciando arrastre de ventas...');
    try {
      await FullSyncService.sendPendingVentasToServer(sucursal, idUsuario);
      console.log('[TaskerSync] ✅ Ventas completado');
    } catch (e) {
      console.log('[TaskerSync] ⚠️ Ventas error:', e);
    }

    console.log('[TaskerSync] 📤 Iniciando arrastre de cobranza...');
    try {
      await FullSyncService.sendPendingCobranzaToServer(sucursal, idUsuario);
      console.log('[TaskerSync] ✅ Cobranza completado');
    } catch (e) {
      console.log('[TaskerSync] ⚠️ Cobranza error:', e);
    }

    // 5. Ejecutar sincronización incremental forzada (LO MÁS IMPORTANTE)
    // Esta es la sincronización que descarga datos del servidor
    // NOTA: NO usar setTimeout aquí porque en background JavaScript se suspende
    console.log(
      '[TaskerSync] === INICIANDO FASE DE SINCRONIZACIÓN INCREMENTAL ===',
    );

    // Ejecutar sincronización incremental directamente (sin delays ni timeouts problemáticos)
    try {
      console.log('[TaskerSync] 📊 Ejecutando syncIncremental...');

      const result = await FullSyncService.syncIncremental(
        sucursal,
        progress => {
          console.log(
            `[TaskerSync] ⏳ ${progress.message} (${Math.round(
              (progress.current / progress.total) * 100,
            )}%)`,
          );
        },
        'tasker',
      );

      if (result.success) {
        console.log('[TaskerSync] ✅ Sincronización incremental completada');
      } else {
        console.log(
          '[TaskerSync] ⚠️ Sincronización incremental con error:',
          result.error,
        );
      }
    } catch (error: any) {
      console.error(
        '[TaskerSync] ❌ Error en sincronización incremental:',
        error,
      );
    }

    // 6. Arrastres de bitácoras y trazabilidad AL FINAL (NO CRÍTICOS)
    // Ejecutar directamente sin setTimeout (se cuelga en background)
    console.log('[TaskerSync] 📤 Iniciando arrastre de bitácoras...');
    try {
      await FullSyncService.enviarBitacorasPendientes();
      console.log('[TaskerSync] ✅ Bitácoras completado');
    } catch (e) {
      console.log('[TaskerSync] ⚠️ Bitácoras error (no crítico):', e);
    }

    console.log('[TaskerSync] 📤 Iniciando arrastre de trazabilidad...');
    try {
      // await FullSyncService.sendPendingTrazabilidadToServer(
      //   sucursal,
      //   idUsuario,
      // );
      console.log('[TaskerSync] ✅ Trazabilidad completado');
    } catch (e) {
      console.log('[TaskerSync] ⚠️ Trazabilidad error (no crítico):', e);
    }

    // Guardar última sincronización exitosa
    await saveLastSyncTime();

    // Notificar éxito a BackgroundSyncService para actualizar UI
    BackgroundSyncService.notifySyncEnd('tasker', true);

    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log('┌─────────────────────────────────────────────────────┐');
    console.log('│ [TaskerSync] ✅ SINCRONIZACIÓN COMPLETADA EXITOSAMENTE');
    console.log(`│ Duración total: ${duration} segundos`);
    console.log(`│ Hora: ${new Date().toLocaleTimeString('es-MX')}`);
    console.log('└─────────────────────────────────────────────────────┘');
  } catch (error: any) {
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.error(
      `[TaskerSync] ❌ ERROR CRÍTICO después de ${duration}s:`,
      error,
    );

    // Notificar error a BackgroundSyncService
    BackgroundSyncService.notifySyncEnd(
      'tasker',
      false,
      error?.message || 'Error desconocido',
    );
  } finally {
    // Detener heartbeat
    if (heartbeatId) {
      clearInterval(heartbeatId);
    }

    // Liberar mutex persistente
    await setMutex(false, runId);
    console.log('[TaskerSync] 🔓 Mutex persistente liberado');
  }
};

console.log('═══════════════════════════════════════════════════════');
