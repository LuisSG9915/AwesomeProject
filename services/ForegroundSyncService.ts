/**
 * ForegroundSyncService
 *
 * Servicio que ejecuta sincronizaciones en background usando Foreground Service.
 * Esto garantiza que las sincronizaciones se ejecuten incluso con pantalla apagada.
 *
 * Ventajas sobre BackgroundFetch:
 * - Funciona con pantalla apagada garantizado
 * - No limitado por Doze Mode
 * - Intervalo configurable (incluso 1 minuto)
 * - Confiable y predecible
 *
 * Requisito: Muestra notificación persistente mientras está activo
 */

import BackgroundService from 'react-native-background-actions';
import FullSyncService from './FullSyncService';
import AuthService from './AuthService';
import NotificationPermissionService from './NotificationPermissionService';

interface ForegroundSyncConfig {
  intervalMinutes: number; // Intervalo en minutos entre sincronizaciones
}

class ForegroundSyncService {
  private static instance: ForegroundSyncService;
  private isRunning = false;
  private config: ForegroundSyncConfig = {
    intervalMinutes: 10, // Por defecto cada 10 minutos
  };

  private constructor() {}

  static getInstance(): ForegroundSyncService {
    if (!ForegroundSyncService.instance) {
      ForegroundSyncService.instance = new ForegroundSyncService();
    }
    return ForegroundSyncService.instance;
  }

  /**
   * Configura el intervalo de sincronización
   */
  configure(config: Partial<ForegroundSyncConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
    console.log(
      '[ForegroundSync] Configurado con intervalo:',
      this.config.intervalMinutes,
      'minutos',
    );
  }

  /**
   * Inicia el servicio de sincronización en foreground
   */
  async start(): Promise<void> {
    console.log('[ForegroundSync] 🔵 start() llamado');

    if (this.isRunning) {
      console.log('[ForegroundSync] ⚠️ Ya está en ejecución, retornando');
      return;
    }

    // CRÍTICO: Verificar permisos de notificaciones ANTES de iniciar
    // Si no hay permisos, el servicio crasheará la app en Android 13+
    console.log(
      '[ForegroundSync] 🔐 Verificando permisos de notificaciones...',
    );
    const hasPermission =
      await NotificationPermissionService.checkNotificationPermission();

    if (!hasPermission) {
      console.warn('[ForegroundSync] ⚠️ No hay permisos de notificaciones');
      console.warn(
        '[ForegroundSync] ⚠️ ForegroundService NO se iniciará (evitando crash)',
      );
      console.warn(
        '[ForegroundSync] ℹ️ La sincronización funcionará solo con app en primer plano',
      );
      return;
    }

    console.log('[ForegroundSync] ✅ Permisos de notificaciones confirmados');
    console.log('[ForegroundSync] 📋 Preparando opciones del servicio...');
    const options = {
      taskName: 'Sincronización de Datos',
      taskTitle: 'Sincronizando',
      taskDesc: 'Sincronizando datos con el servidor...',
      taskIcon: {
        name: 'ic_launcher',
        type: 'mipmap',
      },
      color: '#ff00ff',
      linkingURI: 'awesomeproject://sync',
      progressBar: {
        max: 100,
        value: 0,
        indeterminate: true,
      },
      parameters: {
        intervalMs: this.config.intervalMinutes * 60 * 1000,
      },
    };

    try {
      console.log('[ForegroundSync] 🔍 Verificando si hay servicio previo...');
      // Verificar si ya hay un servicio en ejecución (función SÍNCRONA, no asíncrona)
      const isAlreadyRunning = BackgroundService.isRunning();
      console.log(
        '[ForegroundSync] Estado previo:',
        isAlreadyRunning ? 'CORRIENDO' : 'DETENIDO',
      );

      if (isAlreadyRunning) {
        console.log(
          '[ForegroundSync] ⚠️ Servicio ya está corriendo, omitiendo inicio',
        );
        this.isRunning = true;
        return;
      }

      console.log('[ForegroundSync] 🚀 Iniciando BackgroundService.start()...');
      console.log(
        '[ForegroundSync] Configuración:',
        JSON.stringify(options, null, 2),
      );
      await BackgroundService.start(this.syncTask, options);
      this.isRunning = true;
      console.log('[ForegroundSync] ✅ Servicio iniciado exitosamente');
      console.log(
        '[ForegroundSync] Intervalo configurado:',
        this.config.intervalMinutes,
        'minutos',
      );
    } catch (error: any) {
      console.error('[ForegroundSync] ❌ Error al iniciar servicio:', error);
      console.error('[ForegroundSync] Error mensaje:', error?.message);
      console.error('[ForegroundSync] Error stack:', error?.stack);

      // Si el error es por permisos de notificación, informar claramente
      if (
        error?.message?.includes('notification') ||
        error?.message?.includes('permission')
      ) {
        console.error(
          '[ForegroundSync] ⚠️ Error relacionado con permisos de notificación',
        );
        console.error(
          '[ForegroundSync] ℹ️ Asegúrate de habilitar notificaciones en Configuración del sistema',
        );
      }

      // NO lanzar error - permitir que la app continúe funcionando
      console.warn(
        '[ForegroundSync] ⚠️ La sincronización en background NO estará disponible',
      );
      console.warn(
        '[ForegroundSync] ℹ️ La app funcionará normalmente, solo sincronizará con pantalla encendida',
      );
      this.isRunning = false;
    }
  }

  /**
   * Detiene el servicio de sincronización
   */
  async stop(): Promise<void> {
    console.log('[ForegroundSync] 🔵 stop() llamado');

    if (!this.isRunning) {
      console.log('[ForegroundSync] ℹ️ No está en ejecución, nada que detener');
      return;
    }

    try {
      console.log('[ForegroundSync] 🛑 Deteniendo BackgroundService...');
      await BackgroundService.stop();
      this.isRunning = false;
      console.log('[ForegroundSync] ✅ Servicio detenido exitosamente');
    } catch (error: any) {
      console.error('[ForegroundSync] ❌ Error al detener servicio:', error);
      console.error('[ForegroundSync] Error detalle:', error?.message);
      throw error;
    }
  }

  /**
   * Verifica si el servicio está en ejecución
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Tarea de sincronización que se ejecuta en el foreground service
   */
  private syncTask = async (taskData: any) => {
    // ROBUSTO: Manejar caso donde taskData.parameters puede ser undefined
    // Esto puede pasar dependiendo de cómo react-native-background-actions pasa los datos
    const intervalMs =
      taskData?.parameters?.intervalMs ||
      this.config.intervalMinutes * 60 * 1000;
    const intervalSeconds = intervalMs / 1000;
    const intervalMinutes = intervalMs / 60000;

    console.log('═══════════════════════════════════════════════════════');
    console.log('[ForegroundSync] 🚀 TAREA DE SINCRONIZACIÓN INICIADA');
    console.log(`[ForegroundSync] taskData:`, taskData);
    console.log(
      `[ForegroundSync] Intervalo: ${intervalSeconds}s (${intervalMinutes} minutos)`,
    );
    console.log(`[ForegroundSync] Timestamp: ${new Date().toISOString()}`);
    console.log('═══════════════════════════════════════════════════════');

    // Loop infinito mientras el servicio esté activo
    let syncCount = 0;

    console.log('[ForegroundSync] 🔄 Entrando al loop principal...');
    console.log(
      '[ForegroundSync] 🔍 BackgroundService.isRunning():',
      BackgroundService.isRunning(),
    );

    while (BackgroundService.isRunning()) {
      console.log(
        `[ForegroundSync] 🔁 Iteración del loop #${
          syncCount + 1
        } - isRunning: ${BackgroundService.isRunning()}`,
      );
      try {
        syncCount++;
        const timestamp = new Date().toISOString();
        const localTime = new Date().toLocaleTimeString('es-MX');

        console.log('');
        console.log('┌─────────────────────────────────────────────────────┐');
        console.log(`│ [ForegroundSync] SYNC #${syncCount}`);
        console.log(`│ Timestamp: ${timestamp}`);
        console.log(`│ Hora local: ${localTime}`);
        console.log('└─────────────────────────────────────────────────────┘');

        console.log('[ForegroundSync] 📱 Actualizando notificación...');
        // Actualizar notificación
        await BackgroundService.updateNotification({
          taskDesc: 'Sincronizando datos...',
          progressBar: {
            max: 100,
            value: 0,
            indeterminate: true,
          },
        });
        console.log('[ForegroundSync] ✅ Notificación actualizada');

        console.log('[ForegroundSync] 🔄 Ejecutando performSync()...');
        // Ejecutar sincronización
        const startTime = Date.now();
        const result = await this.performSync();
        const duration = Date.now() - startTime;
        const durationSeconds = (duration / 1000).toFixed(2);

        if (result.success) {
          console.log(
            '┌─────────────────────────────────────────────────────┐',
          );
          console.log('│ ✅ SINCRONIZACIÓN EXITOSA');
          console.log(`│ Duración: ${durationSeconds}s`);
          console.log(
            '└─────────────────────────────────────────────────────┘',
          );

          // Actualizar notificación con éxito
          await BackgroundService.updateNotification({
            taskDesc: `Última sync: ${new Date().toLocaleTimeString('es-MX')}`,
            progressBar: {
              max: 100,
              value: 100,
              indeterminate: false,
            },
          });
        } else {
          console.log(
            '┌─────────────────────────────────────────────────────┐',
          );
          console.log('│ ❌ ERROR EN SINCRONIZACIÓN');
          console.log(`│ Error: ${result.error}`);
          console.log(`│ Duración: ${durationSeconds}s`);
          console.log(
            '└─────────────────────────────────────────────────────┘',
          );

          // Actualizar notificación con error
          await BackgroundService.updateNotification({
            taskDesc: `Error en sync: ${result.error || 'Desconocido'}`,
            progressBar: {
              max: 100,
              value: 0,
              indeterminate: false,
            },
          });
        }
      } catch (error: any) {
        console.log('┌─────────────────────────────────────────────────────┐');
        console.log('│ ❌ ERROR CRÍTICO EN TAREA');
        console.log(`│ Error: ${error?.message || error}`);
        console.log('└─────────────────────────────────────────────────────┘');
        console.error('[ForegroundSync] Stack trace:', error?.stack);
      }

      // Esperar el intervalo antes de la próxima sincronización
      const nextSyncTime = new Date(Date.now() + intervalMs).toLocaleTimeString(
        'es-MX',
      );
      console.log('');
      console.log(
        `[ForegroundSync] ⏳ Esperando ${intervalSeconds}s (${intervalMinutes} min) para próxima sync...`,
      );
      console.log(`[ForegroundSync] Próxima sincronización: ${nextSyncTime}`);
      console.log('═══════════════════════════════════════════════════════');
      console.log('');

      console.log(`[ForegroundSync] 💤 Iniciando sleep de ${intervalMs}ms...`);
      await this.sleep(intervalMs);
      console.log(
        `[ForegroundSync] ⏰ Sleep completado, verificando si seguir loopeando...`,
      );
      console.log(
        `[ForegroundSync] 🔍 BackgroundService.isRunning(): ${BackgroundService.isRunning()}`,
      );
    }

    console.log(
      '[ForegroundSync] 🛑 Loop de sincronización terminado (servicio detenido)',
    );
    console.log(
      '[ForegroundSync] 🔍 Estado final - isRunning:',
      BackgroundService.isRunning(),
    );
  };

  /**
   * Ejecuta el proceso de sincronización
   */
  private async performSync(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('[ForegroundSync] 👤 Obteniendo información de usuario...');
      // Obtener usuario y sucursal
      const user = await AuthService.restoreSession();
      if (!user) {
        console.error('[ForegroundSync] ❌ No hay sesión activa');
        return { success: false, error: 'No hay sesión activa' };
      }

      const sucursal = user.sucursal_origen || user.sucursal || 1;
      const idUsuario = user.id || user.idUsuario || 1;
      console.log(
        `[ForegroundSync] Usuario: ${
          user.claveEmpleado || idUsuario
        }, Sucursal: ${sucursal}`,
      );

      console.log('[ForegroundSync] 📤 PASO 1: Enviando ventas pendientes...');
      // PRIMERO: Enviar ventas pendientes al servidor
      const ventasResult = await FullSyncService.sendPendingVentasToServer(
        sucursal,
        idUsuario,
      );
      if (ventasResult.success && ventasResult.sent > 0) {
        console.log(
          `[ForegroundSync] ✅ Ventas pendientes enviadas: ${ventasResult.sent}`,
        );
      } else if (ventasResult.success) {
        console.log('[ForegroundSync] ℹ️ No hay ventas pendientes');
      } else {
        console.warn(
          '[ForegroundSync] ⚠️ Error enviando ventas:',
          ventasResult.error,
        );
      }

      console.log('[ForegroundSync] 📤 PASO 2: Enviando cobranza pendiente...');
      // SEGUNDO: Enviar cobranza pendiente al servidor
      const cobranzaResult = await FullSyncService.sendPendingCobranzaToServer(
        sucursal,
        idUsuario,
      );
      if (cobranzaResult.success && cobranzaResult.sent > 0) {
        console.log(
          `[ForegroundSync] ✅ Cobranza pendiente enviada: ${cobranzaResult.sent}`,
        );
      } else if (cobranzaResult.success) {
        console.log('[ForegroundSync] ℹ️ No hay cobranza pendiente');
      } else {
        console.warn(
          '[ForegroundSync] ⚠️ Error enviando cobranza:',
          cobranzaResult.error,
        );
      }

      console.log('[ForegroundSync] 🔄 PASO 3: Sincronización incremental...');
      // TERCERO: Sincronización incremental de datos
      const syncResult = await FullSyncService.syncIncremental(
        sucursal,
        progress => {
          console.log(
            `[ForegroundSync] 📊 ${progress.entity}: ${progress.status}`,
          );
        },
        'foreground_service',
      );

      if (!syncResult.success) {
        console.error(
          '[ForegroundSync] ❌ Sincronización incremental falló:',
          syncResult.error,
        );
        return { success: false, error: syncResult.error };
      }

      console.log(
        '[ForegroundSync] ✅ Todos los pasos completados exitosamente',
      );
      return { success: true };
    } catch (error: any) {
      console.error('[ForegroundSync] ❌ Error en performSync:', error);
      console.error('[ForegroundSync] Error mensaje:', error?.message);
      console.error('[ForegroundSync] Error stack:', error?.stack);
      return { success: false, error: error?.message || 'Error desconocido' };
    }
  }

  /**
   * Función helper para dormir
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default ForegroundSyncService.getInstance();
