/**
 * BackgroundSyncService
 *
 * Servicio UNIFICADO para sincronización automática.
 *
 * Arquitectura:
 * - Primer plano: setInterval cada 3 minutos (preciso)
 * - Segundo plano: BackgroundFetch + HeadlessTask en index.js
 *
 * IMPORTANTE: La sincronización real se delega a FullSyncService.syncAll()
 * que maneja la arquitectura escalable con:
 * - SyncOrchestrator para dependencias
 * - SyncLog principal y SyncTableLog por tabla
 * - Retry logic con exponential backoff
 */

import FullSyncService from './FullSyncService';
import { SyncProgress } from './sync/SyncTask';
import AuthService from './AuthService';
import BackgroundFetch from 'react-native-background-fetch';
import { AppState, AppStateStatus } from 'react-native';
import ForegroundSyncService from './ForegroundSyncService';
import ExactAlarmSyncService from './ExactAlarmSyncService';

export type SyncStatus =
  | 'idle' // No sincronizando
  | 'syncing' // Sincronizando activamente
  | 'success' // Última sincronización exitosa
  | 'error'; // Error en última sincronización

export interface BackgroundSyncState {
  status: SyncStatus;
  lastSyncTime: Date | null;
  nextSyncTime: Date | null;
  currentProgress: SyncProgress | null;
  errorMessage: string | null;
  syncCount: number;
}

type StateListener = (state: BackgroundSyncState) => void;

class BackgroundSyncService {
  private static instance: BackgroundSyncService;

  // Configuración
  private readonly SYNC_INTERVAL_MS = 1 * 60 * 1000; // 10 minutos - app activa (setInterval)
  private readonly FOREGROUND_INTERVAL_MINUTES = 1; // 10 minutos - Foreground Service (background/cerrada)
  private readonly BACKGROUND_FETCH_TASK_ID = 'com.awesomeproject.sync';

  // Estado interno
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isBackgroundFetchConfigured = false;
  private lastSyncStartTime: number = 0; // Timestamp de última sync iniciada
  private appStateSubscription: any = null; // Listener de AppState
  private state: BackgroundSyncState = {
    status: 'idle',
    lastSyncTime: null,
    nextSyncTime: null,
    currentProgress: null,
    errorMessage: null,
    syncCount: 0,
  };

  // Listeners para notificar cambios de estado
  private listeners: Set<StateListener> = new Set();

  private constructor() {}

  static getInstance(): BackgroundSyncService {
    if (!BackgroundSyncService.instance) {
      BackgroundSyncService.instance = new BackgroundSyncService();
    }
    return BackgroundSyncService.instance;
  }

  /**
   * Inicia la sincronización automática en segundo plano
   * Usa Foreground Service (react-native-background-actions) para funcionar con pantalla apagada
   */
  async start(): Promise<void> {
    // GUARD ROBUSTO: Si ya está activo, no crear otro intervalo
    if (this.intervalId) {
      console.log(
        '[BackgroundSync] ⚠️ Ya está activo con intervalo ID:',
        this.intervalId,
      );
      console.log('[BackgroundSync] ℹ️ Ignorando llamada duplicada a start()');
      return;
    }

    console.log('[BackgroundSync] 🚀 Iniciando sincronización automática');

    // Calcular próxima sincronización
    const nextSync = new Date(Date.now() + this.SYNC_INTERVAL_MS);
    this.updateState({
      status: 'idle',
      nextSyncTime: nextSync,
    });

    // CRÍTICO: Configurar BackgroundFetch para sincronización cuando la app está en background REAL
    // Esto usa HeadlessTask registrado en index.js y funciona incluso cuando cambias de app
    try {
      console.log(
        '[BackgroundSync] 🔧 Configurando BackgroundFetch (HeadlessTask)...',
      );
      await this.configureBackgroundFetch();
      console.log(
        '[BackgroundSync] ✅ BackgroundFetch configurado - sincronizará cada ~15 min en background',
      );
    } catch (error: any) {
      console.error(
        '[BackgroundSync] ❌ Error configurando BackgroundFetch:',
        error?.message,
      );
    }

    // CRÍTICO: Configurar alarmas exactas para sincronización forzada cada minuto
    // Esto ignora completamente las políticas de ahorro de batería de Android
    // NOTA: ForegroundService DESACTIVADO para evitar colisiones y notificaciones persistentes
    try {
      console.log(
        '[BackgroundSync] ⚡ Configurando alarmas exactas (cada 1 min)...',
      );
      const canSchedule = await ExactAlarmSyncService.canScheduleExactAlarms();

      if (canSchedule) {
        await ExactAlarmSyncService.start();
        console.log(
          '[BackgroundSync] ✅ Alarmas exactas iniciadas - sincronizará cada 1 min',
        );
        console.log('[BackgroundSync] ✅ Sin notificación persistente');
        console.log(
          '[BackgroundSync] ⚠️ ADVERTENCIA: Esto consume más batería',
        );
      } else {
        console.warn(
          '[BackgroundSync] ⚠️ No se pueden programar alarmas exactas',
        );
        console.warn(
          '[BackgroundSync] Usuario debe habilitar en: Configuración → Apps → Alarmas',
        );
        console.warn(
          '[BackgroundSync] La app funcionará con BackgroundFetch (~15 min)',
        );
      }
    } catch (error: any) {
      console.error(
        '[BackgroundSync] ❌ Error configurando alarmas exactas:',
        error?.message,
      );
      console.warn(
        '[BackgroundSync] La app funcionará con BackgroundFetch (~15 min)',
      );
    }

    // NOTA: ForegroundService DESACTIVADO intencionalmente
    // Razones:
    // 1. Evita colisiones con alarmas exactas
    // 2. Elimina notificación persistente (no deseada por el cliente)
    // 3. Las alarmas exactas son suficientes para sincronización cada minuto
    console.log(
      '[BackgroundSync] ℹ️ ForegroundService desactivado - usando solo alarmas exactas',
    );

    // Usar intervalo para cuando la app está en primer plano (más preciso)
    this.intervalId = setInterval(() => {
      console.log('[BackgroundSync] ⏰ Intervalo disparado - ejecutando sync');
      this.performSync('interval');
    }, this.SYNC_INTERVAL_MS);

    // Configurar listener de AppState para manejar cambios a background
    this.setupAppStateListener();

    console.log(
      `[BackgroundSync] ✅ Sistema configurado - Foreground: ${
        this.FOREGROUND_INTERVAL_MINUTES
      }min, Intervalo: ${this.SYNC_INTERVAL_MS / 1000}s`,
    );
  }

  /**
   * Configura el listener de AppState para manejar cambios entre foreground/background
   * Cuando la app va a background, limpia el intervalo y deja que Foreground Service maneje
   */
  private setupAppStateListener(): void {
    // Limpiar listener anterior si existe
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }

    this.appStateSubscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        console.log('[BackgroundSync] 📱 AppState cambió a:', nextAppState);

        if (nextAppState === 'background' || nextAppState === 'inactive') {
          // App va a background
          // CAMBIO: NO limpiamos el intervalo porque ForegroundService puede pausarse en background
          // Dejamos que ambos (intervalo + ForegroundService) corran como respaldo
          console.log(
            `[BackgroundSync] 🌙 App en background - intervalo SIGUE ACTIVO como respaldo (${
              this.SYNC_INTERVAL_MS / 1000
            }s)`,
          );
          console.log(
            `[BackgroundSync] ℹ️ ForegroundService también activo (${this.FOREGROUND_INTERVAL_MINUTES} min)`,
          );
        } else if (nextAppState === 'active') {
          // App vuelve a foreground - reiniciar intervalo si no existe
          if (!this.intervalId) {
            console.log(
              `[BackgroundSync] ☀️ App en foreground - reiniciando intervalo (${
                this.SYNC_INTERVAL_MS / 1000
              }s)`,
            );
            this.intervalId = setInterval(() => {
              console.log(
                '[BackgroundSync] ⏰ Intervalo disparado - ejecutando sync',
              );
              this.performSync('interval');
            }, this.SYNC_INTERVAL_MS);

            // Actualizar próxima sincronización
            const nextSync = new Date(Date.now() + this.SYNC_INTERVAL_MS);
            this.updateState({
              nextSyncTime: nextSync,
            });
          } else {
            console.log(
              `[BackgroundSync] ☀️ App en foreground - intervalo ya estaba activo`,
            );
          }
        }
      },
    );

    console.log('[BackgroundSync] 👂 Listener de AppState configurado');
  }

  /**
   * Configura react-native-background-fetch para sincronización en segundo plano
   *
   * NOTA: El HeadlessTask está registrado en index.js (nivel superior)
   * Este método solo configura el intervalo y callbacks de la app activa
   */
  private async configureBackgroundFetch(): Promise<void> {
    if (this.isBackgroundFetchConfigured) {
      return;
    }

    try {
      // Configurar BackgroundFetch (mantenido como respaldo, pero Foreground Service es el principal)
      const status = await BackgroundFetch.configure(
        {
          minimumFetchInterval: 1, // 15 minutos (mínimo permitido por Android)
          stopOnTerminate: false, // Continuar después de cerrar la app
          startOnBoot: true, // Iniciar al reiniciar el dispositivo
          enableHeadless: true, // Permite ejecución sin UI (HeadlessTask en index.js)
          forceAlarmManager: true, // Usar AlarmManager para mayor precisión en Android
          requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY, // Requiere conexión de red
        },
        async taskId => {
          // Este callback se ejecuta cuando la app está activa
          // NOTA: Si hay intervalo activo, BackgroundFetch NO debe disparar sync
          console.log(
            '[BackgroundFetch] 📡 Tarea recibida (app activa):',
            taskId,
          );

          // Si hay intervalo activo, omitir (ya se maneja por setInterval)
          if (this.intervalId) {
            console.log('[BackgroundFetch] ⏭️ Omitiendo - intervalo ya activo');
            BackgroundFetch.finish(taskId);
            return;
          }

          try {
            console.log(
              '[BackgroundFetch] 🔄 Ejecutando sync desde BackgroundFetch',
            );
            await this.performSync('backgroundFetch');
          } catch (error) {
            console.error('[BackgroundFetch] Error en sincronización:', error);
          }

          // IMPORTANTE: Siempre llamar finish() cuando termine
          BackgroundFetch.finish(taskId);
        },
        async taskId => {
          // Callback de timeout - la tarea tomó demasiado tiempo
          console.warn('[BackgroundFetch] ⏱️ Timeout de tarea:', taskId);
          BackgroundFetch.finish(taskId);
        },
      );

      // Verificar estado de BackgroundFetch
      const statusText = this.getBackgroundFetchStatusText(status);
      console.log('[BackgroundFetch] Estado:', statusText);

      // NOTA: HeadlessTask está registrado en index.js, no aquí
      // Esto evita duplicación y asegura que funcione cuando la app está cerrada

      this.isBackgroundFetchConfigured = true;
      console.log('[BackgroundFetch] Configurado exitosamente');
    } catch (error) {
      console.error('[BackgroundFetch] Error al configurar:', error);
    }
  }

  /**
   * Obtiene texto descriptivo del estado de BackgroundFetch
   */
  private getBackgroundFetchStatusText(status: number): string {
    switch (status) {
      case BackgroundFetch.STATUS_RESTRICTED:
        return 'Restringido (configuración del sistema)';
      case BackgroundFetch.STATUS_DENIED:
        return 'Denegado (el usuario debe habilitarlo)';
      case BackgroundFetch.STATUS_AVAILABLE:
        return 'Disponible';
      default:
        return 'Desconocido';
    }
  }

  /**
   * Detiene la sincronización automática completamente
   * Detiene tanto el intervalo de primer plano como el Foreground Service
   */
  async stop(): Promise<void> {
    // Detener intervalo de primer plano
    if (this.intervalId) {
      console.log(
        `[BackgroundSync] 🛑 Deteniendo intervalo (ID: ${this.intervalId})`,
      );
      clearInterval(this.intervalId);
      this.intervalId = null;

      this.updateState({
        status: 'idle',
        nextSyncTime: null,
      });
    } else {
      console.log('[BackgroundSync] ℹ️ No hay intervalo activo para detener');
    }

    // NOTA: ForegroundService desactivado - no es necesario detenerlo
    console.log(
      '[BackgroundSync] ℹ️ ForegroundService no está en uso (desactivado)',
    );

    // Detener alarmas exactas
    try {
      console.log(
        '[BackgroundSync] 🔍 Verificando estado de alarmas exactas...',
      );
      if (ExactAlarmSyncService.isActive()) {
        console.log('[BackgroundSync] 🛑 Deteniendo alarmas exactas...');
        await ExactAlarmSyncService.stop();
        console.log('[BackgroundSync] ✅ Alarmas exactas detenidas');
      } else {
        console.log('[BackgroundSync] ℹ️ Alarmas exactas no estaban activas');
      }
    } catch (error: any) {
      console.error(
        '[BackgroundSync] ❌ Error deteniendo alarmas exactas:',
        error,
      );
      console.error('[BackgroundSync] Error detalle:', error?.message);
    }

    // Limpiar listener de AppState
    if (this.appStateSubscription) {
      console.log('[BackgroundSync] 🧹 Limpiando listener de AppState');
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }

  /**
   * Verifica si la sincronización automática está activa
   */
  isActive(): boolean {
    return this.intervalId !== null;
  }

  /**
   * Obtiene el estado actual
   */
  getState(): BackgroundSyncState {
    return { ...this.state };
  }

  /**
   * Suscribe un listener para recibir actualizaciones de estado
   */
  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    // Notificar estado actual inmediatamente
    listener(this.getState());

    // Retornar función para desuscribirse
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Ejecuta una sincronización manual (no afecta el intervalo automático)
   */
  async syncNow(): Promise<void> {
    console.log('[BackgroundSync] 👆 Sincronización manual solicitada');
    await this.performSync('manual');
  }

  /**
   * Actualiza el estado y notifica a los listeners
   */
  private updateState(updates: Partial<BackgroundSyncState>): void {
    this.state = {
      ...this.state,
      ...updates,
    };

    // Notificar a todos los listeners
    this.listeners.forEach(listener => {
      try {
        listener(this.getState());
      } catch (error) {
        console.error('[BackgroundSync] Error en listener:', error);
      }
    });
  }

  /**
   * Ejecuta el proceso de sincronización
   *
   * NOTA: Delega toda la lógica a FullSyncService.syncAll() que maneja:
   * - SyncLog principal
   * - SyncTableLog por tabla
   * - Retry logic con exponential backoff
   * - Dependencias entre tablas
   */
  private async performSync(
    source: 'interval' | 'backgroundFetch' | 'manual' = 'manual',
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const now = Date.now();

    // GUARD 1: Evitar sincronizaciones concurrentes
    if (this.state.status === 'syncing') {
      console.log(
        `[BackgroundSync] ⚠️ [${timestamp}] [${source}] Ya hay una sincronización en curso - OMITIENDO`,
      );
      return;
    }

    // GUARD 2: Prevenir ejecuciones automáticas muy cercanas (< 60 segundos)
    // Las sincronizaciones manuales siempre se permiten
    const timeSinceLastSync = now - this.lastSyncStartTime;
    if (
      source !== 'manual' &&
      this.lastSyncStartTime > 0 &&
      timeSinceLastSync < 60000
    ) {
      console.log(
        `[BackgroundSync] ⚠️ [${timestamp}] [${source}] Última sync hace ${Math.round(
          timeSinceLastSync / 1000,
        )}s - demasiado reciente, OMITIENDO`,
      );
      return;
    }

    // Registrar tiempo de inicio
    this.lastSyncStartTime = now;

    console.log(
      `[BackgroundSync] 🔄 [${timestamp}] [${source}] Iniciando sincronización...`,
    );

    this.updateState({
      status: 'syncing',
      currentProgress: null,
      errorMessage: null,
    });

    try {
      // Obtener usuario y sucursal
      const user = await AuthService.restoreSession();
      if (!user) {
        throw new Error('No hay sesión activa');
      }

      const sucursal = user.sucursal_origen || user.sucursal || 1;
      const idUsuario = user.id || user.idUsuario || 1;
      console.log('[BackgroundSync] Sincronizando sucursal:', sucursal);

      // PRIMERO: Enviar ventas pendientes al servidor (arrastre)
      const ventasResult = await FullSyncService.sendPendingVentasToServer(
        sucursal,
        idUsuario,
      );
      if (ventasResult.success && ventasResult.sent > 0) {
        console.log(
          `[BackgroundSync] ✅ Ventas pendientes enviadas: ${ventasResult.sent}`,
        );
      } else if (!ventasResult.success) {
        console.error(
          '[BackgroundSync] ⚠️ Error enviando ventas pendientes:',
          ventasResult.error,
        );
      }

      // SEGUNDO: Enviar cobranza pendiente al servidor (arrastre)
      const cobranzaResult = await FullSyncService.sendPendingCobranzaToServer(
        sucursal,
        idUsuario,
      );
      if (cobranzaResult.success && cobranzaResult.sent > 0) {
        console.log(
          `[BackgroundSync] ✅ Cobranza pendiente enviada: ${cobranzaResult.sent}`,
        );
      } else if (!cobranzaResult.success) {
        console.error(
          '[BackgroundSync] ⚠️ Error enviando cobranza pendiente:',
          cobranzaResult.error,
        );
      }

      // DESPUÉS: Ejecutar sincronización INCREMENTAL usando arquitectura escalable
      // FullSyncService.syncIncremental() usa fechaInicial basada en syncedAr
      // por tabla y los nuevos endpoints específicos para background.
      const result = await FullSyncService.syncIncremental(
        sucursal,
        (progress: SyncProgress) => {
          this.updateState({
            currentProgress: progress,
          });
        },
      );

      // ARRASTRE DE BITÁCORAS: Enviar bitácoras de los últimos 3 días al servidor
      try {
        console.log('[BackgroundSync] 📤 Iniciando arrastre de bitácoras...');
        const bitacoraResult =
          await FullSyncService.enviarBitacorasPendientes();
        if (bitacoraResult.success && bitacoraResult.enviadas > 0) {
          console.log(
            `[BackgroundSync] ✅ Bitácoras enviadas: ${bitacoraResult.enviadas}`,
          );
        } else if (!bitacoraResult.success) {
          console.warn(
            '[BackgroundSync] ⚠️ Error en arrastre de bitácoras (no crítico):',
            bitacoraResult.error,
          );
        }
      } catch (bitacoraError) {
        // No hacer fallar la sincronización por errores de bitácora
        console.warn(
          '[BackgroundSync] ⚠️ Error en arrastre de bitácoras:',
          bitacoraError,
        );
      }

      // ARRASTRE DE TRAZABILIDAD: Enviar trazabilidad de clicks de los últimos 7 días
      try {
        console.log(
          '[BackgroundSync] 📤 Iniciando arrastre de trazabilidad...',
        );
        const trazabilidadResult =
          await FullSyncService.sendPendingTrazabilidadToServer(
            sucursal,
            idUsuario,
          );
        if (trazabilidadResult.success && trazabilidadResult.sent > 0) {
          console.log(
            `[BackgroundSync] ✅ Trazabilidad enviada: ${trazabilidadResult.sent}`,
          );
        } else if (!trazabilidadResult.success) {
          console.warn(
            '[BackgroundSync] ⚠️ Error en arrastre de trazabilidad (no crítico):',
            trazabilidadResult.error,
          );
        }
      } catch (trazabilidadError) {
        // No hacer fallar la sincronización por errores de trazabilidad
        console.warn(
          '[BackgroundSync] ⚠️ Error en arrastre de trazabilidad:',
          trazabilidadError,
        );
      }

      // Actualizar estado según resultado
      const now = new Date();
      const nextSync = new Date(now.getTime() + this.SYNC_INTERVAL_MS);

      if (result.success) {
        this.updateState({
          status: 'success',
          lastSyncTime: now,
          nextSyncTime: nextSync,
          currentProgress: null,
          errorMessage: null,
          syncCount: this.state.syncCount + 1,
        });
        const duration =
          now.getTime() - Date.now() + (now.getTime() - Date.now());
        console.log(
          `[BackgroundSync] ✅ [${source}] Sincronización completada exitosamente. Próxima en 90s a las ${nextSync.toLocaleTimeString()}`,
        );
      } else {
        this.updateState({
          status: 'error',
          lastSyncTime: now,
          nextSyncTime: nextSync,
          currentProgress: null,
          errorMessage: result.error || 'Error desconocido',
        });
        console.log(
          `[BackgroundSync] ⚠️ [${source}] Sincronización completada con errores:`,
          result.error,
        );
      }
    } catch (error: any) {
      const errorMsg = error?.message || 'Error desconocido';
      console.error(
        '[BackgroundSync] Error crítico en sincronización:',
        errorMsg,
      );

      const nextSync = new Date(Date.now() + this.SYNC_INTERVAL_MS);

      this.updateState({
        status: 'error',
        nextSyncTime: nextSync,
        currentProgress: null,
        errorMessage: errorMsg,
      });
    }
  }

  /**
   * Formatea el tiempo restante hasta la próxima sincronización
   */
  getTimeUntilNextSync(): string | null {
    if (!this.state.nextSyncTime) return null;

    const now = Date.now();
    const next = this.state.nextSyncTime.getTime();
    const diff = next - now;

    if (diff <= 0) return 'Ahora';

    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }
}

export default BackgroundSyncService.getInstance();
