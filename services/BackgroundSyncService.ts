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
  private readonly SYNC_INTERVAL_MS = 1 * 60 * 1000; // 3 minutos
  private readonly SYNC_INTERVAL_MINUTES = 1; // Para BackgroundFetch
  private readonly BACKGROUND_FETCH_TASK_ID = 'com.awesomeproject.sync';

  // Estado interno
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isBackgroundFetchConfigured = false;
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
   * Usa react-native-background-fetch para funcionar con pantalla apagada
   */
  async start(): Promise<void> {
    if (this.intervalId && this.isBackgroundFetchConfigured) {
      console.log('[BackgroundSync] Ya está activo');
      return;
    }

    console.log(
      '[BackgroundSync] Iniciando sincronización automática cada 3 minutos',
    );

    // Calcular próxima sincronización
    const nextSync = new Date(Date.now() + this.SYNC_INTERVAL_MS);
    this.updateState({
      status: 'idle',
      nextSyncTime: nextSync,
    });

    // Configurar BackgroundFetch para sincronización con pantalla apagada
    await this.configureBackgroundFetch();

    // También usar intervalo para cuando la app está en primer plano (más preciso)
    this.intervalId = setInterval(() => {
      this.performSync();
    }, this.SYNC_INTERVAL_MS);

    // Ejecutar primera sincronización inmediatamente
    this.performSync();
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
      // Configurar BackgroundFetch
      const status = await BackgroundFetch.configure(
        {
          minimumFetchInterval: this.SYNC_INTERVAL_MINUTES, // Intervalo mínimo en minutos
          stopOnTerminate: false, // Continuar después de cerrar la app
          startOnBoot: true, // Iniciar al reiniciar el dispositivo
          enableHeadless: true, // Permite ejecución sin UI (HeadlessTask en index.js)
          forceAlarmManager: true, // Usar AlarmManager para mayor precisión en Android
          requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY, // Requiere conexión de red
        },
        async taskId => {
          // Este callback se ejecuta cuando la app está activa
          console.log('[BackgroundFetch] Tarea recibida (app activa):', taskId);

          try {
            await this.performSync();
          } catch (error) {
            console.error('[BackgroundFetch] Error en sincronización:', error);
          }

          // IMPORTANTE: Siempre llamar finish() cuando termine
          BackgroundFetch.finish(taskId);
        },
        async taskId => {
          // Callback de timeout - la tarea tomó demasiado tiempo
          console.warn('[BackgroundFetch] Timeout de tarea:', taskId);
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
   * Detiene la sincronización automática
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[BackgroundSync] Sincronización automática detenida');

      this.updateState({
        status: 'idle',
        nextSyncTime: null,
      });
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
    await this.performSync();
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
  private async performSync(): Promise<void> {
    // Evitar sincronizaciones concurrentes
    if (this.state.status === 'syncing') {
      console.log('[BackgroundSync] Ya hay una sincronización en curso');
      return;
    }

    console.log('[BackgroundSync] Iniciando sincronización...');

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
          `[BackgroundSync] Ventas pendientes enviadas: ${ventasResult.sent}`,
        );
      } else if (!ventasResult.success) {
        console.error(
          '[BackgroundSync] Error enviando ventas pendientes:',
          ventasResult.error,
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
        console.log('[BackgroundSync] Sincronización completada exitosamente');
      } else {
        this.updateState({
          status: 'error',
          lastSyncTime: now,
          nextSyncTime: nextSync,
          currentProgress: null,
          errorMessage: result.error || 'Error desconocido',
        });
        console.log(
          '[BackgroundSync] Sincronización completada con errores:',
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
