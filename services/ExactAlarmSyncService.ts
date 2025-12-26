/**
 * ExactAlarmSyncService
 *
 * Servicio que usa alarmas exactas de Android para forzar sincronización cada minuto,
 * incluso cuando la app está en background o el usuario cambia de aplicación.
 *
 * IMPORTANTE:
 * - Ignora las políticas de ahorro de batería de Android
 * - Requiere permisos especiales (SCHEDULE_EXACT_ALARM)
 * - Solo funciona en Android
 * - Consume más batería que métodos estándar
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import FullSyncService from './FullSyncService';
import AuthService from './AuthService';

const { ExactAlarmSync } = NativeModules;

class ExactAlarmSyncService {
  private static instance: ExactAlarmSyncService;
  private eventEmitter: NativeEventEmitter | null = null;
  private isRunning = false;

  private constructor() {
    if (Platform.OS === 'android' && ExactAlarmSync) {
      this.eventEmitter = new NativeEventEmitter(ExactAlarmSync);
    }
  }

  static getInstance(): ExactAlarmSyncService {
    if (!ExactAlarmSyncService.instance) {
      ExactAlarmSyncService.instance = new ExactAlarmSyncService();
    }
    return ExactAlarmSyncService.instance;
  }

  /**
   * Inicia las alarmas exactas cada minuto
   */
  async start(): Promise<void> {
    if (Platform.OS !== 'android') {
      console.warn('[ExactAlarmSync] Solo disponible en Android');
      return;
    }

    if (!ExactAlarmSync) {
      console.error('[ExactAlarmSync] Módulo nativo no disponible');
      return;
    }

    if (this.isRunning) {
      console.log('[ExactAlarmSync] Ya está en ejecución');
      return;
    }

    try {
      // Verificar si se pueden programar alarmas exactas
      const canSchedule = await ExactAlarmSync.canScheduleExactAlarms();

      if (!canSchedule) {
        console.error(
          '[ExactAlarmSync] ❌ No se pueden programar alarmas exactas',
        );
        console.error(
          '[ExactAlarmSync] El usuario debe habilitar este permiso en:',
        );
        console.error(
          '[ExactAlarmSync] Configuración → Apps → AwesomeProject → Alarmas y recordatorios',
        );
        throw new Error('Permiso de alarmas exactas no concedido');
      }

      console.log('[ExactAlarmSync] ✅ Permiso de alarmas exactas confirmado');

      // Iniciar alarmas exactas
      await ExactAlarmSync.startExactAlarms();
      this.isRunning = true;

      console.log('[ExactAlarmSync] 🚀 Alarmas exactas iniciadas');
      console.log(
        '[ExactAlarmSync] ⏰ Sincronización cada 1 minuto (incluso en background)',
      );
      console.log('[ExactAlarmSync] ⚠️ ADVERTENCIA: Esto consume más batería');
    } catch (error: any) {
      console.error('[ExactAlarmSync] ❌ Error al iniciar:', error?.message);
      throw error;
    }
  }

  /**
   * Detiene las alarmas exactas
   */
  async stop(): Promise<void> {
    if (Platform.OS !== 'android' || !ExactAlarmSync) {
      return;
    }

    if (!this.isRunning) {
      console.log('[ExactAlarmSync] No está en ejecución');
      return;
    }

    try {
      await ExactAlarmSync.stopExactAlarms();
      this.isRunning = false;
      console.log('[ExactAlarmSync] 🛑 Alarmas exactas detenidas');
    } catch (error: any) {
      console.error('[ExactAlarmSync] ❌ Error al detener:', error?.message);
      throw error;
    }
  }

  /**
   * Verifica si las alarmas están activas
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Verifica si se pueden programar alarmas exactas
   */
  async canScheduleExactAlarms(): Promise<boolean> {
    if (Platform.OS !== 'android' || !ExactAlarmSync) {
      return false;
    }

    try {
      return await ExactAlarmSync.canScheduleExactAlarms();
    } catch (error) {
      console.error('[ExactAlarmSync] Error verificando permisos:', error);
      return false;
    }
  }
}

export default ExactAlarmSyncService.getInstance();
