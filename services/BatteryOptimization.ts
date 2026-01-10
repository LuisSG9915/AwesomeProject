import { NativeModules, Platform } from 'react-native';

const { BatteryOptimization } = NativeModules;

/**
 * Servicio para gestionar la exención de optimización de batería.
 * CRÍTICO para sincronización en background - sin esto, Android Doze suspende la red.
 */
export const batteryOptimizationService = {
  /**
   * Verifica si la app está exenta de optimización de batería
   */
  async isIgnoringBatteryOptimizations(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return true;
    }

    try {
      return await BatteryOptimization.isIgnoringBatteryOptimizations();
    } catch (error) {
      console.error('[BatteryOptimization] Error verificando estado:', error);
      return false;
    }
  },

  /**
   * Solicita al usuario que exima la app de optimización de batería
   * Abre un diálogo del sistema
   */
  async requestIgnoreBatteryOptimizations(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }

    try {
      const result =
        await BatteryOptimization.requestIgnoreBatteryOptimizations();
      console.log('[BatteryOptimization] Resultado de solicitud:', result);
      return result;
    } catch (error) {
      console.error('[BatteryOptimization] Error solicitando exención:', error);
      return false;
    }
  },

  /**
   * Abre la configuración de batería (alternativa manual)
   */
  async openBatterySettings(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }

    try {
      return await BatteryOptimization.openBatterySettings();
    } catch (error) {
      console.error(
        '[BatteryOptimization] Error abriendo configuración:',
        error,
      );
      return false;
    }
  },

  /**
   * Verifica y solicita exención si es necesario
   * Retorna true si ya está exenta o si se solicitó exitosamente
   */
  async ensureBatteryOptimizationExemption(): Promise<boolean> {
    const isExempt = await this.isIgnoringBatteryOptimizations();

    if (isExempt) {
      console.log(
        '[BatteryOptimization] ✅ App ya está exenta de optimización de batería',
      );
      return true;
    }

    console.log(
      '[BatteryOptimization] ⚠️ App NO está exenta - solicitando exención...',
    );
    return await this.requestIgnoreBatteryOptimizations();
  },
};
