import FullSyncService from './FullSyncService';
import AuthService from './AuthService';
import BackgroundSyncService from './BackgroundSyncService';

// Mutex global para evitar ejecuciones concurrentes de Tasker
let isTaskerSyncing = false;

// Esta función se ejecuta en segundo plano sin abrir la app visualmente
module.exports = async (taskData: any) => {
  console.log('[TaskerSync] 🚀 Iniciando servicio de sincronización...');

  // GUARD: Evitar ejecuciones concurrentes de Tasker
  if (isTaskerSyncing) {
    console.log(
      '[TaskerSync] ⚠️ Ya hay una sincronización de Tasker en curso - OMITIENDO',
    );
    return;
  }

  isTaskerSyncing = true;
  console.log('[TaskerSync] 🔒 Mutex de Tasker activado');

  // Timeout global de 56 segundos para toda la sincronización
  const globalTimeout = setTimeout(() => {
    console.log(
      '[TaskerSync] ⏱️ TIMEOUT GLOBAL - Liberando mutex después de 56 segundos',
    );
    isTaskerSyncing = false;
  }, 56000);

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

    // 4. Ejecutar arrastres con timeout de 8 segundos cada uno
    console.log('[TaskerSync] 📤 Iniciando arrastre de ventas...');
    await executeWithTimeout(
      'Ventas',
      () => FullSyncService.sendPendingVentasToServer(sucursal, idUsuario),
      8000,
    );

    console.log('[TaskerSync] 📤 Iniciando arrastre de cobranza...');
    await executeWithTimeout(
      'Cobranza',
      () => FullSyncService.sendPendingCobranzaToServer(sucursal, idUsuario),
      8000,
    );

    // 5. Ejecutar sincronización incremental forzada (LO MÁS IMPORTANTE)
    // Esta es la sincronización que descarga datos del servidor
    console.log(
      '[TaskerSync] === INICIANDO FASE DE SINCRONIZACIÓN INCREMENTAL ===',
    );
    console.log(
      '[TaskerSync] 🔄 Iniciando sincronización incremental forzada...',
    );

    // Esperar un momento para asegurar que no haya conflictos
    await new Promise(resolve => setTimeout(() => resolve(void 0), 1000));

    // Ejecutar sincronización incremental forzada (sin depender de BackgroundSync)
    try {
      console.log(
        '[TaskerSync] 📊 Ejecutando sincronización incremental forzada...',
      );

      // Ejecutar sincronización incremental CON TIMEOUT de 30 segundos
      const syncPromise = FullSyncService.syncIncremental(
        sucursal,
        progress => {
          console.log(
            `[TaskerSync] ⏳ ${progress.message} (${Math.round(
              (progress.current / progress.total) * 100,
            )}%)`,
          );
        },
      );

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          console.log(
            '[TaskerSync] ⏱️ TIMEOUT en sincronización incremental - Cancelando después de 30s',
          );
          reject(new Error('Timeout de 30s excedido para sincronización incremental'));
        }, 30000);
      });

      const result = await Promise.race([syncPromise, timeoutPromise]);

      if (result.success) {
        console.log('[TaskerSync] ✅ Sincronización incremental completada');
      } else {
        console.log(
          '[TaskerSync] ⚠️ Sincronización incremental omitida:',
          result.error,
        );
      }
    } catch (error: any) {
      if (error.message && error.message.includes('Timeout')) {
        console.log('[TaskerSync] ⚠️ Sincronización incremental cancelada por timeout');
      } else {
        console.error(
          '[TaskerSync] ❌ Error en sincronización incremental:',
          error,
        );
      }
    }

    // 6. Arrastres de bitácoras y trazabilidad AL FINAL (NO CRÍTICOS)
    // Si fallan o se congelan, no afectan la sincronización principal
    console.log(
      '[TaskerSync] 📤 Iniciando arrastre de bitácoras (no crítico)...',
    );
    try {
      await Promise.race([
        executeWithTimeout(
          'Bitácoras',
          () => FullSyncService.enviarBitacorasPendientes(),
          5000, // Solo 5 segundos para bitácoras
        ),
        new Promise(resolve => setTimeout(() => resolve(null), 6000)), // Timeout adicional
      ]);
      console.log('[TaskerSync] ✅ Arrastre de bitácoras completado');
    } catch (error) {
      console.log('[TaskerSync] ⚠️ Bitácoras omitidas (no crítico)');
    }

    console.log(
      '[TaskerSync] 📤 Iniciando arrastre de trazabilidad (no crítico)...',
    );
    try {
      await Promise.race([
        executeWithTimeout(
          'Trazabilidad',
          () =>
            FullSyncService.sendPendingTrazabilidadToServer(
              sucursal,
              idUsuario,
            ),
          5000, // Solo 5 segundos para trazabilidad
        ),
        new Promise(resolve => setTimeout(() => resolve(null), 6000)), // Timeout adicional
      ]);
      console.log('[TaskerSync] ✅ Arrastre de trazabilidad completado');
    } catch (error) {
      console.log('[TaskerSync] ⚠️ Trazabilidad omitida (no crítico)');
    }

    console.log('[TaskerSync] ✅ Sincronización COMPLETADA exitosamente.');
  } catch (error) {
    console.error(
      '[TaskerSync] ❌ Error crítico durante la sincronización:',
      error,
    );
  } finally {
    // Limpiar el timeout global
    clearTimeout(globalTimeout);

    // CRÍTICO: Liberar el mutex siempre, incluso si hay error
    isTaskerSyncing = false;
    console.log('[TaskerSync] 🔓 Mutex de Tasker liberado');
  }
};

/**
 * Ejecuta una función con un timeout específico
 * @param name Nombre de la operación para logs
 * @param fn Función a ejecutar
 * @param timeoutMs Timeout en milisegundos
 */
async function executeWithTimeout<T>(
  name: string,
  fn: () => Promise<T>,
  timeoutMs: number,
): Promise<T | null> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      console.log(
        `[TaskerSync] ⏱️ TIMEOUT en ${name} - Cancelando después de ${timeoutMs}ms`,
      );
      reject(new Error(`Timeout de ${timeoutMs}ms excedido para ${name}`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([fn(), timeoutPromise]);
    console.log(`[TaskerSync] ✅ ${name} completado exitosamente`);
    return result;
  } catch (error: any) {
    if (error.message.includes('Timeout')) {
      console.log(`[TaskerSync] ⚠️ ${name} fue cancelado por timeout`);
      return null;
    }
    console.error(`[TaskerSync] ❌ Error en ${name}:`, error);
    return null;
  }
}
