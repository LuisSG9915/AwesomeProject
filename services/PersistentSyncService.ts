/**
 * PersistentSyncService
 *
 * Servicio de sincronización PERSISTENTE que funciona:
 * - Con pantalla apagada
 * - En segundo plano
 * - Incluso después de cerrar la app (Android Foreground Service)
 *
 * Usa react-native-background-actions para crear un Foreground Service
 * que Android NO puede matar por ahorro de batería.
 *
 * IMPORTANTE: Esto consume batería significativamente. El cliente fue informado.
 */

import BackgroundActions from 'react-native-background-actions';
import FullSyncService from './FullSyncService';
import AuthService from './AuthService';
import { SyncProgress } from './sync/SyncTask';

export type PersistentSyncStatus = 'stopped' | 'running' | 'syncing' | 'error';

export interface PersistentSyncState {
  status: PersistentSyncStatus;
  lastSyncTime: Date | null;
  nextSyncTime: Date | null;
  currentProgress: SyncProgress | null;
  errorMessage: string | null;
  syncCount: number;
  isBackgroundTaskRunning: boolean;
}

type StateListener = (state: PersistentSyncState) => void;

// Opciones para el Foreground Service (notificación persistente)
const backgroundOptions = {
  taskName: 'SyncTask',
  taskTitle: 'Sincronización Activa',
  taskDesc: 'Sincronizando datos con el servidor...',
  taskIcon: {
    name: 'ic_launcher',
    type: 'mipmap',
  },
  color: '#4CAF50',
  linkingURI: 'awesomeproject://sync',
  parameters: {
    delay: 60000, // 1 minuto entre sincronizaciones (ajustable)
  },
};

class PersistentSyncService {
  private static instance: PersistentSyncService;

  // Configuración - Intervalo de sincronización en milisegundos
  private syncIntervalMs = 1 * 60 * 1000; // 1 minuto por defecto

  // Estado interno
  private state: PersistentSyncState = {
    status: 'stopped',
    lastSyncTime: null,
    nextSyncTime: null,
    currentProgress: null,
    errorMessage: null,
    syncCount: 0,
    isBackgroundTaskRunning: false,
  };

  // Listeners para notificar cambios de estado
  private listeners: Set<StateListener> = new Set();

  // Flag para controlar el loop de sincronización
  private shouldContinueSync = false;

  private constructor() {}

  static getInstance(): PersistentSyncService {
    if (!PersistentSyncService.instance) {
      PersistentSyncService.instance = new PersistentSyncService();
    }
    return PersistentSyncService.instance;
  }

  /**
   * Configura el intervalo de sincronización
   */
  setInterval(minutes: number): void {
    this.syncIntervalMs = minutes * 60 * 1000;
    console.log(`[PersistentSync] Intervalo configurado a ${minutes} minutos`);
  }

  /**
   * Obtiene el intervalo actual en minutos
   */
  getIntervalMinutes(): number {
    return this.syncIntervalMs / 60000;
  }

  /**
   * Inicia el servicio de sincronización persistente
   * Crea un Foreground Service que NO puede ser matado por Android
   */
  async start(): Promise<void> {
    if (this.state.isBackgroundTaskRunning) {
      console.log('[PersistentSync] Ya está ejecutándose');
      return;
    }

    console.log('[PersistentSync] Iniciando servicio persistente...');

    try {
      this.shouldContinueSync = true;

      // Actualizar opciones con el intervalo actual
      const options = {
        ...backgroundOptions,
        parameters: {
          delay: this.syncIntervalMs,
        },
      };

      // Iniciar el Foreground Service
      await BackgroundActions.start(this.backgroundTask.bind(this), options);

      this.updateState({
        status: 'running',
        isBackgroundTaskRunning: true,
        nextSyncTime: new Date(Date.now() + this.syncIntervalMs),
      });

      console.log('[PersistentSync] Servicio iniciado exitosamente');
    } catch (error: any) {
      console.error('[PersistentSync] Error al iniciar:', error);
      this.updateState({
        status: 'error',
        errorMessage: error?.message || 'Error al iniciar servicio',
        isBackgroundTaskRunning: false,
      });
    }
  }

  /**
   * Detiene el servicio de sincronización persistente
   */
  async stop(): Promise<void> {
    console.log('[PersistentSync] Deteniendo servicio...');

    this.shouldContinueSync = false;

    try {
      await BackgroundActions.stop();

      this.updateState({
        status: 'stopped',
        isBackgroundTaskRunning: false,
        nextSyncTime: null,
        currentProgress: null,
      });

      console.log('[PersistentSync] Servicio detenido');
    } catch (error: any) {
      console.error('[PersistentSync] Error al detener:', error);
    }
  }

  /**
   * Verifica si el servicio está corriendo
   */
  isRunning(): boolean {
    return BackgroundActions.isRunning();
  }

  /**
   * Tarea que se ejecuta en el Foreground Service
   * Loop infinito que sincroniza periódicamente
   */
  private backgroundTask = async (taskData?: { delay: number }) => {
    const delay = taskData?.delay || this.syncIntervalMs;

    console.log(`[PersistentSync] Background task iniciado, delay: ${delay}ms`);

    // Ejecutar primera sincronización inmediatamente
    await this.performSync();

    // Loop de sincronización
    while (this.shouldContinueSync && BackgroundActions.isRunning()) {
      // Actualizar notificación con tiempo restante
      const nextSync = new Date(Date.now() + delay);
      this.updateState({ nextSyncTime: nextSync });

      await BackgroundActions.updateNotification({
        taskTitle: 'Sincronización Activa',
        taskDesc: `Próxima sync: ${this.formatTime(nextSync)}`,
      });

      // Esperar el intervalo configurado
      await this.sleep(delay);

      // Verificar si debemos continuar
      if (!this.shouldContinueSync || !BackgroundActions.isRunning()) {
        break;
      }

      // Ejecutar sincronización
      await this.performSync();
    }

    console.log('[PersistentSync] Background task terminado');
  };

  /**
   * Ejecuta el proceso de sincronización
   */
  private async performSync(): Promise<void> {
    if (this.state.status === 'syncing') {
      console.log('[PersistentSync] Ya hay una sincronización en curso');
      return;
    }

    console.log('[PersistentSync] Ejecutando sincronización...');

    this.updateState({
      status: 'syncing',
      currentProgress: null,
      errorMessage: null,
    });

    // Actualizar notificación
    await BackgroundActions.updateNotification({
      taskTitle: 'Sincronizando...',
      taskDesc: 'Descargando datos del servidor',
    });

    try {
      // Obtener sesión del usuario
      const user = await AuthService.restoreSession();
      if (!user) {
        throw new Error('No hay sesión activa');
      }

      const sucursal = user.sucursal_origen || user.sucursal || 1;
      const idUsuario = user.id || user.idUsuario || 1;

      console.log(`[PersistentSync] Sincronizando sucursal: ${sucursal}`);

      // 1. Enviar ventas pendientes al servidor
      const ventasResult = await FullSyncService.sendPendingVentasToServer(
        sucursal,
        idUsuario,
      );

      if (ventasResult.success && ventasResult.sent > 0) {
        console.log(`[PersistentSync] Ventas enviadas: ${ventasResult.sent}`);

        await BackgroundActions.updateNotification({
          taskTitle: 'Sincronizando...',
          taskDesc: `Enviadas ${ventasResult.sent} ventas`,
        });
      }

      // 2. Ejecutar sincronización incremental
      const result = await FullSyncService.syncIncremental(
        sucursal,
        (progress: SyncProgress) => {
          this.updateState({ currentProgress: progress });

          // Actualizar notificación con progreso
          BackgroundActions.updateNotification({
            taskTitle: `Sincronizando ${progress.entity}`,
            taskDesc: `${progress.current}/${progress.total} - ${progress.message}`,
          });
        },
        'foreground_service',
      );

      const now = new Date();

      if (result.success) {
        this.updateState({
          status: 'running',
          lastSyncTime: now,
          currentProgress: null,
          errorMessage: null,
          syncCount: this.state.syncCount + 1,
        });

        console.log('[PersistentSync] Sincronización completada exitosamente');

        await BackgroundActions.updateNotification({
          taskTitle: 'Sincronización Activa',
          taskDesc: `Última sync: ${this.formatTime(now)}`,
        });
      } else {
        this.updateState({
          status: 'running', // Mantener corriendo para reintentar
          lastSyncTime: now,
          currentProgress: null,
          errorMessage: result.error || 'Error desconocido',
        });

        console.error(
          '[PersistentSync] Error en sincronización:',
          result.error,
        );

        await BackgroundActions.updateNotification({
          taskTitle: 'Error en Sincronización',
          taskDesc: `Reintentando en ${this.syncIntervalMs / 60000} min`,
        });
      }
    } catch (error: any) {
      const errorMsg = error?.message || 'Error desconocido';
      console.error('[PersistentSync] Error crítico:', errorMsg);

      this.updateState({
        status: 'running', // Mantener corriendo para reintentar
        currentProgress: null,
        errorMessage: errorMsg,
      });

      await BackgroundActions.updateNotification({
        taskTitle: 'Error de Sincronización',
        taskDesc: errorMsg.substring(0, 50),
      });
    }
  }

  /**
   * Ejecuta sincronización manual
   */
  async syncNow(): Promise<void> {
    await this.performSync();
  }

  /**
   * Obtiene el estado actual
   */
  getState(): PersistentSyncState {
    return { ...this.state };
  }

  /**
   * Suscribe un listener para recibir actualizaciones de estado
   */
  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Actualiza el estado y notifica a los listeners
   */
  private updateState(updates: Partial<PersistentSyncState>): void {
    this.state = {
      ...this.state,
      ...updates,
    };

    this.listeners.forEach(listener => {
      try {
        listener(this.getState());
      } catch (error) {
        console.error('[PersistentSync] Error en listener:', error);
      }
    });
  }

  /**
   * Helper para esperar un tiempo
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Formatea la hora para mostrar
   */
  private formatTime(date: Date): string {
    return date.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Obtiene tiempo restante para próxima sincronización
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

export default PersistentSyncService.getInstance();
