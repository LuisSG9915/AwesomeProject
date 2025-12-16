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
    console.log('[ForegroundSync] Configurado con intervalo:', this.config.intervalMinutes, 'minutos');
  }

  /**
   * Inicia el servicio de sincronización en foreground
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[ForegroundSync] Ya está en ejecución');
      return;
    }

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
      // Verificar si ya hay un servicio en ejecución (función SÍNCRONA, no asíncrona)
      const isAlreadyRunning = BackgroundService.isRunning();
      if (isAlreadyRunning) {
        console.log('[ForegroundSync] ⚠️ Servicio ya está corriendo, omitiendo inicio');
        this.isRunning = true;
        return;
      }

      await BackgroundService.start(this.syncTask, options);
      this.isRunning = true;
      console.log('[ForegroundSync] ✅ Servicio iniciado exitosamente');
    } catch (error: any) {
      console.error('[ForegroundSync] ❌ Error al iniciar servicio:', error);
      console.error('[ForegroundSync] Error completo:', JSON.stringify(error));
      
      // Si el error es por permisos de notificación, informar claramente
      if (error?.message?.includes('notification') || error?.message?.includes('permission')) {
        console.error('[ForegroundSync] ⚠️ Error de permisos de notificación. El usuario debe habilitar notificaciones.');
      }
      
      // NO lanzar error - permitir que la app continúe
      console.warn('[ForegroundSync] La sincronización en background no estará disponible, pero la app funcionará normalmente');
    }
  }

  /**
   * Detiene el servicio de sincronización
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('[ForegroundSync] No está en ejecución');
      return;
    }

    try {
      await BackgroundService.stop();
      this.isRunning = false;
      console.log('[ForegroundSync] 🛑 Servicio detenido');
    } catch (error) {
      console.error('[ForegroundSync] Error al detener servicio:', error);
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
    const { intervalMs } = taskData.parameters;
    const intervalSeconds = intervalMs / 1000;

    console.log(`[ForegroundSync] 🚀 Tarea iniciada - intervalo: ${intervalSeconds}s`);

    // Loop infinito mientras el servicio esté activo
    await new Promise(async () => {
      while (BackgroundService.isRunning()) {
        try {
          const timestamp = new Date().toISOString();
          console.log(`[ForegroundSync] ⏰ [${timestamp}] Ejecutando sincronización...`);

          // Actualizar notificación
          await BackgroundService.updateNotification({
            taskDesc: 'Sincronizando datos...',
            progressBar: {
              max: 100,
              value: 0,
              indeterminate: true,
            },
          });

          // Ejecutar sincronización
          const result = await this.performSync();

          if (result.success) {
            console.log('[ForegroundSync] ✅ Sincronización completada exitosamente');
            
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
            console.error('[ForegroundSync] ❌ Error en sincronización:', result.error);
            
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

        } catch (error) {
          console.error('[ForegroundSync] ❌ Error crítico en tarea:', error);
        }

        // Esperar el intervalo antes de la próxima sincronización
        console.log(`[ForegroundSync] ⏳ Esperando ${intervalSeconds}s para próxima sync...`);
        await this.sleep(intervalMs);
      }
    });
  };

  /**
   * Ejecuta el proceso de sincronización
   */
  private async performSync(): Promise<{ success: boolean; error?: string }> {
    try {
      // Obtener usuario y sucursal
      const user = await AuthService.restoreSession();
      if (!user) {
        return { success: false, error: 'No hay sesión activa' };
      }

      const sucursal = user.sucursal_origen || user.sucursal || 1;
      const idUsuario = user.id || user.idUsuario || 1;

      // PRIMERO: Enviar ventas pendientes al servidor
      const ventasResult = await FullSyncService.sendPendingVentasToServer(
        sucursal,
        idUsuario,
      );
      if (ventasResult.success && ventasResult.sent > 0) {
        console.log(
          `[ForegroundSync] ✅ Ventas pendientes enviadas: ${ventasResult.sent}`,
        );
      }

      // SEGUNDO: Enviar cobranza pendiente al servidor
      const cobranzaResult = await FullSyncService.sendPendingCobranzaToServer(
        sucursal,
        idUsuario,
      );
      if (cobranzaResult.success && cobranzaResult.sent > 0) {
        console.log(
          `[ForegroundSync] ✅ Cobranza pendiente enviada: ${cobranzaResult.sent}`,
        );
      }

      // TERCERO: Sincronización incremental de datos
      const syncResult = await FullSyncService.syncIncremental(
        sucursal,
        (progress) => {
          console.log(
            `[ForegroundSync] 📊 ${progress.entity}: ${progress.status}`,
          );
        },
      );

      if (!syncResult.success) {
        return { success: false, error: syncResult.error };
      }

      return { success: true };
    } catch (error: any) {
      console.error('[ForegroundSync] Error en performSync:', error);
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
