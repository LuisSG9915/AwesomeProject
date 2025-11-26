/**
 * BackgroundSyncService
 *
 * Servicio para sincronización automática en segundo plano cada 3 minutos.
 * Funciona incluso con la pantalla apagada o en modo suspensión.
 *
 * Características:
 * - Sincronización automática cada 3 minutos
 * - Estado observable para UI
 * - Manejo de errores robusto
 * - Logs detallados para debugging
 */

import FullSyncService, { SyncProgress } from './FullSyncService';
import AuthService from './AuthService';
import Realm from 'realm';
import { SyncLogSchema } from './RealmSchemas';

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
  private readonly SYNC_INTERVAL_MS = 3 * 60 * 1000; // 3 minutos

  // Estado interno
  private intervalId: ReturnType<typeof setInterval> | null = null;
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
   */
  start(): void {
    if (this.intervalId) {
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

    // Configurar intervalo
    this.intervalId = setInterval(() => {
      this.performSync();
    }, this.SYNC_INTERVAL_MS);

    // Ejecutar primera sincronización inmediatamente
    this.performSync();
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
   * Crea un log de sincronización en Realm
   */
  private async createSyncLog(logData: {
    fechaInicio: Date;
    fechaFinal: Date | null;
    exitoso: boolean;
    razon: string | null;
    usuario: string | null;
    ruta: string;
    sucursal: number | null;
    totalRegistros: number | null;
    tipo: 'manual' | 'automatica';
    detalles: any;
  }): Promise<void> {
    try {
      const realm = await Realm.open({
        schema: [SyncLogSchema],
        schemaVersion: 1,
      });

      const duracionMs = logData.fechaFinal
        ? logData.fechaFinal.getTime() - logData.fechaInicio.getTime()
        : null;

      realm.write(() => {
        realm.create('SyncLog', {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          fechaInicio: logData.fechaInicio,
          fechaFinal: logData.fechaFinal,
          exitoso: logData.exitoso,
          razon: logData.razon,
          usuario: logData.usuario,
          ruta: logData.ruta,
          sucursal: logData.sucursal,
          totalRegistros: logData.totalRegistros,
          duracionMs,
          tipo: logData.tipo,
          detalles: JSON.stringify(logData.detalles),
        });
      });

      realm.close();
      console.log('[BackgroundSync] Log de sincronización guardado');
    } catch (error) {
      console.error('[BackgroundSync] Error al guardar log:', error);
    }
  }

  /**
   * Ejecuta el proceso de sincronización
   */
  private async performSync(
    tipo: 'manual' | 'automatica' = 'automatica',
  ): Promise<void> {
    // Evitar sincronizaciones concurrentes
    if (this.state.status === 'syncing') {
      console.log('[BackgroundSync] Ya hay una sincronización en curso');
      return;
    }

    const fechaInicio = new Date();
    let user: any = null;
    let sucursal: number | null = null;
    let totalRegistros = 0;
    let detalles: any = {};

    console.log('[BackgroundSync] Iniciando sincronización...');

    this.updateState({
      status: 'syncing',
      currentProgress: null,
      errorMessage: null,
    });

    try {
      // Obtener usuario y sucursal
      user = await AuthService.restoreSession();
      if (!user) {
        throw new Error('No hay sesión activa');
      }

      sucursal = user.sucursal_origen || user.sucursal || 1;
      const usuario = user.claveEmpleado || user.nombre || 'Desconocido';
      const ruta = `https://cbinfo.no-ip.info:9011/api/MovilesVentas/ventas-full/${sucursal}`;

      console.log('[BackgroundSync] Sincronizando sucursal:', sucursal);

      // Ejecutar sincronización
      await FullSyncService.syncAll(sucursal!, (progress: SyncProgress) => {
        this.updateState({
          currentProgress: progress,
        });
        totalRegistros += progress.current;
        detalles[progress.entity] = progress.total;
      });

      // Sincronización exitosa
      const fechaFinal = new Date();
      const now = new Date();
      const nextSync = new Date(now.getTime() + this.SYNC_INTERVAL_MS);

      this.updateState({
        status: 'success',
        lastSyncTime: now,
        nextSyncTime: nextSync,
        currentProgress: null,
        errorMessage: null,
        syncCount: this.state.syncCount + 1,
      });

      console.log('[BackgroundSync] Sincronización completada exitosamente');

      // Guardar log exitoso
      await this.createSyncLog({
        fechaInicio,
        fechaFinal,
        exitoso: true,
        razon: null,
        usuario,
        ruta,
        sucursal,
        totalRegistros,
        tipo,
        detalles,
      });
    } catch (error: any) {
      const errorMsg = error?.message || 'Error desconocido';
      console.error('[BackgroundSync] Error en sincronización:', errorMsg);

      const fechaFinal = new Date();
      const nextSync = new Date(Date.now() + this.SYNC_INTERVAL_MS);

      this.updateState({
        status: 'error',
        nextSyncTime: nextSync,
        currentProgress: null,
        errorMessage: errorMsg,
      });

      // Guardar log de error
      await this.createSyncLog({
        fechaInicio,
        fechaFinal,
        exitoso: false,
        razon: errorMsg,
        usuario: user?.claveEmpleado || user?.nombre || 'Desconocido',
        ruta: sucursal
          ? `https://cbinfo.no-ip.info:9011/api/MovilesVentas/ventas-full/${sucursal}`
          : 'N/A',
        sucursal,
        totalRegistros,
        tipo,
        detalles: { error: errorMsg, stack: error?.stack },
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
